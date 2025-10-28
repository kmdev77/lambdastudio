############################################
# IAM role for Lambdas (no duplicates)
############################################

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "${var.project}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# CloudWatch Logs for Lambdas (managed policy)
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

############################################
# S3 access for the Lambda role
# (build ARNs from var.bucket_name — no TF bucket refs)
############################################

# Ensure this variable exists in variables.tf:
# variable "bucket_name" { type = string }

resource "aws_iam_role_policy" "lambda_s3_rw" {
  role = aws_iam_role.lambda_role.name

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["s3:ListBucket"],
        Resource = "arn:aws:s3:::${var.bucket_name}"
      },
      {
        Effect   = "Allow",
        Action   = ["s3:GetObject", "s3:PutObject"],
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      }
    ]
  })
}

/*
NOTE:
No references to aws_s3_bucket.<name> here — we derive ARNs
from var.bucket_name to avoid "undeclared resource" errors.
Keep any other attachments you already have in api.tf separate
to avoid duplicates.
*/
