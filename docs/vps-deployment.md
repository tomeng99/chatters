# VPS Deployment — Chatters (Podman)

This guide covers deploying the `chatters` server on a VPS using **Podman**.  
Images are pulled from **GitHub Container Registry (GHCR)** after every push to `main`.

> **Before you start**: replace every `# TODO` placeholder with the real value for your server.

---

## Prerequisites

- VPS running Ubuntu 22.04 or later (or any distro with Podman 4+)
- A user account with `sudo` privileges (a dedicated deploy user is recommended)
- PostgreSQL running on the VPS (or reachable from it)
- Podman 4+ installed (see below)
- `podman-compose` or the Podman Compose plugin

---

## 1. Install Podman on the VPS

Ubuntu 22.04 ships with Podman 3.x; Ubuntu 24.04 ships with Podman 4.x.
If your system is on Ubuntu 22.04 and you need Podman 4+, install it from the
[Kubic OBS repository](https://podman.io/docs/installation#installing-on-linux):

```bash
# Ubuntu 22.04+ — default package (may be < 4.0 on 22.04)
sudo apt update
sudo apt install -y podman podman-compose

# Verify — must be 4.0 or later
podman --version
```

> If `podman --version` reports 3.x on Ubuntu 22.04, follow the
> [Podman upstream install guide](https://podman.io/docs/installation#linux-distributions)
> to install the latest stable release from the OBS repository.

---

## 2. Set up a GitHub Personal Access Token (PAT) for GHCR

The VPS needs credentials to pull from `ghcr.io` (required for private packages;
recommended for public ones too).

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
   (or classic tokens with `read:packages` scope).
2. Create a token with **`read:packages`** permission scoped to `tomeng99/chatters`.
3. Save the token value — you will use it in the next step.

> Store the token in a file, not in shell history:
> ```bash
> echo "ghp_YOUR_PAT_HERE" > ~/.ghcr_token   # TODO: replace with real token
> chmod 600 ~/.ghcr_token
> ```
>
> **Security**: keep `~/.ghcr_token` out of any backups, cloud sync folders,
> and version control. Consider a dedicated secrets manager (e.g. Vault, `pass`,
> or a systemd credential) for long-term hardening.

---

## 3. Log in to GHCR from the VPS

```bash
podman login ghcr.io \
  --username tomeng99 \
  --password-stdin < ~/.ghcr_token
```

You should see `Login Succeeded`. Podman stores credentials in `~/.config/containers/auth.json`.

---

## 4. Create the app directory and environment file

```bash
mkdir -p ~/chatters
cd ~/chatters
```

Create a `.env` file with your runtime secrets:

```bash
cat > .env << 'EOF'
# Server
PORT=3001
JWT_SECRET=CHANGE_ME_TO_A_STRONG_RANDOM_SECRET  # TODO: generate with: openssl rand -hex 32

# PostgreSQL
POSTGRES_HOST=localhost          # TODO: set to your DB host if different
POSTGRES_PORT=5432
POSTGRES_USER=chatters           # TODO: update if different
POSTGRES_PASSWORD=CHANGE_ME      # TODO: set a strong password
POSTGRES_DB=chatters

# CORS — comma-separated list of allowed origins (your front-end URLs)
ALLOWED_ORIGINS=https://your-domain.example.com  # TODO: replace with your domain
EOF
```

> **Security**: restrict `.env` to the deploy user only:
> ```bash
> chmod 600 ~/chatters/.env
> ```

---

## 5. Create a Podman Compose file

Save the following as `~/chatters/podman-compose.yml`:

```yaml
# ~/chatters/podman-compose.yml
# Pulled image is from GHCR; replace the port mapping if your VPS uses a
# different public port or if you run a reverse proxy (nginx/caddy) in front.

services:
  chatters:
    image: ghcr.io/tomeng99/chatters:latest
    container_name: chatters
    restart: unless-stopped
    ports:
      - "3001:3001"   # TODO: change left side if you want a different host port
    env_file:
      - .env
    # Resource limits — combined with postgres (512 m below), stays within 4 GB total
    deploy:
      resources:
        limits:
          cpus: "2"          # TODO: adjust if you want to allocate more or fewer CPUs
          memory: 3584m      # 3.5 GB — leaves 512 m for postgres (total ≤ 4 GB)
        reservations:
          memory: 256m       # minimum guaranteed RAM

  postgres:
    image: docker.io/library/postgres:16-alpine
    container_name: chatters-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}           # reads from .env
      POSTGRES_USER: ${POSTGRES_USER}       # reads from .env
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}   # reads from .env
    volumes:
      - chatters_pgdata:/var/lib/postgresql/data
    # Keep DB memory usage reasonable; combined with chatters (3.5 g) stays ≤ 4 g
    deploy:
      resources:
        limits:
          memory: 512m

volumes:
  chatters_pgdata:
```

> **Note on `deploy.resources`**: Podman Compose honours the `deploy.resources`
> block from Compose spec v3 when using `--podman-run-args` or a recent enough
> `podman compose` plugin. If limits are silently ignored, pass them explicitly:
> ```bash
> podman run --memory 4g --cpus 2 ...
> ```

---

## 6. Pull the image and start the stack

```bash
cd ~/chatters

# Pull the latest image (re-run this on every deploy)
podman pull ghcr.io/tomeng99/chatters:latest

# Start (or restart) the stack in detached mode
podman-compose -f podman-compose.yml up -d

# Verify containers are running
podman ps
```

---

## 7. Updating after a new push to `main`

Every push to `main` triggers the GitHub Actions workflow, which pushes a fresh
`ghcr.io/tomeng99/chatters:latest` image to GHCR.

To deploy the update on the VPS:

```bash
cd ~/chatters
podman pull ghcr.io/tomeng99/chatters:latest
podman-compose -f podman-compose.yml up -d --force-recreate chatters

# Optional: remove old/unused images to free disk space
podman image prune -f
```

> You can automate this with a cron job or a small systemd service that polls
> GHCR or runs on a schedule. A full SSH-based auto-deploy step in the GitHub
> Actions workflow can also be added later once the VPS SSH key secrets are in
> place (see section 9).

---

## 8. Useful management commands

```bash
# View live logs
podman logs -f chatters

# Stop the stack
podman-compose -f ~/chatters/podman-compose.yml down

# Restart a single container
podman restart chatters

# Check resource usage
podman stats chatters

# Inspect running config
podman inspect chatters
```

---

## 9. GitHub secrets to add (for future automated SSH deploy)

If you later want the workflow to SSH into the VPS and deploy automatically,
add these **repository secrets** in
`github.com/tomeng99/chatters → Settings → Secrets and variables → Actions`:

| Secret name     | Value                                            |
|-----------------|--------------------------------------------------|
| `VPS_HOST`      | Your VPS IP or hostname                          |
| `VPS_USER`      | SSH username on the VPS (e.g. `deploy`)          |
| `VPS_SSH_KEY`   | Private SSH key for that user (PEM format)       |
| `VPS_PORT`      | SSH port (default: `22`)                         |
| `APP_DIR`       | Absolute path to the app dir (e.g. `/home/deploy/chatters`) |
| `GHCR_PAT`      | PAT with `read:packages` for VPS-side `podman login` |

---

## 10. Reverse proxy (recommended)

For HTTPS, place Caddy or Nginx in front of the `chatters` service and forward
traffic from port 443 to `localhost:3001`.

Example with Caddy (`/etc/caddy/Caddyfile`):

```
your-domain.example.com {   # TODO: replace with your domain
  reverse_proxy localhost:3001
}
```

Update `ALLOWED_ORIGINS` in `.env` to match your public domain, then restart:

```bash
podman-compose -f ~/chatters/podman-compose.yml up -d
```

---

## Summary of placeholders to replace

| Placeholder                        | Where                     | Notes                             |
|------------------------------------|---------------------------|-----------------------------------|
| `ghp_YOUR_PAT_HERE`                | `~/.ghcr_token`           | GHCR read:packages token          |
| `CHANGE_ME_TO_A_STRONG_RANDOM_SECRET` | `.env` → `JWT_SECRET`  | `openssl rand -hex 32`            |
| `CHANGE_ME`                        | `.env` → `POSTGRES_PASSWORD` | Strong DB password             |
| `https://your-domain.example.com`  | `.env` → `ALLOWED_ORIGINS` | Your front-end origin(s)         |
| `3001` (host port)                 | `podman-compose.yml`      | Change if port conflicts          |
| `your-domain.example.com`          | Caddyfile                 | Your public domain                |
| CPU/memory limits                  | `podman-compose.yml`      | Tune to your actual workload      |
