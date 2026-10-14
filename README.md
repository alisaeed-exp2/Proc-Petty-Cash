# AKCC Petty Cash Management

Bilingual (Arabic / English) petty-cash system for Al Khalejiah Catering Company: funding, allocations to
purchase agents, invoice upload with optional automatic reading, two-step approval, dashboards and reports.

Stack: Next.js 15, PostgreSQL, Prisma. Runs on a single Ubuntu server (app and database together).

---

# Installation guide: Ubuntu server with systemd

Follow the steps in order. Commands are meant to be copied, but **every `<PLACEHOLDER>` must be replaced
with your own value first, including the angle brackets** (for example `<DOMAIN_NAME>` becomes your real domain).
Lines that start with `#` are comments.

**Server size:** at least 2 vCPU, 4 GB RAM, 40 GB disk, Ubuntu 22.04 or 24.04.

## Values you choose

Decide these before you start and use the same value everywhere the placeholder appears.

| Placeholder | What it is |
|---|---|
| `<REPOSITORY_URL>` | The Git address of this application's repository |
| `<APP_DIRECTORY>` | Folder on the server where the application code is installed |
| `<APP_SYSTEM_USER>` | Linux system user that runs the application (not a person's login) |
| `<SERVICE_NAME>` | Name of the systemd service |
| `<DATABASE_NAME>` | Name of the PostgreSQL database |
| `<DATABASE_USER>` | PostgreSQL user the application connects as |
| `<DATABASE_PASSWORD>` | Password of that PostgreSQL user. Letters and digits only |
| `<AUTH_SECRET>` | Random secret for sign-in; generated in step 5 |
| `<DOMAIN_NAME>` | The web address people will open, for example a sub-domain of your company domain |
| `<CERTIFICATE_EMAIL>` | Email address that receives HTTPS certificate notices |
| `<ADMIN_EMAIL>` | Email address of the first administrator (their sign-in name) |
| `<ADMIN_NAME>` | Full name of the first administrator |
| `<ADMIN_PASSWORD>` | Temporary password of the first administrator. Letters and digits only |
| `<FILES_DIRECTORY>` | Folder for invoice files when "Local disk" storage is used |
| `<BACKUP_DIRECTORY>` | Folder where nightly backups are written |
| `<APP_PORT>` | Local port the application listens on (a free port on the server, not opened to the internet) |

## Fast path (one script)

If you only want it installed, run the setup script that ships with the application, then continue at
[Step 10](#step-10--first-sign-in). The script uses its own built-in defaults for the system user, directories,
database names and service name (see the top of `deploy/setup-server.sh`) and generates the passwords itself.

```bash
sudo apt update && sudo apt install -y git
# clone the application from the repository into a temporary folder
git clone <REPOSITORY_URL> /tmp/app-setup
sudo DOMAIN=<DOMAIN_NAME> ADMIN_EMAIL=<ADMIN_EMAIL> ADMIN_NAME="<ADMIN_NAME>" \
     CERT_EMAIL=<CERTIFICATE_EMAIL> bash /tmp/app-setup/deploy/setup-server.sh
```

It prints the first administrator's password once. Use the manual steps below if you want to choose your own
names or understand what it does.

## Before you start

1. Create the server (for example an Alibaba Cloud ECS in the Riyadh region) with Ubuntu 22.04 or 24.04.
2. In the cloud security group allow inbound **22** (your own IP only), **80** and **443**.
   Do **not** open the database port (5432) or `<APP_PORT>`.
3. Create a DNS **A record** for `<DOMAIN_NAME>` pointing to the server's public IP.
   HTTPS in step 9 needs this to work. Check with `ping <DOMAIN_NAME>`.
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

## Step 3 — Create the system user and get the code

```bash
# system user that will run the application
useradd --system --create-home --shell /bin/bash <APP_SYSTEM_USER>

# clone the application from the repository
git clone <REPOSITORY_URL> <APP_DIRECTORY>
chown -R <APP_SYSTEM_USER>:<APP_SYSTEM_USER> <APP_DIRECTORY>

# folder for the "Local disk" file-storage option (chosen later in System settings)
install -d -o <APP_SYSTEM_USER> -g <APP_SYSTEM_USER> <FILES_DIRECTORY>
```

## Step 4 — Create the database

Choose `<DATABASE_PASSWORD>` now. **Use only letters and digits** (no `$ ! \ ' " #`),
because it goes into a URL and a configuration file.

```bash
sudo -u postgres psql -c "CREATE USER <DATABASE_USER> WITH PASSWORD '<DATABASE_PASSWORD>';"
sudo -u postgres psql -c "CREATE DATABASE <DATABASE_NAME> OWNER <DATABASE_USER>;"

# test: must print a row containing the number 1
psql "postgresql://<DATABASE_USER>:<DATABASE_PASSWORD>@127.0.0.1:5432/<DATABASE_NAME>" -c "select 1;"
```

If the test says the password is wrong, run
`sudo -u postgres psql -c "ALTER USER <DATABASE_USER> WITH PASSWORD '<DATABASE_PASSWORD>';"` and test again.

## Step 5 — Create the configuration file

First generate the sign-in secret and copy its output; this is your `<AUTH_SECRET>`:

```bash
openssl rand -base64 32
```

Then create the file with a text editor:

```bash
nano <APP_DIRECTORY>/.env
```

Paste this, replace every placeholder, then save (Ctrl+O, Enter) and exit (Ctrl+X):

```env
DATABASE_URL="postgresql://<DATABASE_USER>:<DATABASE_PASSWORD>@127.0.0.1:5432/<DATABASE_NAME>"
DIRECT_URL="postgresql://<DATABASE_USER>:<DATABASE_PASSWORD>@127.0.0.1:5432/<DATABASE_NAME>"
AUTH_SECRET="<AUTH_SECRET>"
AUTH_TRUST_HOST=true
APP_URL="https://<DOMAIN_NAME>"

# first administrator, created once by step 6
ADMIN_EMAIL="<ADMIN_EMAIL>"
ADMIN_NAME="<ADMIN_NAME>"
ADMIN_INITIAL_PASSWORD="<ADMIN_PASSWORD>"
```

Restrict access to the file:

```bash
chmod 600 <APP_DIRECTORY>/.env
chown <APP_SYSTEM_USER>:<APP_SYSTEM_USER> <APP_DIRECTORY>/.env
```

Notes:
- Only these values live in the file. File storage, the Anthropic key and the email settings are entered later in the
  app, on the **System settings** page (saved encrypted in the database).
- **Never change `<AUTH_SECRET>` later.** Keys saved in System settings are encrypted with it and would become unreadable.
- The administrator must change `<ADMIN_PASSWORD>` at the first sign-in anyway.

## Step 6 — Install, build and create the tables

```bash
cd <APP_DIRECTORY>
sudo -u <APP_SYSTEM_USER> npm ci
sudo -u <APP_SYSTEM_USER> bash -c 'set -a; . ./.env; set +a; npx prisma generate && NODE_OPTIONS=--max-old-space-size=2048 npm run build'
sudo -u <APP_SYSTEM_USER> bash -c 'set -a; . ./.env; set +a; node scripts/bootstrap.cjs'
```

The second command is the **production build** (it takes a few minutes). The third command creates all database
tables and the first administrator; its output must contain `Created admin user:` followed by `<ADMIN_EMAIL>`.

Check that the build exists before going on. This must print a file name, not an error:

```bash
ls <APP_DIRECTORY>/.next/BUILD_ID
```

If it says "No such file", the build did not finish: run the second command again and read its last lines.
`npm run dev` does **not** create this build, and the service in step 7 cannot start without it.

## Step 7 — Run the application as a systemd service

Create the service file:

```bash
nano /etc/systemd/system/<SERVICE_NAME>.service
```

Paste this, replace the placeholders, save and exit:

```ini
[Unit]
Description=AKCC Petty Cash
After=network.target postgresql.service

[Service]
User=<APP_SYSTEM_USER>
WorkingDirectory=<APP_DIRECTORY>
EnvironmentFile=<APP_DIRECTORY>/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/npx next start -H 127.0.0.1 -p <APP_PORT>
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Start it and make it start at every boot:

```bash
systemctl daemon-reload
systemctl enable --now <SERVICE_NAME>
systemctl status <SERVICE_NAME> --no-pager        # must say: active (running)
curl -I http://127.0.0.1:<APP_PORT>/en/login      # must answer 200
```

The application listens only on `127.0.0.1:<APP_PORT>`; nginx (next step) is the public door.
Useful commands: `systemctl restart <SERVICE_NAME>`, `systemctl stop <SERVICE_NAME>`,
`journalctl -u <SERVICE_NAME> -f` (live logs).

## Step 8 — nginx (public web server)

```bash
nano /etc/nginx/sites-available/<SERVICE_NAME>
```

Paste this, replace the placeholders, save and exit:

```nginx
server {
  listen 80;
  server_name <DOMAIN_NAME>;
  client_max_body_size 55m;

  location / {
    proxy_pass http://127.0.0.1:<APP_PORT>;
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
ln -sf /etc/nginx/sites-available/<SERVICE_NAME> /etc/nginx/sites-enabled/<SERVICE_NAME>
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## Step 9 — HTTPS and firewall

```bash
certbot --nginx -d <DOMAIN_NAME> -m <CERTIFICATE_EMAIL> --agree-tos --non-interactive --redirect

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

The certificate renews automatically. Test the renewal with `certbot renew --dry-run`.

## Step 10 — First sign-in

1. Open `https://<DOMAIN_NAME>/en/login` (Arabic: `/ar/login`).
2. Sign in with `<ADMIN_EMAIL>` and `<ADMIN_PASSWORD>`. The app asks you to choose a new password.
3. The first account is created as a **System Administrator**, so it can open **System settings** and change any
   user's role. Create the Procurement Manager and the other users from the **Users** page.

   (If the account already existed before you ran step 6, its role is not changed. To promote it, run:
   `sudo -u postgres psql -d <DATABASE_NAME> -c "UPDATE \"User\" SET role='SYSTEM_ADMIN' WHERE email='<ADMIN_EMAIL>';"`
   then sign out and in again.)

## Step 11 — Configure the system (inside the app)

1. **System settings → File storage** (required for invoice and logo uploads). Choose one:
   - **Local disk on this server:** set the folder to `<FILES_DIRECTORY>`.
   - **S3-compatible bucket:** fill in the endpoint, bucket, access key and secret key of your storage service.
   - Save, then press **Test storage**. It must say storage works.
2. **System settings → Automatic invoice reading:** paste your Anthropic API key (optional; without it agents type the
   details by hand). Invoice images are sent to Anthropic for reading, so leave this empty if your policy forbids
   data leaving the country.
3. **System settings → Email notifications:** email-service API key and sender address (optional), and the
   **Application URL** used in email links.
4. **Companies & projects:** add the companies, their projects / locations / departments, logo and required signatures.
5. **Users:** create the Expense Controller, purchase agents and others, and assign each user to their companies.

Switching the file-storage choice later does not move files that are already saved.

## Step 12 — Backups

The database and the invoice files are the data that matter. Create the backup script:

```bash
install -d -o postgres -g postgres <BACKUP_DIRECTORY>
nano /usr/local/bin/app-backup
```

Paste this, replace the placeholders, save and exit:

```bash
#!/usr/bin/env bash
set -euo pipefail
sudo -u postgres pg_dump <DATABASE_NAME> | gzip > "<BACKUP_DIRECTORY>/db-$(date +%F).sql.gz"
if [ -d <FILES_DIRECTORY> ] && [ -n "$(ls -A <FILES_DIRECTORY> 2>/dev/null)" ]; then
  tar -czf "<BACKUP_DIRECTORY>/files-$(date +%F).tar.gz" -C "$(dirname <FILES_DIRECTORY>)" "$(basename <FILES_DIRECTORY>)"
fi
find <BACKUP_DIRECTORY> \( -name 'db-*.sql.gz' -o -name 'files-*.tar.gz' \) -mtime +14 -delete
```

Make it run every night at 02:30 and test it once:

```bash
chmod +x /usr/local/bin/app-backup
echo '30 2 * * * root /usr/local/bin/app-backup' > /etc/cron.d/app-backup
/usr/local/bin/app-backup && ls -lh <BACKUP_DIRECTORY>
```

This keeps 14 days of nightly backups on the server. A backup on the same disk does not protect you if the disk is
lost: also copy `<BACKUP_DIRECTORY>` somewhere else regularly and enable disk snapshots in the cloud console.
If you use an S3-compatible bucket for files, back up the bucket with your storage provider as well.

**Restore the database** (use the backup date you want):

```bash
systemctl stop <SERVICE_NAME>
sudo -u postgres dropdb <DATABASE_NAME> && sudo -u postgres createdb -O <DATABASE_USER> <DATABASE_NAME>
gunzip -c <BACKUP_DIRECTORY>/db-<BACKUP_DATE>.sql.gz | sudo -u postgres psql <DATABASE_NAME>
systemctl start <SERVICE_NAME>
```

## Updating to a new version

Take a backup first (`/usr/local/bin/app-backup`), then:

```bash
cd <APP_DIRECTORY>
sudo -u <APP_SYSTEM_USER> git pull --ff-only
sudo -u <APP_SYSTEM_USER> npm ci
sudo -u <APP_SYSTEM_USER> bash -c 'set -a; . ./.env; set +a; npx prisma generate && NODE_OPTIONS=--max-old-space-size=2048 npm run build && node scripts/bootstrap.cjs'
systemctl restart <SERVICE_NAME>
```

`bootstrap.cjs` also applies database changes safely: it never drops data, and it stops with an error if a change would.

## Troubleshooting

| Problem | What to check |
|---|---|
| Site not reachable | `systemctl status <SERVICE_NAME> nginx`, cloud security group ports 80/443, the DNS record |
| 502 Bad Gateway | The application is down: `journalctl -u <SERVICE_NAME> -n 50` |
| "Authentication failed ... database" | Wrong password in `DATABASE_URL`; re-test with the `psql` command in step 4 |
| Cannot sign in | List the users (below) and use the exact email shown; if needed reset the password (below) |
| Uploads fail | System settings → File storage → Test storage; for Local disk the folder must be owned by `<APP_SYSTEM_USER>` |
| Build killed or freezes | Not enough memory: do step 2 (swap) |
| Saved keys stopped working | `<AUTH_SECRET>` was changed; restore the old value, or enter the keys again in System settings |

List the users:

```bash
sudo -u postgres psql -d <DATABASE_NAME> -c 'SELECT email, role, active FROM "User";'
```

Reset a password. Create a small script with the administrator's email and the new password
(letters and digits only), run it once, then delete it:

```bash
nano <APP_DIRECTORY>/reset-password.cjs
```

```js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const email = "<USER_EMAIL>";
const password = "<NEW_PASSWORD>";
(async () => {
  const db = new PrismaClient();
  await db.user.update({
    where: { email },
    data: { passwordHash: await bcrypt.hash(password, 12), active: true, mustChangePassword: true },
  });
  console.log("password reset for", email);
  await db.$disconnect();
})();
```

```bash
cd <APP_DIRECTORY>
chown <APP_SYSTEM_USER>:<APP_SYSTEM_USER> reset-password.cjs
sudo -u <APP_SYSTEM_USER> bash -c 'set -a; . ./.env; set +a; node reset-password.cjs'
rm reset-password.cjs
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
