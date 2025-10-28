variable "project" {
  type    = string
  default = "img-resizer"
}

variable "aws_region" {
  type    = string
  default = "us-west-1" # <- your region
}

variable "bucket_name" {
  type    = string
}

variable "hf_token" {
  type      = string
  sensitive = true
}

variable "site_bucket" {
  description = "S3 bucket for the static frontend"
  type        = string
}

variable "sharp_layer_arn" {
  description = "ARN of the Sharp layer to attach to the process Lambda"
  type        = string
  default     = ""
}