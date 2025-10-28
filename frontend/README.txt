# 🧠 Image Resizer · AI
A full-stack cloud project built with AWS Lambda, S3, and Terraform — featuring a React + Tailwind UI that uploads, resizes, and previews images.  
This document records all key configuration details, issues encountered during setup, and verified resolutions.

---

## ⚙️ Architecture Overview

**Services used:**
- **S3** — Stores uploaded images (`uploads/`) and resized outputs (`thumbs/`)
- **Lambda (Node.js 18.x)** — Two functions:
  - `img-resizer-sign` → generates signed upload URLs for the frontend  
  - `img-resizer-process` → triggered by S3 to resize and save images
- **API Gateway** — Provides HTTPS access to the signer Lambda  
- **Terraform** — Deploys all AWS resources automatically  
- **Frontend (Vite + React + Tailwind)** — User interface for uploads and resizing

---

## 🧩 Directory structure

```
resizer-tf/
│
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── terraform.tfvars
│   ├── outputs.tf
│   └── lambda.tf
│
├── lambdas/
│   ├── signImage/
│   │   └── index.mjs
│   └── processImage/
│       ├── index.mjs
│       └── package.json
│
├── frontend/
│   └── (React app: Vite + Tailwind)
│
└── layers/
    └── sharp/   (will contain prebuilt sharp layer)
```

---

## 🧠 Challenges & Solutions

### 1. Terraform variable encoding error
**Error:**
```
Invalid character on terraform.tfvars line 1
```
**Fix:** Save file in **UTF-8** and ensure:
```
hf_token = "your_huggingface_token"
```

---

### 2. Terraform state lock error
**Error:**
```
Error acquiring the state lock.
```
**Fix:**
```bash
terraform force-unlock <LOCK_ID>
```

---

### 3. CORS Policy (Failed to fetch)
**Fix (JSON format):**
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

### 4. OPTIONS unsupported in CORS
Remove `"OPTIONS"` from `"AllowedMethods"` — S3 handles it automatically.

---

### 5. Lambda 500 Error (Sharp)
**Error:**
```
Could not load the "sharp" module using the linux-x64 runtime
```
**Fix:** Build a proper Linux `sharp` layer for Node 18 (see GitHub Actions workflow).

---

### 6. Docker not recognized
Install **Docker Desktop** → restart PowerShell → `docker --version`

---

### 7. Lambda Layer ARN access denied
Add IAM policy:
```json
{
  "Effect": "Allow",
  "Action": "lambda:GetLayerVersion",
  "Resource": "*"
}
```

---

### 8. AWS account verification delay
Wait 24–48 hours for Lambda/Cloud9 to unlock.

---

## 🧰 Sharp Layer Build (GitHub Actions)

Create `.github/workflows/build-sharp-layer.yml`:

```yaml
name: build-sharp-layer
on:
  workflow_dispatch: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: |
          mkdir -p layer/nodejs
          cd layer/nodejs
          npm init -y >/dev/null
          npm install sharp --omit=dev
          cd ..
          zip -r sharp-node18-layer.zip nodejs
      - uses: actions/upload-artifact@v4
        with:
          name: sharp-node18-layer
          path: layer/sharp-node18-layer.zip
```

Download the artifact → upload to Lambda → add as custom layer.

---

## 🌐 Frontend Setup
```bash
cd frontend
npm install
npx vite --host 127.0.0.1 --port 5174 --strictPort --open
```

---

## 🏗️ Terraform Deployment

```bash
cd terraform
terraform init
terraform apply -auto-approve
```

### Variables (terraform.tfvars)
```hcl
hf_token = "your_huggingface_api_token"
```

---

## ✅ Summary of Fixes

| Issue | Root Cause | Fix |
|-------|-------------|-----|
| Invalid `terraform.tfvars` | Wrong encoding | Save as UTF-8 |
| State locked | File handle in use | `terraform force-unlock` |
| CORS errors | XML format used | Replace with JSON |
| “OPTIONS not supported” | Unsupported by S3 | Remove it |
| Lambda 500 | Wrong sharp binary | Build Linux layer |
| Docker missing | Not installed | Install Docker |
| ARN access denied | IAM restrictions | Use custom layer |
| Account verification | AWS new-user delay | Wait 24–48 hrs |

---

## 🧾 Next Steps

1. Wait for AWS verification to finish  
2. Build `sharp-node18-layer.zip` via GitHub Actions  
3. Upload as Lambda layer  
4. Reattach to `img-resizer-process`  
5. Test via:
   ```bash
   aws logs tail /aws/lambda/img-resizer-process --since 10m --follow
   ```

---
