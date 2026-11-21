# K3s Deployment Guide - Shree Pooja Ghar

This directory contains production-ready Kubernetes manifests designed for lightweight clusters such as **K3s** on **Oracle Cloud Free Tier** (or any Ubuntu/Debian server running k3s).

---

## 🏗️ Architecture Overview

The deployment consists of:
- **`postgres-deployment` + `postgres-pvc` (5GB)**: PostgreSQL database with automated local storage persistence via k3s `local-path`.
- **`redis-deployment` + `redis-pvc` (2GB)**: Redis queue and cache for BullMQ background workers.
- **`backend-deployment` + `backend-uploads-pvc` (5GB) + `backend-whatsapp-pvc` (1GB)**: Express backend with Prisma migration and seeding on launch, session storage, and health checks.
- **`frontend-deployment`**: Next.js 16 web application.
- **`shree-pooja-ingress`**: Uses K3s's built-in **Traefik** reverse proxy to route `/` to Frontend, `/api/v1` to Backend, and `/uploads` to Backend. Pre-configured for domain `shreepoojaghar.labstackops.top`.

---

## 🚀 Quick Deployment (3 Steps)

### Step 1: Clone or Copy Project to your Oracle Server
```bash
git clone <your-repo-url> shreepoojaghar
cd shreepoojaghar
```

### Step 2: Configure Secrets
Review and edit [k8s/secret.yaml](secret.yaml):
- Set `POSTGRES_PASSWORD`
- Set `JWT_SECRET`
- Set `PII_ENCRYPTION_KEY` (Generate with `openssl rand -hex 32`)

### Step 3: Run the Deploy Script
```bash
chmod +x k8s/deploy-on-server.sh
./k8s/deploy-on-server.sh
```

---

## 🌐 Cloudflare Tunnel Setup (`shreepoojaghar.labstackops.top`)

Since you already have `cloudflared` tunnel configured on your server with the domain `labstackops.top`, you do **NOT** need to open ports 80/443 on Oracle Cloud firewall! Cloudflare Tunnel establishes an outbound connection and secures the site with free HTTPS.

### In Cloudflare Zero Trust Dashboard:
1. Go to **Networks** > **Tunnels** > Select your active tunnel.
2. Click **Edit** > Go to the **Public Hostnames** tab.
3. Click **Add a public hostname**:
   - **Subdomain:** `shreepoojaghar`
   - **Domain:** `labstackops.top`
   - **Path:** *(leave empty)*
   - **Type:** `HTTP`
   - **URL:** `localhost:80` (or `127.0.0.1:80`)
4. Click **Save hostname**.

*(Note: K3s's Traefik ingress controller listens on port 80 on the host, so routing `shreepoojaghar.labstackops.top` to `localhost:80` automatically routes into your K3s cluster!)*

---

## 🔍 Useful Verification Commands

Check running pods:
```bash
sudo k3s kubectl get pods -n shree-pooja
```

View backend startup & Prisma logs:
```bash
sudo k3s kubectl logs -n shree-pooja -l app=backend -f
```

View ingress routing:
```bash
sudo k3s kubectl get ingress -n shree-pooja
```
