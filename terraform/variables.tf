variable "app_name" {
  description = "Base name for TutorMVP resources"
  type        = string
  default     = "tutormvp"
}

variable "environment" {
  description = "Deployment environment (e.g. dev, prod)"
  type        = string
  default     = "prod"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "eastus"
}

variable "static_web_app_location" {
  description = "Azure region for Static Web App (e.g. eastus2, westeurope, centralus)"
  type        = string
  default     = "eastus2"
}

variable "app_service_sku" {
  description = "App Service Plan pricing tier (e.g. F1 for Free, B1 for Basic, S1 for Standard)"
  type        = string
  default     = "B1"
}

# ── Environment Variables for Backend ───────────────────────────────────────
variable "postgres_url" {
  description = "Supabase / PostgreSQL connection string with pgvector"
  type        = string
  sensitive   = true
  default     = ""
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  default     = ""
}

variable "supabase_key" {
  description = "Supabase publishable or service role key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "azure_openai_endpoint" {
  description = "Azure OpenAI endpoint URL (e.g. https://your-resource.openai.azure.com/)"
  type        = string
  default     = ""
}

variable "azure_openai_api_key" {
  description = "Azure OpenAI API Key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "azure_openai_deployment_name" {
  description = "Azure OpenAI deployment name (e.g. gpt 6.0 sol)"
  type        = string
  default     = "gpt 6.0 sol"
}

variable "secret_key" {
  description = "Application secret key for JWT & session security"
  type        = string
  sensitive   = true
  default     = "indie-tutor-study-room-secret-key-2026"
}

