output "resource_group_name" {
  description = "Created Azure Resource Group name"
  value       = azurerm_resource_group.rg.name
}

output "backend_url" {
  description = "FastAPI backend base URL"
  value       = "https://${azurerm_linux_web_app.backend.default_hostname}"
}

output "backend_app_name" {
  description = "Linux Web App name used for application deployment"
  value       = azurerm_linux_web_app.backend.name
}

output "backend_health_check" {
  description = "FastAPI health check endpoint"
  value       = "https://${azurerm_linux_web_app.backend.default_hostname}/api/health"
}

output "frontend_url" {
  description = "Static Web App frontend URL"
  value       = "https://${azurerm_static_web_app.frontend.default_host_name}"
}

output "static_web_app_api_key" {
  description = "Deployment token for Static Web App (used in GitHub Actions or Azure SWA CLI)"
  value       = azurerm_static_web_app.frontend.api_key
  sensitive   = true
}

