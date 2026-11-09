# TutorMVP — Kubernetes Deployment on Azure (AKS)

This directory contains the Kubernetes manifests to deploy TutorMVP onto an **Azure Kubernetes Service (AKS)** cluster using **Azure Container Registry (ACR)**.

## Architecture

- **Namespace**: `tutormvp`
- **Backend Deployment**: 2 replicas running FastAPI on port 8000.
- **Backend Service**: Internal `ClusterIP` on `backend-service:8000`.
- **Frontend Deployment**: 2 replicas running Nginx + Vite/React on port 80.
- **Frontend Service**: External `LoadBalancer` which automatically gets an Azure Public IP address.
  - Nginx automatically proxies `/api/*` to `backend-service:8000/api/*` internally, preventing CORS issues.

