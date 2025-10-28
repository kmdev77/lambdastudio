output "bucket" { value = var.bucket_name }
output "api_url" { value = aws_apigatewayv2_stage.prod.invoke_url }
output "process_arn" { value = aws_lambda_function.process.arn }
output "sign_arn" { value = aws_lambda_function.sign.arn }