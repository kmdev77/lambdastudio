terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

provider "aws" { region = var.aws_region }

# Store HF token in SSM
resource "aws_ssm_parameter" "hf_token" {
  name  = "/${var.project}/HF_TOKEN"
  type  = "SecureString"
  value = var.hf_token
}

# Include S3 module inline
# (resources for S3 bucket and policy are in s3.tf)