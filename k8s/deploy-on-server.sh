#!/usr/bin/env bash
set -e

# ==========================================================
# Shree Pooja Ghar - 100% Automated K3s Deployment Script
# ==========================================================

echo "=================================================="
echo "🚀 Starting 100% Automated Deployment for K3s..."
echo "=================================================="

# Check kubectl or k3s kubectl
if command -v kubectl &> /dev/null; then
    KCTL="kubectl"
elif command -v k3s &> /dev/null; then
    KCTL="sudo k3s kubectl"
else
    echo "❌ Error: Neither 'kubectl' nor 'k3s' command was found."
    exit 1
fi

# Ensure openssl is installed for generating keys
if ! command -v openssl &> /dev/null; then
    echo "📦 Installing openssl..."
    sudo apt-get update -qq && sudo apt-get install -y -qq openssl
fi

# 1. Check if secrets already exist in the cluster to prevent desynchronization
echo "🔑 Checking cluster secrets..."
if $KCTL get secret shree-pooja-secrets -n shree-pooja &> /dev/null; then
    EXISTING_PASS=$($KCTL get secret shree-pooja-secrets -n shree-pooja -o jsonpath='{.data.POSTGRES_PASSWORD}' 2>/dev/null | base64 -d 2>/dev/null || true)
    EXISTING_KEY=$($KCTL get secret shree-pooja-secrets -n shree-pooja -o jsonpath='{.data.PII_ENCRYPTION_KEY}' 2>/dev/null | base64 -d 2>/dev/null || true)
    EXISTING_JWT=$($KCTL get secret shree-pooja-secrets -n shree-pooja -o jsonpath='{.data.JWT_SECRET}' 2>/dev/null | base64 -d 2>/dev/null || true)

    if [ -n "$EXISTING_PASS" ]; then
        sed -i "s/change_this_postgres_secure_password/$EXISTING_PASS/g" k8s/secret.yaml
        echo "🔒 Preserved existing cluster POSTGRES_PASSWORD"
    fi
    if [ -n "$EXISTING_KEY" ]; then
        sed -i "s/change_this_pii_encryption_key_32_bytes_hex/$EXISTING_KEY/g" k8s/secret.yaml
        echo "🔒 Preserved existing cluster PII_ENCRYPTION_KEY"
    fi
    if [ -n "$EXISTING_JWT" ]; then
        sed -i "s/change_this_jwt_secret_generate_random_key_64_chars/$EXISTING_JWT/g" k8s/secret.yaml
        echo "🔒 Preserved existing cluster JWT_SECRET"
    fi
fi

if grep -q "change_this_pii_encryption_key_32_bytes_hex" k8s/secret.yaml; then
    NEW_KEY=$(openssl rand -hex 32)
    sed -i "s/change_this_pii_encryption_key_32_bytes_hex/$NEW_KEY/g" k8s/secret.yaml
    echo "✅ Generated unique 32-byte PII_ENCRYPTION_KEY"
fi

if grep -q "change_this_jwt_secret_generate_random_key_64_chars" k8s/secret.yaml; then
    NEW_JWT=$(openssl rand -hex 32)
    sed -i "s/change_this_jwt_secret_generate_random_key_64_chars/$NEW_JWT/g" k8s/secret.yaml
    echo "✅ Generated unique JWT_SECRET"
fi

if grep -q "change_this_postgres_secure_password" k8s/secret.yaml; then
    NEW_PG_PASS=$(openssl rand -hex 16)
    sed -i "s/change_this_postgres_secure_password/$NEW_PG_PASS/g" k8s/secret.yaml
    echo "✅ Generated secure POSTGRES_PASSWORD"
fi

# 2. Ensure Docker is installed and running
if ! command -v docker &> /dev/null && ! command -v nerdctl &> /dev/null; then
    echo "📦 Docker not detected. Installing docker.io automatically..."
    sudo apt-get update -qq && sudo apt-get install -y docker.io
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER" 2>/dev/null || true
fi

# 3. Build backend and frontend images
echo "📦 Building container images locally..."
if command -v docker &> /dev/null; then
    echo "🔨 Building backend image..."
    sudo docker build -t shreepoojaghar-backend:latest ./backend

    echo "🔨 Building frontend image..."
    sudo docker build -t shreepoojaghar-frontend:latest ./frontend

    echo "📥 Importing images directly into K3s containerd..."
    sudo docker save shreepoojaghar-backend:latest | sudo k3s ctr images import -
    sudo docker save shreepoojaghar-frontend:latest | sudo k3s ctr images import -
elif command -v nerdctl &> /dev/null; then
    echo "🔨 Building with nerdctl directly in k3s containerd..."
    sudo nerdctl -n k8s.io build -t shreepoojaghar-backend:latest ./backend
    sudo nerdctl -n k8s.io build -t shreepoojaghar-frontend:latest ./frontend
fi

# 4. Apply manifests to K3s
echo "☸️ Applying Kubernetes manifests to K3s..."
$KCTL apply -k k8s/

echo "🔄 Restarting pods to pick up any updated images..."
$KCTL rollout restart deployment/backend-deployment -n shree-pooja 2>/dev/null || true
$KCTL rollout restart deployment/frontend-deployment -n shree-pooja 2>/dev/null || true

echo "⏳ Waiting for pods to initialize..."
$KCTL wait --namespace shree-pooja --for=condition=ready pod -l app=postgres --timeout=180s || true
$KCTL wait --namespace shree-pooja --for=condition=ready pod -l app=redis --timeout=180s || true
$KCTL wait --namespace shree-pooja --for=condition=ready pod -l app=backend --timeout=240s || true
$KCTL wait --namespace shree-pooja --for=condition=ready pod -l app=frontend --timeout=180s || true

echo "=================================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=================================================="
echo "Active Pods in shree-pooja namespace:"
$KCTL get pods -n shree-pooja
echo ""
echo "Autoscalers (HPA) in shree-pooja namespace:"
$KCTL get hpa -n shree-pooja
echo ""
echo "Active Services in shree-pooja namespace:"
$KCTL get svc -n shree-pooja
echo ""
echo "🌐 Cloudflare Tunnel Service URL:"
echo "   http://frontend-service.shree-pooja.svc.cluster.local:3000"
echo ""
echo "🔐 Default Login Credentials for https://shreepoojaghar.labstackops.top:"
echo "   Email:    admin@shreepooja.com"
echo "   Password: admin123"
echo "=================================================="
