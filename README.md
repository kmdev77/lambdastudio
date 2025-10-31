# Lambda Studio

Lambda Studio is a full-stack, serverless image processing and AI inference platform built on AWS. It integrates Lambda, S3, API Gateway, and Terraform to handle image uploads, resizing, and palette extraction through a modern React frontend.

## Overview

This project demonstrates an end-to-end cloud application workflow using AWS-managed services and Infrastructure as Code. It highlights practical use of serverless compute, cloud storage, API integration, and AI inference through Hugging Face.

## Live Frontend URL

You can view the deployed Lambda Studio application here:

Frontend: https://kmdev77.github.io/lambdastudio/

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
lambdastudio/
├── lambdas/
│   ├── processImage/          # Resize images with Sharp
│   ├── palette/          # Extract color palettes
│   └── signUpload/      # Generate presigned S3 URLs
│
├── frontend/             # React + Vite + Tailwind UI
│   ├── src/
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
- API Gateway 
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




# Debugging Log & Problem/Solution Highlights

> Last updated: 2025-10-31  

---

## 1) CORS errors between frontend and backend
**What happened:** My frontend couldn’t talk to the backend at all. Every request failed with “Failed to fetch.”  
**Why:** The browser was blocking the requests because I didn’t have CORS set up correctly on API Gateway and S3.  
**Fix:** I added the right headers and methods (`OPTIONS, POST, GET`) on both sides and redeployed. After that, everything worked.  
**Lesson:** CORS issues aren’t about bad code — they’re about missing permissions between your frontend and backend.

---

## 2) API route duplication / drift between console and Terraform
**What happened:** Some of my API routes started duplicating or behaving weirdly after updates.  
**Why:** I had created a few routes manually in the AWS console while Terraform was also managing them. That caused Terraform and AWS to get out of sync.  
**Fix:** I imported the existing routes into Terraform so it could fully manage them again:  
```
terraform import aws_apigatewayv2_route.process       <apiId>/<routeId for POST /process>
terraform import aws_apigatewayv2_route.palette       <apiId>/<routeId for POST /palette>
terraform import aws_apigatewayv2_route.sign          <apiId>/<routeId for POST /sign>
terraform import aws_apigatewayv2_route.sign_upload   <apiId>/<routeId for POST /sign-upload>
```
**Lesson:** Don’t mix console changes with Terraform. Import them first so everything stays in sync.

---

## 3) Preview not updating after resize
**What happened:** After resizing an image, the preview didn’t change even though the backend worked.  
**Why:** My frontend was still showing the old cached image.  
**Fix:** I updated the state with the new file key and added a cache-busting timestamp at the end of the image URL.  
**Lesson:** Always update your frontend to use the new file URL after an operation.

---


## 4) Hugging Face model permission errors
**What happened:** My background removal model suddenly stopped working.  
**Why:** The provider I was using required paid access. My token didn’t have the right permissions.  
**Fix:** I created a new token with proper scopes and switched to a free open-source model for color palette extraction.  
**Lesson:** Always check model access and token permissions early.

---


## 5) Some S3 images worked, others gave errors
**What happened:** Some images loaded fine while others failed with 403 errors.  
**Why:** I was mixing public S3 links and presigned URLs in my frontend.  
**Fix:** I standardized it — if a presigned URL exists, use that. Otherwise, build the public URL from the bucket name.  
**Lesson:** Pick one URL method (public or presigned) and be consistent.

---

## 6) S3 file paths returning 404
**What happened:** Some processed images came back as “file not found.”  
**Why:** My backend and frontend were using slightly different environment variable names for bucket prefixes.  
**Fix:** I standardized the names (`uploads/`, `thumbs/`) and made sure both sides built URLs the same way.  
**Lesson:** Keep your environment variable names consistent across services.

---

## 7) API routes stopped working after edits
**What happened:** A few endpoints stopped working after I changed some configurations.  
**Why:** My `api.tf` file got messy from small tweaks and old code.  
**Fix:** I rebuilt a clean version of the file, redefined all routes, and fixed CORS in one place.  
**Lesson:** Sometimes it’s easier to rebuild clean infrastructure than keep patching old configs.

---

## Author

Lambda Studio was developed by kmdev77 as a full-stack AWS cloud project to demonstrate real-world serverless engineering, AI integration, and frontend-backend orchestration.
