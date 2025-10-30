############################
# Context / helpers
############################
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  site_bucket_name = aws_s3_bucket.site.bucket
  site_bucket_arn  = aws_s3_bucket.site.arn

  uploads_prefix  = "uploads/"
  thumbs_prefix   = "thumbs/"
  palettes_prefix = "palettes/"
}

############################
# Lambda: PROCESS (resize)
# - If you need to temporarily disable, set count = 0
############################
resource "aws_lambda_function" "process" {
  count            = 1
  function_name    = "${var.project}-process"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs18.x" # matches your ESM handler
  handler          = "index.handler"
  filename         = "${path.module}/../lambdas/processImage/dist/processImage.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambdas/processImage/dist/processImage.zip")

  timeout     = 30
  memory_size = 1024

  environment {
    variables = {
      BUCKET_NAME            = local.site_bucket_name
      OUTPUT_PREFIX          = local.thumbs_prefix
      SIGNED_URL_TTL_SECONDS = "3600"
      MAX_PX                 = "4096"

      # Optional RMBG (kept for completeness; handler tolerates removeBg=false)
      HF_TOKEN = var.hf_token

    }
  }
}

############################
# Lambda: PALETTE (kmeans)
############################
resource "aws_lambda_function" "palette" {
  function_name    = "${var.project}-palette"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = "${path.module}/../lambdas/palette/palette.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambdas/palette/palette.zip")

  timeout     = 30
  memory_size = 1024

  environment {
    variables = {
      BUCKET                 = var.bucket_name
      OUTPUT_PREFIX          = local.palettes_prefix
      PALETTE_SIZE           = "5"
      SIGNED_URL_TTL_SECONDS = "900"
    }
  }
}

############################
# Lambda: signUpload
############################
resource "aws_lambda_function" "sign" {
  function_name    = "${var.project}-sign"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = "${path.module}/../lambdas/signUpload/sign.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambdas/signUpload/sign.zip")

  timeout     = 10
  memory_size = 256

  environment {
    variables = {
      BUCKET_NAME  = local.site_bucket_name
      INPUT_PREFIX = local.uploads_prefix
    }
  }
}

############################
# API Gateway (HTTP API)
############################
resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_methods = ["OPTIONS", "POST", "GET"]
    allow_origins = ["*"]
    allow_headers = ["*"]
  }
}

############################
# Integrations
############################
resource "aws_apigatewayv2_integration" "process" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = one(aws_lambda_function.process[*].arn)
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "palette" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.palette.arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "sign" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.sign.arn
  payload_format_version = "2.0"
}

############################
# Routes
############################
resource "aws_apigatewayv2_route" "process" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /process"
  target    = "integrations/${aws_apigatewayv2_integration.process.id}"
}

resource "aws_apigatewayv2_route" "palette" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /palette"
  target    = "integrations/${aws_apigatewayv2_integration.palette.id}"
}

# keep old sign-upload for backward compat
resource "aws_apigatewayv2_route" "sign_upload" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /sign-upload"
  target    = "integrations/${aws_apigatewayv2_integration.sign.id}"
}

# cleaner route
resource "aws_apigatewayv2_route" "sign" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /sign"
  target    = "integrations/${aws_apigatewayv2_integration.sign.id}"
}

############################
# Permissions for API → Lambda
############################
resource "aws_lambda_permission" "allow_apigw_process" {
  statement_id  = "AllowAPIGwInvokeProcess"
  action        = "lambda:InvokeFunction"
  function_name = one(aws_lambda_function.process[*].arn)
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_apigw_palette" {
  statement_id  = "AllowAPIGwInvokePalette"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.palette.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_apigw_sign" {
  statement_id  = "AllowAPIGwInvokeSign"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sign.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

############################
# Stage
############################
resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "prod"
  auto_deploy = true
}

############################
# Outputs (keep ONLY here to avoid duplicates)
############################
output "api_base_url" {
  value = aws_apigatewayv2_stage.prod.invoke_url
}

# Guarded: if process were ever disabled (count=0), this stays null instead of erroring
# output "process_arn" {
#   value       = try(one(aws_lambda_function.process[*].arn), null)
#   description = "Process Lambda ARN (null if disabled)"
# }

output "process_image_url" {
  value       = "${aws_apigatewayv2_stage.prod.invoke_url}/process"
  description = "POST /process"
}

output "sign_upload_url" {
  value       = "${aws_apigatewayv2_stage.prod.invoke_url}/sign-upload"
  description = "POST /sign-upload"
}

output "sign_url" {
  value       = "${aws_apigatewayv2_stage.prod.invoke_url}/sign"
  description = "POST /sign"
}

output "palette_url" {
  value       = "${aws_apigatewayv2_stage.prod.invoke_url}/palette"
  description = "POST /palette"
}
