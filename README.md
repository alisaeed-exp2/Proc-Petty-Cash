# AKCC Petty Cash Management

Bilingual (Arabic / English) petty-cash system for Al Khalejiah Catering Company: funding, allocations to
purchase agents, invoice upload with optional automatic reading, two-step approval, dashboards and reports.

Stack: Next.js 15, PostgreSQL, Prisma. Runs on a single Ubuntu server (app and database together).

---

# Installation guide: Ubuntu server with systemd

Follow the steps in order. Every command is meant to be copied as is. Lines that start with `#` are comments.
Replace the values written in CAPITAL LETTERS or like `petty.yourcompany.com` / `you@company.com` with your own.

**Server size:** at least 2 vCPU, 4 GB RAM, 40 GB disk, Ubuntu 22.04 or 24.04.

## Fast path (one script)

If you only want it installed, run the script and then continue at [Step 10](#step-10--first-sign-in):

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/alisaeed-exp2/Proc-Petty-Cash.git /tmp/akcc-setup
sudo DOMAIN=petty.yourcompany.com ADMIN_EMAIL=you@company.com ADMIN_NAME="Your Name" \
     CERT_EMAIL=you@company.com bash /tmp/akcc-setup/deploy/setup-server.sh
```

It does steps 1 to 9 below and prints the first admin password. Use the manual steps if you want to
understand or customize what it does.

## Before you start

1. Create the server (for example an Alibaba Cloud ECS in the Riyadh region) with Ubuntu 22.04 or 24.04.
2. In the cloud security group allow inbound **22** (your own IP only), **80** and **443**. Do **not** open 5432.
3. Create a DNS **A record**, for example `petty.yourcompany.com`, pointing to the server's public IP.
   HTTPS in step 9 needs this to work. Check with `ping petty.yourcompany.com`.
4. SSH into the server and become root for the setup: `sudo -i`

## Step 1 — Install the packages

```bash
apt update
apt install -y git curl ca-certificates openssl nginx postgresql ufw certbot python3-certbot-nginx

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

node -v    # must show v20 or higher
```

## Step 2 — Add swap (needed on 4 GB servers for the build)

Skip this if `swapon --show` already lists a swap area.

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## Step 3 — Create the app user and get the code

```bash
useradd --system --create-home --shell /bin/bash akcc
git clone https://github.com/alisaeed-exp2/Proc-Petty-Cash.git /opt/akcc
chown -R akcc:akcc /opt/akcc

# folder for the "Local disk" file-storage option (chosen later in System settings)
install -d -o akcc -g akcc /var/lib/akcc/files
```

## Step 4 — Create the database

Pick a database password. **Use only letters and digits** (no `$ ! \ ' " #`), because it goes into a URL and a config file.
In the commands below, replace `DB_PASSWORD` with it.

```bash
sudo -u postgres psql -c "CREATE USER akcc WITH PASSWORD 'DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE akcc OWNER akcc;"

# test: must print a row containing the number 1
psql "postgresql://akcc:DB_PASSWORD@127.0.0.1:5432/akcc" -c "select 1;"
```

If the test says the password is wrong, run `sudo -u postgres psql -c "ALTER USER akcc WITH PASSWORD 'DB_PASSWORD';"` and test again.

## Step 5 — Create the configuration file

First generate the login secret and copy its output:

```bash
openssl rand -base64 32
```

Then create the file with a text editor:

```bash
nano /opt/akcc/.env
```

Paste this, replace the values, then save (Ctrl+O, Enter) and exit (Ctrl+X):

```env
DATABASE_URL="postgresql://akcc:DB_PASSWORD@127.0.0.1:5432/akcc"
DIRECT_URL="postgresql://akcc:DB_PASSWORD@127.0.0.1:5432/akcc"
AUTH_SECRET="PASTE_THE_OUTPUT_OF_openssl_rand_HERE"
AUTH_TRUST_HOST=true
APP_URL="https://petty.yourcompany.com"

# first administrator, created once by step 6
ADMIN_EMAIL="you@company.com"
ADMIN_NAME="Your Name"
ADMIN_INITIAL_PASSWORD="ChooseAPassword12345"
```

Lock the file down:

```bash
chmod 600 /opt/akcc/.env
chown akcc:akcc /opt/akcc/.env
```

Notes:
- Only these values live in the file. File storage, the Anthropic key and the email settings are entered later in the
  app, on the **System settings** page (saved encrypted in the database).
- **Never change `AUTH_SECRET` later.** Keys saved in System settings are encrypted with it and would become unreadable.
- Use letters and digits only in `ADMIN_INITIAL_PASSWORD`. You must change it at the first sign-in anyway.

## Step 6 — Install, build and create the tables

```bash
cd /opt/akcc
sudo -u akcc npm ci
sudo -u akcc bash -c 'set -a; . ./.env; set +a; npx prisma generate && NODE_OPTIONS=--max-old-space-size=2048 npm run build'
sudo -u akcc bash -c 'set -a; . ./.env; set +a; node scripts/bootstrap.cjs'
```

The last command creates all database tables and the first administrator. Its output must contain
`Created admin user: you@company.com`. The build takes a few minutes.

## Step 7 — Run the app as a systemd service

Create the service file:

```bash
nano /etc/systemd/system/akcc.service
```

Paste this, save and exit:

```ini
[Unit]
Description=AKCC Petty Cash
After=network.target postgresql.service

[Service]
User=akcc
WorkingDirectory=/opt/akcc
EnvironmentFile=/opt/akcc/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/npx next start -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Start it and make it start at every boot:

```bash
systemctl daemon-reload
systemctl enable --now akcc
systemctl status akcc --no-pager        # must say: active (running)
curl -I http://127.0.0.1:3000/en/login  # must answer 200
```

The app listens only on `127.0.0.1:3000`; nginx (next step) is the public door.
Useful commands: `systemctl restart akcc`, `systemctl stop akcc`, `journalctl -u akcc -f` (live logs).

## Step 8 — nginx (public web server)

```bash
nano /etc/nginx/sites-available/akcc
```

Paste this, change `server_name` to your real domain, save and exit:

```nginx
server {
  listen 80;
  server_name petty.yourcompany.com;
  client_max_body_size 55m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
  }
}
```

Enable it:

```bash
ln -sf /etc/nginx/sites-available/akcc /etc/nginx/sites-enabled/akcc
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## Step 9 — HTTPS and firewall

```bash
certbot --nginx -d petty.yourcompany.com -m you@company.com --agree-tos --non-interactive --redirect

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

The certificate renews automatically. Test the renewal with `certbot renew --dry-run`.

## Step 10 — First sign-in

1. Open `https://petty.yourcompany.com/en/login` (Arabic: `/ar/login`).
2. Sign in with `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD`. The app asks you to choose a new password.
3. The first account is a **Procurement Manager**. To open the **System settings** page and to change other
   users' roles you need the **System Administrator** role. Promote your account once:

   ```bash
   sudo -u postgres psql -d akcc -c "UPDATE \"User\" SET role='SYSTEM_ADMIN' WHERE email='you@company.com';"
   ```

   Then sign out and sign in again.

## Step 11 — Configure the system (inside the app)

1. **System settings → File storage** (required for invoice and logo uploads). Choose one:
   - **Local disk on this server:** set the folder to `/var/lib/akcc/files`.
   - **S3-compatible bucket:** fill in endpoint, bucket, access key and secret (Alibaba OSS, MinIO, AWS S3).
   - Save, then press **Test storage**. It must say storage works.
2. **System settings → Automatic invoice reading:** paste the Anthropic API key (optional; without it agents type the
   details by hand). Invoice images are sent to Anthropic for reading, so leave this empty if your policy forbids
   data leaving the country.
3. **System settings → Email notifications:** Resend API key and sender address (optional), and the
   **Application URL** used in email links.
4. **Companies & projects:** add the companies, their projects / locations / departments, logo and required signatures.
5. **Users:** create the Expense Controller, purchase agents and others, and assign each user to their companies.

Switching the file-storage choice later does not move files that are already saved.

## Step 12 — Backups

The database and the invoice files are the data that matter. Create the backup script:

```bash
install -d -o postgres -g postgres /var/backups/akcc
nano /usr/local/bin/akcc-backup
```

Paste this, save and exit:

```bash
#!/usr/bin/env bash
set -euo pipefail
f=/var/backups/akcc/akcc-$(date +%F).sql.gz
sudo -u postgres pg_dump akcc | gzip > "$f"
if [ -d /var/lib/akcc/files ] && [ -n "$(ls -A /var/lib/akcc/files 2>/dev/null)" ]; then
  tar -czf "/var/backups/akcc/files-$(date +%F).tar.gz" -C /var/lib/akcc files
fi
find /var/backups/akcc \( -name '*.sql.gz' -o -name 'files-*.tar.gz' \) -mtime +14 -delete
```

Make it run every night at 02:30 and test it once:

```bash
chmod +x /usr/local/bin/akcc-backup
echo '30 2 * * * root /usr/local/bin/akcc-backup' > /etc/cron.d/akcc-backup
/usr/local/bin/akcc-backup && ls -lh /var/backups/akcc
```

This keeps 14 days of nightly backups on the server. A backup on the same disk does not protect you if the disk is
lost: also copy `/var/backups/akcc` somewhere else regularly and enable disk snapshots in the cloud console.
If you use an S3 bucket for files, back up the bucket in the cloud console as well.

**Restore the database:**

```bash
systemctl stop akcc
sudo -u postgres dropdb akcc && sudo -u postgres createdb -O akcc akcc
gunzip -c /var/backups/akcc/akcc-YYYY-MM-DD.sql.gz | sudo -u postgres psql akcc
systemctl start akcc
```

## Updating to a new version

Take a backup first (`/usr/local/bin/akcc-backup`), then:

```bash
cd /opt/akcc
sudo -u akcc git pull --ff-only
sudo -u akcc npm ci
sudo -u akcc bash -c 'set -a; . ./.env; set +a; npx prisma generate && NODE_OPTIONS=--max-old-space-size=2048 npm run build && node scripts/bootstrap.cjs'
systemctl restart akcc
```

`bootstrap.cjs` also applies database changes safely: it never drops data, and it stops with an error if a change would.

## Troubleshooting

| Problem | What to check |
|---|---|
| Site not reachable | `systemctl status akcc nginx`, cloud security group ports 80/443, the DNS record |
| 502 Bad Gateway | The app is down: `journalctl -u akcc -n 50` |
| "Authentication failed ... database" | Wrong password in `DATABASE_URL`; re-test with the `psql` command in step 4 |
| Cannot sign in | List the users (below) and use the exact email shown; if needed reset the password (below) |
| Uploads fail | System settings → File storage → Test storage; for Local disk the folder must be owned by `akcc` |
| Build killed or freezes | Not enough memory: do step 2 (swap) |
| Saved keys stopped working | `AUTH_SECRET` was changed; restore the old value, or enter the keys again in System settings |

List the users:

```bash
sudo -u postgres psql -d akcc -c 'SELECT email, role, active FROM "User";'
```

Reset a password (edit the email and the new password first; letters and digits only):

```bash
cd /opt/akcc
cat > /tmp/reset-password.cjs <<'JS'
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const email = "you@company.com";
const password = "ChangeMe12345";
(async () => {
  const db = new PrismaClient();
  await db.user.update({
    where: { email },
    data: { passwordHash: await bcrypt.hash(password, 12), active: true, mustChangePassword: true },
  });
  console.log("password reset for", email);
  await db.$disconnect();
})();
JS
cp /tmp/reset-password.cjs /opt/akcc/reset-password.cjs
chown akcc:akcc /opt/akcc/reset-password.cjs
sudo -u akcc bash -c 'set -a; . ./.env; set +a; node reset-password.cjs'
rm /opt/akcc/reset-password.cjs /tmp/reset-password.cjs
```

---

# For developers

```bash
npm install
cp .env.example .env     # set DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_*
set -a; source .env; set +a
node scripts/bootstrap.cjs
npm run dev              # http://localhost:3000/en/login
npm test                 # unit tests
```

- Money is stored as integer halalas (SAR only); the ledger is append-only.
- Messages live in `messages/<en|ar>/*.json`. UI design tokens are in `src/app/globals.css`.
- Runtime settings (file storage, API keys, email) are saved in the database and edited under System settings;
  environment variables of the same name are used as a fallback.
