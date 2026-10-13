#!/usr/bin/env bash
# One-shot setup for Ubuntu 22.04/24.04 (Alibaba Cloud ECS, KSA). Run as root:
#   sudo DOMAIN=petty.example.com ADMIN_EMAIL=a@x.com ADMIN_NAME="Ahmed" bash deploy/setup-server.sh
# Safe to re-run: it never overwrites an existing .env or database.
set -euo pipefail

: "${DOMAIN:?Set DOMAIN, e.g. DOMAIN=petty.example.com (its DNS A record must point to this server)}"
: "${ADMIN_EMAIL:?Set ADMIN_EMAIL}"
ADMIN_NAME="${ADMIN_NAME:-Procurement Manager}"
REPO="${REPO:-https://github.com/alisaeed-exp2/Proc-Petty-Cash.git}"
APP_USER=akcc
APP_DIR=/opt/akcc
DB_NAME=akcc
DB_USER=akcc

echo "== 1/8 Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl ca-certificates nginx postgresql ufw certbot python3-certbot-nginx openssl
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "== 2/8 Swap (the build needs memory; skipped if swap exists)"
if [ "$(swapon --show | wc -l)" -eq 0 ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 3/8 App user and code"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
if [ ! -d "$APP_DIR/.git" ]; then git clone "$REPO" "$APP_DIR"; fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "== 4/8 Database (local only)"
if [ ! -f "$APP_DIR/.env" ]; then
  DB_PASS="$(openssl rand -hex 16)"
  ADMIN_PASS="$(openssl rand -hex 6)Aa1"
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  cat > "$APP_DIR/.env" <<ENV
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"
DIRECT_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_TRUST_HOST=true
APP_URL="https://$DOMAIN"
NEXT_PUBLIC_APP_URL="https://$DOMAIN"
ADMIN_EMAIL="$ADMIN_EMAIL"
ADMIN_NAME="$ADMIN_NAME"
ADMIN_INITIAL_PASSWORD="$ADMIN_PASS"

# Invoice files / logos (S3-compatible: Alibaba OSS or MinIO). Required for uploads.
# S3_ENDPOINT=""
# S3_BUCKET=""
# S3_ACCESS_KEY_ID=""
# S3_SECRET_ACCESS_KEY=""
# S3_REGION=""

# Optional
# ANTHROPIC_API_KEY=""
# RESEND_API_KEY=""
# EMAIL_FROM=""
ENV
  chmod 600 "$APP_DIR/.env"; chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  echo ">>> First admin: $ADMIN_EMAIL  /  password: $ADMIN_PASS   (you must change it at first login)"
else
  echo ".env exists, keeping it."
fi

echo "== 5/8 Build and migrate"
cat > /usr/local/bin/akcc-deploy <<'DEP'
#!/usr/bin/env bash
# Update to the latest code: akcc-deploy
set -euo pipefail
cd /opt/akcc
sudo -u akcc git pull --ff-only
sudo -u akcc npm ci
sudo -u akcc bash -c 'set -a; . ./.env; set +a; npx prisma generate && NODE_OPTIONS=--max-old-space-size=2048 npm run build && node scripts/bootstrap.cjs'
systemctl restart akcc
echo "deployed"
DEP
chmod +x /usr/local/bin/akcc-deploy

echo "== 6/8 systemd service"
cat > /etc/systemd/system/akcc.service <<UNIT
[Unit]
Description=AKCC Petty Cash
After=network.target postgresql.service

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/npx next start -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable akcc >/dev/null
/usr/local/bin/akcc-deploy

echo "== 7/8 nginx + HTTPS"
cat > /etc/nginx/sites-available/akcc <<NGX
server {
  listen 80;
  server_name $DOMAIN;
  client_max_body_size 25m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 120s;
  }
}
NGX
ln -sf /etc/nginx/sites-available/akcc /etc/nginx/sites-enabled/akcc
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
if [ -n "${CERT_EMAIL:-}" ]; then
  certbot --nginx -d "$DOMAIN" -m "$CERT_EMAIL" --agree-tos --non-interactive --redirect
else
  echo "Skipped HTTPS. Run: certbot --nginx -d $DOMAIN   (or set CERT_EMAIL and re-run)"
fi

echo "== 8/8 Firewall and nightly backup"
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null
install -d -o postgres -g postgres /var/backups/akcc
cat > /usr/local/bin/akcc-backup <<'BAK'
#!/usr/bin/env bash
set -euo pipefail
f=/var/backups/akcc/akcc-$(date +%F).sql.gz
sudo -u postgres pg_dump akcc | gzip > "$f"
find /var/backups/akcc -name '*.sql.gz' -mtime +14 -delete
BAK
chmod +x /usr/local/bin/akcc-backup
echo '30 2 * * * root /usr/local/bin/akcc-backup' > /etc/cron.d/akcc-backup
echo "Done. Open https://$DOMAIN/en/login"
