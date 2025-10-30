# outputs.tf

output "bucket" { value = var.bucket_name }
output "api_url" { value = aws_apigatewayv2_stage.prod.invoke_url }

# Guarded: returns null when the 'process' lambda doesn't exist (count = 0 or removed)
output "process_arn" {
  value       = length(aws_lambda_function.process) > 0 ? aws_lambda_function.process[0].arn : null
  description = "Process Lambda ARN (null when disabled)"
}

# DO NOT re-declare sign_url or palette_url here (they already exist in api.tf).
# Remove any 'process_image_url' output since /process route was removed in the plan.
