# EC2 backend

The VaultPass service runs on `ec2-100-62-97-60.compute-1.amazonaws.com` as a single systemd process behind nginx. Its mobile API URL is `https://100.62.97.60`. Let's Encrypt refuses the AWS-generated hostname, so the certificate uses the public IP and its six-day `shortlived` profile. Certbot 5.8 manages renewal; nginx reloads only after a successful renewal.

## Layout

- `/opt/vaultpass/releases/<revision>`: immutable application source and frozen-lockfile production dependencies, including the root dependencies used by the shared transfer codec.
- `/opt/vaultpass/current`: symlink to the active release.
- `/etc/vaultpass/backend.env`: root-only credentials and configuration. The service binds to `127.0.0.1:8787`, enables account creation and transfers, and trusts the local proxy's overwritten `X-Real-IP` header. The Channels key and challenge secret never enter the app or GitHub artifacts.
- `/var/lib/vaultpass/transfers.sqlite`: persistent submission journal, owned by the dedicated `vaultpass` user. It is independent of source releases.
- `/var/lib/vaultpass/backups`: daily consistent SQLite snapshots, retained for seven days. These are on the same instance disk; off-instance backup is a separate operational requirement.
- `/etc/letsencrypt`: certificate keys, ACME registration, and renewal configuration.

The EC2 security group allows HTTP for ACME/redirect and HTTPS for the API. Port 8787 is loopback-only. nginx applies request limits and a 4 KiB request limit. The Node service separately limits each client, accepting forwarded addresses only from the explicitly trusted loopback proxy. Do not scale to multiple service processes: challenge replay state is in memory and the transfer journal has one writer.

## Operation

Connect using the existing local `~/.ssh/tyler-key.pem`; never copy that key into the repository. Runtime service definitions and nginx configuration are in `ops/`.

```sh
sudo systemctl status vaultpass nginx certbot.timer vaultpass-backup.timer
sudo journalctl -u vaultpass --since '15 minutes ago'
curl --fail https://100.62.97.60/health
sudo /opt/certbot/bin/certbot renew --dry-run
sudo systemctl start vaultpass-backup.service
```

For updates, upload an archive of the reviewed commit to a new release directory, run `corepack pnpm install --prod --frozen-lockfile --ignore-scripts`, and run the backend tests there. Stop the service, atomically replace `current`, and restart. The existing database and environment file must be preserved. Rollback changes only the code symlink; never roll back or replace the submission journal with an older backup while payments are pending or uncertain.

The certificate renewal timer uses `/opt/certbot/bin/certbot`, not Ubuntu's older `/usr/bin/certbot`. `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx` validates and reloads nginx after renewal. HTTP port 80 must remain reachable for validation.

## Android builds

Set the GitHub repository or production environment variable `VAULTPASS_API_URL=https://100.62.97.60`. Release tags use it through the existing EAS release workflow. Public HTTPS IPv4 endpoints are accepted; local, private, shared, multicast, and reserved IPv4 ranges are rejected.

The **Build and test** workflow also has a manual `connect_backend` option. When enabled, it validates the URL and public TLS/health response, then embeds it in an installable preview APK. The artifact includes `build-info.json` with its commit, endpoint and debug-signing status. Ordinary branch and PR builds continue using the inert service URL. Connected previews access real mainnet accounts and require the card to approve payments; they are debug-signed, not production releases.

Do not stop/start the EC2 instance or replace it without checking whether its public IP is retained. A changed IP requires certificate issuance, nginx configuration, the GitHub variable and a new APK. Use an Elastic IP or an owned domain before distributing the app broadly.
