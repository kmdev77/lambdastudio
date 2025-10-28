# Serverless Image Resizer + Remove BG (Terraform)

See step-by-step instructions in chat. This repo contains:
- terraform/ (S3, API Gateway, Lambdas)
- lambdas/processImage (Sharp + RMBG)
- lambdas/signUpload (S3 presigned PUT)
- frontend/.env.example (wire your UI)