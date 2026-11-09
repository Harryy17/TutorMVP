terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# Unique suffix for globally unique resource names
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  resource_prefix = "${var.app_name}-${var.environment}-${random_string.suffix.result}"
}

# 1. Resource Group
resource "azurerm_resource_group" "rg" {
  name     = "${local.resource_prefix}-rg"
  location = var.location

  tags = {
    Project     = "TutorMVP"
    Environment = var.environment
  }
}

# 2. App Service Plan (Linux)
resource "azurerm_service_plan" "asp" {
  name                = "${local.resource_prefix}-asp"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku

  tags = {
    Project     = "TutorMVP"
    Environment = var.environment
  }
}

# 3. Linux Web App for FastAPI Backend
resource "azurerm_linux_web_app" "backend" {
  name                = "${local.resource_prefix}-api"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_service_plan.asp.location
  service_plan_id     = azurerm_service_plan.asp.id

  site_config {
    always_on = var.app_service_sku == "F1" ? false : true

    application_stack {
      python_version = "3.11"
    }

    # Azure Linux startup command for FastAPI
    app_command_line = "cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000"

    cors {
      allowed_origins     = ["*"]
      support_credentials = false
    }
  }

  app_settings = {
    "SCM_DO_BUILD_DURING_DEPLOYMENT" = "true"
    "PORT"                           = "8000"
    "SECRET_KEY"                     = var.secret_key
    "POSTGRES_URL"                   = var.postgres_url
    "SUPABASE_URL"                   = var.supabase_url
    "SUPABASE_KEY"                   = var.supabase_key
    "AZURE_OPENAI_ENDPOINT"          = var.azure_openai_endpoint
    "AZURE_OPENAI_API_KEY"           = var.azure_openai_api_key
    "AZURE_OPENAI_DEPLOYMENT_NAME"   = var.azure_openai_deployment_name
  }

  tags = {
    Project     = "TutorMVP"
    Environment = var.environment
    Component   = "Backend"
  }
}

# 4. Azure Static Web App for Frontend (React / Vite)
resource "azurerm_static_web_app" "frontend" {
  name                = "${local.resource_prefix}-web"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.static_web_app_location
  sku_tier            = "Free"
  sku_size            = "Free"

  tags = {
    Project     = "TutorMVP"
    Environment = var.environment
    Component   = "Frontend"
  }
}

# Configure Frontend API Base URL in Static Web App Application Settings
resource "azurerm_static_web_app_app_settings" "frontend_settings" {
  static_web_app_id = azurerm_static_web_app.frontend.id
  app_settings = {
    "VITE_API_BASE_URL" = "https://${azurerm_linux_web_app.backend.default_hostname}/api"
  }
}

