resource "aws_s3_bucket" "images" {
  bucket = "image-resizer-bucket-10222025"
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket                  = aws_s3_bucket.images.id
  block_public_acls       = true
  block_public_policy     = true # keep fully private (account setting is also on)
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "bucket_name" {
  value = aws_s3_bucket.images.bucket
}
