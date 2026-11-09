# TutorMVP Azure deployment

Terraform provisions an Azure Linux App Service for the FastAPI API and an Azure Static Web App for the Vite frontend. Supabase remains the database and Azure OpenAI remains the model provider; Terraform does not create either service.

## Prerequisites

- An Azure subscription with permission to create a resource group, App Service, and Static Web App.
- Azure CLI and Terraform 1.5 or newer.
- Supabase project credentials and Azure OpenAI endpoint, key, and deployment name.

## Provision

From the repository root in PowerShell:

```powershell
az login
Copy-Item terraform/terraform.tfvars.example terraform/terraform.tfvars
# Edit terraform/terraform.tfvars and provide your service credentials.
Set-Location terraform
terraform init
terraform plan
terraform apply
terraform output
Set-Location ..
```

The generated `terraform.tfvars` is ignored by Git. Terraform state contains deployment secrets, so keep the state file private and use a secured remote backend for team or production use.

## Deploy application code

Terraform creates the services; deploy the application packages after it completes. From the repository root, use the outputs to deploy the backend and frontend:

```powershell
$rg = terraform -chdir=terraform output -raw resource_group_name
$apiName = terraform -chdir=terraform output -raw backend_app_name
$apiUrl = terraform -chdir=terraform output -raw backend_url
$swaToken = terraform -chdir=terraform output -raw static_web_app_api_key

$zip = Join-Path $env:TEMP 'tutormvp-backend.zip'
Compress-Archive -Path backend\* -DestinationPath $zip -Force
az webapp deploy --resource-group $rg --name $apiName --src-path $zip --type zip

Push-Location frontend
$env:VITE_API_BASE_URL = "$apiUrl/api"
npm ci
npm run build
Pop-Location
npx --yes @azure/static-web-apps-cli deploy frontend\dist --deployment-token $swaToken --env production
```

The API URL is embedded into the Vite build, so rebuild the frontend if the API hostname changes. The API health endpoint is `/api/health`; Terraform prints the frontend and backend URLs as outputs.

For Linux/macOS, use equivalent `az`, `terraform`, `npm`, and Static Web Apps CLI commands.
