# TutorMVP — Azure Terraform Deployment Guide

This folder provisions the entire Microsoft Azure infrastructure for **TutorMVP** using Infrastructure as Code (Terraform).

## Resources Created

1. **Azure Resource Group** (`tutormvp-prod-xxxxxx-rg`)
2. **App Service Plan** (`Linux`, B1 or F1)
3. **Linux Web App** for FastAPI backend (`https://tutormvp-prod-xxxxxx-api.azurewebsites.net`)
4. **Azure Static Web App** for React/Vite frontend (`https://tutormvp-prod-xxxxxx-web.azurestaticapps.net`)
5. **App Settings & CORS** configured automatically to connect Frontend to Backend.

---

## Quickstart: Step-by-Step

### 1. Configure Variables
Copy `terraform.tfvars.example` to `terraform.tfvars`:
```bash
cp terraform.tfvars.example terraform.tfvars
```
Edit `terraform.tfvars` with your Supabase and Azure OpenAI credentials.

### 2. Run Terraform

#### Option A: In Azure Cloud Shell (Recommended — No local installation needed)
1. Open [portal.azure.com](https://portal.azure.com)
2. Click the **Cloud Shell** icon (`>_`) in the top menu bar.
3. Clone your repository:
   ```bash
   git clone <your-github-repo-url>
   cd TutorMVP/terraform
   cp terraform.tfvars.example terraform.tfvars
   nano terraform.tfvars # fill your values
   terraform init
   terraform plan
   terraform apply
   ```

#### Option B: On your local Windows machine
1. Install Terraform and Azure CLI:
   ```powershell
   winget install HashiCorp.Terraform
   winget install Microsoft.AzureCLI
   ```
2. Authenticate with Azure:
   ```powershell
   az login
   ```
3. Initialize and apply:
   ```powershell
   cd terraform
   terraform init
   terraform plan
   terraform apply
   ```

### 3. Deploy Application Code
Once Terraform provisions your infrastructure:
- **Backend**: Deploy using Azure CLI:
  ```powershell
  cd ../backend
  az webapp up --name <backend_name_from_output> --resource-group <rg_name_from_output> --runtime "PYTHON:3.11"
  ```
- **Frontend**: Connect the Static Web App to your GitHub repository in the Azure Portal or using GitHub Actions.

