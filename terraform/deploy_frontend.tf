

# Rebuild when key frontend files change (add more triggers as needed)
resource "null_resource" "frontend_deploy" {
  triggers = {
    pkg_hash   = filesha1("../frontend/package.json")
    index_hash = filesha1("../frontend/index.html")
  }

  provisioner "local-exec" {
    interpreter = ["PowerShell", "-Command"]
    command     = <<EOT
      cd ../frontend
      if (Test-Path node_modules) { } else { npm ci }
      npm run build
      aws s3 sync dist s3://${var.site_bucket} --delete
    EOT
  }

  depends_on = [
    aws_s3_bucket_policy.site_public,
    aws_s3_bucket_website_configuration.site
  ]
}

# Print the website endpoint
output "site_website_url" {
  description = "Public S3 website URL"
  value       = "http://${aws_s3_bucket.site.bucket}.s3-website-${data.aws_region.current.name}.amazonaws.com"
}
