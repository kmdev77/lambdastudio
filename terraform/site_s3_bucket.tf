resource "aws_s3_bucket" "site" {
  bucket = "image-resizer-bucket-10222025"
  # ...rest...
}

# Enable S3 static website hosting
resource "aws_s3_bucket_website_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  index_document { suffix = "index.html" }
  error_document { key = "index.html" }
}

# Disable bucket-level Block Public Access (so a public policy is allowed)
resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = false
  block_public_policy     = false
  restrict_public_buckets = false
  ignore_public_acls      = false
}

# Public-read policy for objects
resource "aws_s3_bucket_policy" "site_public" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Sid       = "PublicRead",
      Effect    = "Allow",
      Principal = "*",
      Action    = "s3:GetObject",
      Resource  = "${aws_s3_bucket.site.arn}/*"
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.site]
}
