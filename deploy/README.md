# Deploying on an Ubuntu server (Alibaba Cloud ECS)

Minimum: 2 vCPU, 4 GB RAM, 40 GB disk, Ubuntu 22.04/24.04. App and PostgreSQL run on the same server.

1. Create the ECS instance. Security group: allow 22 (your IP only), 80 and 443. Never open 5432.
2. Point a DNS A record (e.g. petty.yourcompany.com) to the server's public IP.
3. SSH in and run:
   ```bash
   git clone https://github.com/alisaeed-exp2/Proc-Petty-Cash.git /tmp/akcc-setup
   sudo DOMAIN=petty.yourcompany.com ADMIN_EMAIL=you@company.com ADMIN_NAME="Your Name" \
        CERT_EMAIL=you@company.com bash /tmp/akcc-setup/deploy/setup-server.sh
   ```
   The generated first-admin password is printed once at step 4 (also in /opt/akcc/.env).
4. Edit `/opt/akcc/.env` to add the `S3_*` storage settings (needed for invoice and logo uploads),
   and optionally `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`; then `sudo systemctl restart akcc`.
5. Update later with `sudo akcc-deploy`. Logs: `journalctl -u akcc -f`.
6. Backups: nightly database dump to /var/backups/akcc (14 days). Also copy them off the server
   and enable ECS disk snapshots. Invoice files live in the S3/OSS bucket; back that up too.
