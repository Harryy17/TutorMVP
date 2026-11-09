variable "resource_group_name" {
  description = "Name of the Azure Resource Group"
  type        = string
  default     = "tutormvp-aks-rg"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "eastus"
}

variable "cluster_name" {
  description = "Name of the AKS cluster"
  type        = string
  default     = "tutormvp-aks"
}

variable "acr_prefix" {
  description = "Prefix for Azure Container Registry (must be alphanumeric only)"
  type        = string
  default     = "tutormvpacr"
}

variable "node_count" {
  description = "Number of Kubernetes worker nodes"
  type        = number
  default     = 2
}

variable "vm_size" {
  description = "VM size for the nodes (Standard_D2s_v4 is widely supported in Azure eastus for AKS)"
  type        = string
  default     = "Standard_D2s_v4"
}

