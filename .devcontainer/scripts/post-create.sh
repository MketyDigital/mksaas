#!/bin/bash
# =============================================================================
# Post-create script for Mkety Platform DevContainer
# This script runs after the container is created
# =============================================================================

set -e

echo "🚀 Setting up Mkety Platform development environment..."

cd /workspaces/*

echo "📦 Installing dependencies with pnpm..."
pnpm install --force

echo "🔧 Configuring environment..."

if [ ! -f .envrc ]; then
    echo "📝 Creating .envrc from .envrc.example..."
    cp .envrc.example .envrc
    sed -i 's|@localhost:5432|@db:5432|g' .envrc
    echo "✅ .envrc created with DevContainer settings"
else
    echo "ℹ️  .envrc already exists, skipping..."
fi

# Generate only Mkety-owned local session material. Provider credentials are never faked.
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local with auto-generated MKETY_AUTH_SESSION_SECRET..."
    MKETY_AUTH_SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
    echo "# Auto-generated for DevContainer" > .env.local
    echo "MKETY_AUTH_SESSION_SECRET=$MKETY_AUTH_SESSION_SECRET" >> .env.local
    echo "✅ .env.local created"
fi

direnv allow .

echo "🗄️  Waiting for database to be ready..."
until pg_isready -h db -p 5432 -U saas_app -d saas_template_dev > /dev/null 2>&1; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done

echo "🗄️  Applying database migrations..."
eval "$(direnv export bash)"
pnpm db:migrate

echo "📦 Setting up MinIO bucket..."
until curl -sf http://minio:9000/minio/health/live > /dev/null 2>&1; do
    echo "   Waiting for MinIO..."
    sleep 2
done

mc alias set saas-template http://minio:9000 saas_app saas_app123 2>/dev/null || true
mc mb saas-template/saas-template-uploads --ignore-existing 2>/dev/null || true
mc anonymous set download saas-template/saas-template-uploads 2>/dev/null || true

echo "🔧 Configuring MinIO CORS policy..."
cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-meta-*"]
    }
  ]
}
EOF
mc anonymous set-json /tmp/cors.json saas-template/saas-template-uploads 2>/dev/null || \
  echo "   (CORS may need manual setup via MinIO console)"
rm -f /tmp/cors.json

echo "✅ MinIO bucket 'saas-template-uploads' ready"

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "  ✅ Mkety Platform development environment is ready!"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "  Environment is managed by direnv (auto-loads when you cd into project)"
echo ""
echo "  Available commands:"
echo "    pnpm dev          - Start the vinext development server"
echo "    pnpm db:studio    - Open Drizzle Studio (database GUI)"
echo "    pnpm build        - Build the Cloudflare/vinext production artifact"
echo "    pnpm test         - Run tests"
echo "    pnpm lint         - Run linter"
echo ""
echo "  Database connection:"
echo "    Host: db (or localhost from outside container)"
echo "    Port: 5432"
echo "    User: saas_app"
echo "    Database: saas_template_dev"
echo ""
echo "  To customize environment: edit .env.local (overrides .envrc defaults)"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
