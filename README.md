# Lambda Studio

Lambda Studio is a full-stack, serverless image processing and AI inference platform built on AWS. It integrates Lambda, S3, API Gateway, and Terraform to handle image uploads, resizing, and palette extraction through a modern React frontend.

## Overview

This project demonstrates an end-to-end cloud application workflow using AWS-managed services and Infrastructure as Code. It highlights practical use of serverless compute, cloud storage, API integration, and AI inference through Hugging Face.

## Architecture

```
Frontend (React + Vite + Tailwind)
        ↓ HTTPS
API Gateway (v2 HTTP API)
        ↓ Routes
AWS Lambda Functions ──────────────┐
  /sign-upload  →  Presigned S3 URL│
  /process       →  Resize image   │
  /palette       →  Extract colors │
        ↓                          │
Amazon S3 (image-resizer-bucket)   │
  uploads/ → thumbs/ → palettes/───┘
```

Each Lambda function runs in Node.js 18+, triggered via API Gateway POST routes, and deployed through Terraform with managed IAM roles, permissions, and outputs.

## Features

| Feature | Description |
|----------|--------------|
| Image Upload | Secure upload via presigned S3 URLs |
| Image Resize | Uses Sharp to resize images dynamically |
| Palette Extraction | Calls Hugging Face models for color extraction |
| Download Ready | Provides direct or presigned S3 URLs for outputs |
| Live Preview | Displays uploaded and processed images in real-time |
| Infrastructure as Code | Fully managed with Terraform |
| Serverless Stack | Automatically scales with demand |

## Project Structure

```
lambda-studio/
├── lambdas/
│   ├── process/          # Resize images with Sharp
│   ├── palette/          # Extract color palettes
│   └── sign-upload/      # Generate presigned S3 URLs
│
├── frontend/             # React + Vite + Tailwind UI
│   ├── src/
│   │   ├── components/
│   │   ├── assets/
│   │   └── App.tsx
│   └── public/
│
├── terraform/
│   ├── main.tf
│   ├── api.tf
│   ├── s3.tf
│   └── outputs.tf
│
└── README.md
```

## Tech Stack

### Frontend
- React + Vite + TypeScript
- Tailwind CSS
- Framer Motion for animations
- Lenis for smooth scrolling
- Environment variables: `VITE_API_URL`, `VITE_S3_BUCKET`

### Backend
- AWS Lambda (Node.js 18)
- Amazon S3
- API Gateway v2
- Terraform
- Sharp (image processing)
- Hugging Face API (palette inference)
- Optional FAL.AI provider for inference routing

## API Endpoints

| Method | Route | Description |
|--------|--------|-------------|
| POST | /sign-upload | Returns presigned URL for S3 upload |
| POST | /process | Resizes image using Sharp |
| POST | /palette | Extracts color palette via AI |
| GET | /health | Optional health check |

All routes are deployed under a single API Gateway instance and are CORS-enabled.

## Environment Variables

| Variable | Description |
|-----------|--------------|
| BUCKET_NAME | S3 bucket name |
| INPUT_PREFIX | Uploads folder prefix |
| OUTPUT_PREFIX | Output folder prefix |
| HF_TOKEN | Hugging Face API token |
| HF_MODEL | Model name (e.g., Colour-Extract) |
| HF_PROVIDER | Provider name (optional) |
| FAL_TASK_URL | Optional custom inference endpoint |
| AWS_REGION | Deployment region (us-west-1) |

## CORS and Security

- API Gateway allows GET, POST, and OPTIONS methods with standard headers.
- S3 allows GET, PUT, POST, DELETE, and HEAD from any origin for development.
- HTTPS enforced for all API calls.
- IAM role grants least-privilege Lambda and S3 permissions.

## Deployment

### Terraform Setup

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

Outputs include:

```
api_url  = "https://1zsjireqq3.execute-api.us-west-1.amazonaws.com/prod"
bucket   = "image-resizer-bucket-10222025"
```

### Lambda Deployment

Each Lambda has its own deployment script (PowerShell or Docker-based):

```bash
cd lambdas/process
./redeploy.ps1
```

### Frontend Deployment

```bash
cd frontend
npm install
npm run build
npm run preview
```

Deploy via Netlify, Vercel, or S3 + CloudFront using:

```env
VITE_API_URL="https://1zsjireqq3.execute-api.us-west-1.amazonaws.com/prod"
VITE_S3_BUCKET="image-resizer-bucket-10222025"
```

## Workflow

1. User uploads image via presigned S3 URL.
2. Image stored in `uploads/` prefix.
3. User resizes image via `/process` Lambda → stored in `thumbs/`.
4. User extracts palette via `/palette` Lambda → stored in `palettes/`.
5. Frontend displays uploaded, resized, and extracted results.



## Author

Lambda Studio was developed by kmdev77 as a full-stack AWS cloud project to demonstrate real-world serverless engineering, AI integration, and frontend-backend orchestration.
