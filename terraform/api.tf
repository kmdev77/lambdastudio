############################
# Context / helpers
############################
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# Your bucket is already defined elsewhere as aws_s3_bucket.site
locals {
  site_bucket_name = aws_s3_bucket.site.bucket
  site_bucket_arn  = aws_s3_bucket.site.arn

  uploads_prefix   = "uploads/"
  thumbs_prefix    = "thumbs/"   # kept for backward-compat (not used by palette)
  palettes_prefix  = "palettes/" # NEW for palette outputs
}

############################
# Lambda: PALETTE (replaces processImage)
############################
resource "aws_lambda_function" "palette" {
  function_name    = "${var.project}-palette"   # e.g., img-resizer-palette
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"

  # This is the zip your Docker script produced:
  filename         = "${path.module}/../lambdas/palette/palette.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambdas/palette/palette.zip")

  timeout     = 30
  memory_size = 1024

  environment {
    variables = {
      BUCKET                 = var.bucket_name            # <— palette lambda expects BUCKET
      OUTPUT_PREFIX          = local.palettes_prefix      # "palettes/"
      PALETTE_SIZE           = "5"
      SIGNED_URL_TTL_SECONDS = "900"
    }
  }
}

############################
# Lambda: signUpload (kept)
############################
resource "aws_lambda_function" "sign" {
  function_name    = "${var.project}-sign"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs20.x" # bump to 20.x
  handler          = "index.handler"

  # Point to the zip your Docker script produced:
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
# (Optional) OLD process lambda — disable cleanly
############################
# If you want to retain the block without destroying state yet, set count = 0.
# Otherwise, delete the old aws_lambda_function.process + its API resources.
resource "aws_lambda_function" "process" {
  count            = 0
  function_name    = "${var.project}-process"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs18.x"
  handler          = "index.handler"
  filename         = "${path.module}/../lambdas/processImage/dist/processImage.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambdas/processImage/dist/processImage.zip")
}

############################
# API Gateway (HTTP API)
############################
resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_methods = ["POST", "OPTIONS"]
    allow_origins = ["*"] # tighten for prod
    allow_headers = ["content-type", "authorization"]
  }
}

# ---- sign routes (keep old /sign-upload + add new /sign)

resource "aws_lambda_permission" "allow_apigw_sign" {
  statement_id  = "AllowAPIGwInvokeSign"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sign.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "sign" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.sign.arn
  payload_format_version = "2.0"
}

# old route kept (backward-compat)
resource "aws_apigatewayv2_route" "sign_upload" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /sign-upload"
  target    = "integrations/${aws_apigatewayv2_integration.sign.id}"
}

# new clean route
resource "aws_apigatewayv2_route" "sign_clean" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /sign"
  target    = "integrations/${aws_apigatewayv2_integration.sign.id}"
}

# ---- palette route

resource "aws_lambda_permission" "allow_apigw_palette" {
  statement_id  = "AllowAPIGwInvokePalette"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.palette.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "palette" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.palette.arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "palette" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /palette"
  target    = "integrations/${aws_apigatewayv2_integration.palette.id}"
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "prod"
  auto_deploy = true
}

############################
# Outputs
############################
output "api_base_url" {
  value = aws_apigatewayv2_stage.prod.invoke_url
}

# Keep old output (still works)
output "sign_upload_url" {
  value = "${aws_apigatewayv2_stage.prod.invoke_url}/sign-upload"
}

# New clean outputs
output "sign_url" {
  value = "${aws_apigatewayv2_stage.prod.invoke_url}/sign"
}

output "palette_url" {
  value = "${aws_apigatewayv2_stage.prod.invoke_url}/palette"
}
