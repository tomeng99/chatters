# Deployment Guide — Ubuntu 24 + Podman + GHCR

This guide explains how to set up automated deployment for Chatters using:

- **GitHub Actions** — builds the server and client images on every push to `main`
- **GHCR (GitHub Container Registry)** — stores the built images
- **Podman** — runs the containers on your VPS (no Docker daemon required)

> The **client** (Expo / React Native) is a mobile-first app. For production,
> users install it on their phone via Expo Go or a native build. The web variant
> is built and served from a dedicated Nginx container so users can also access
> the app from a browser until the mobile apps are available in the stores.

---

## Architecture

```
GitHub push to main
    │
    ▼
GitHub Actions
    ├── Build server image  → ghcr.io/tomeng99/chatters:latest
    ├── Build client image  → ghcr.io/tomeng99/chatters-client:latest
    └── Deploy → VPS
            ├── scp docker-compose.yml → /opt/chatters/
            ├── podman compose pull
            ├── podman compose down
            ├── podman compose up -d
            └── podman image prune -af

VPS (public HTTPS via Caddy — runs as a system service)
    └── Caddy  (ports 80 + 443, auto-TLS via Let's Encrypt)
            ├── /api/*, /socket.io/*, /uploads/*, /health → 127.0.0.1:3001
            └── /*                                        → 127.0.0.1:8080

Podman containers (localhost-only, not directly reachable from the internet)
    ├── chatters-client   (127.0.0.1:8080, memory ≤ 256 MB)  ← Nginx, web frontend
    ├── chatters-server   (127.0.0.1:3001, memory ≤ 3.3 GB)  ← Express API + Socket.IO
    └── chatters-postgres (internal 5432,  memory ≤ 512 MB)  ← PostgreSQL
                                                               ← combined ≤ 4 GB
```

---

## 1. VPS Requirements

- Ubuntu 24.04 LTS
- 1+ CPU, 4+ GB RAM (server capped at 3.5 GB + postgres at 512 MB = 4 GB combined)
- Podman 4.x or later
- Caddy (for HTTPS — see section 7)
- Domain name with an `A` record pointing to the VPS IP (required for TLS certificates)
- Ports **80** and **443** open on the VPS firewall

Install on a fresh Ubuntu 24 server:

```bash
sudo apt update
sudo apt install -y podman podman-compose
podman --version          # should be 4.x+
podman compose version
```

---

## 2. VPS — First-Time Setup

### 2a. Create a deploy user (optional but recommended)

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy   # only if the user needs sudo for systemctl etc.
```

### 2b. Create the app directory and `.env` file

```bash
sudo mkdir -p /opt/chatters
sudo chown deploy:deploy /opt/chatters
```

Copy `docker-compose.yml` from this repo to `/opt/chatters/docker-compose.yml`
(or `scp` it there), then create `/opt/chatters/.env`:

```bash
# /opt/chatters/.env — fill in real values

JWT_SECRET=<replace-with-a-long-random-string>
POSTGRES_PASSWORD=<replace-with-a-strong-password>
ALLOWED_ORIGINS=https://<your-domain>

# Lock container ports to localhost so Caddy is the only public entry point.
# Remove these (or set to 0.0.0.0) if you need direct LAN access for local dev.
SERVER_BIND_ADDRESS=127.0.0.1
FRONTEND_HOST_BIND=127.0.0.1

# Optional — port Caddy proxies to for the web frontend (default: 8080).
# If you change this, also update the reverse-proxy upstream in deploy/Caddyfile
# from 127.0.0.1:8080 to the same port.
# FRONTEND_PORT=8080

# Required for the Caddy/path-routing deployment — bakes the HTTPS origin into
# the client image so the web app does not try to reach http://<domain>:3001.
# Set this as a GitHub Actions secret called EXPO_PUBLIC_API_URL.
# EXPO_PUBLIC_API_URL=https://<your-domain>
```

Generate a safe JWT secret:
```bash
openssl rand -hex 32
```

### 2c. Authenticate Podman to GHCR

You need a GitHub Personal Access Token (PAT) with `read:packages` scope.

Create one at: **GitHub → Settings → Developer settings → Personal access
tokens → Fine-grained tokens** (or classic with `read:packages`).

Log in once on the VPS:

```bash
echo '<YOUR_GHCR_PAT>' | podman login ghcr.io -u <your-github-username> --password-stdin
```

Podman stores this credential in `~/.config/containers/auth.json` for future
pulls. The deploy workflow will also re-authenticate before each pull.

### 2d. Verify the compose file works manually

```bash
cd /opt/chatters
podman compose pull                        # pull images once to verify auth
JWT_SECRET=your-secret podman compose up -d
curl http://localhost:3001/health          # should return {"status":"ok",...}
podman compose down
```

---

## 3. GitHub Repository Secrets

Add the following secrets in **GitHub → Settings → Secrets and variables →
Actions → Repository secrets**:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | IP address or hostname of your VPS |
| `VPS_USER` | SSH user on the VPS (e.g. `deploy`) |
| `VPS_SSH_KEY` | **Private** SSH key for that user (see below) |
| `VPS_PORT` | SSH port (usually `22`; defaults to `22` if omitted) |
| `APP_DIR` | Path to app directory on VPS (e.g. `/opt/chatters`) |
| `GHCR_PAT` | GitHub PAT with `read:packages` scope (used by VPS pull) |
| `GHCR_USER` | GitHub username that owns the PAT (e.g. `tomeng99`) |
| `EXPO_PUBLIC_API_URL` | *(Optional)* Full URL of the backend API to bake into the client image at build time (e.g. `https://chat.eng.software`). Leave unset to use auto-detection. |

### Generating the deploy SSH key

On your **local machine** (not the VPS):

```bash
ssh-keygen -t ed25519 -C "chatters-deploy" -f ~/.ssh/chatters_deploy
# Press Enter for no passphrase (required for automated deploys)
```

Copy the **public** key to the VPS:

```bash
ssh-copy-id -i ~/.ssh/chatters_deploy.pub deploy@<YOUR_VPS_HOST>
```

Add the **private** key (`~/.ssh/chatters_deploy` contents) as the
`VPS_SSH_KEY` GitHub secret.

---

## 4. How the Workflow Runs

The workflow (`.github/workflows/deploy.yml`) triggers on every push to `main`:

1. **Build server** — GitHub Actions builds `server/` using the server `Dockerfile`.
2. **Build client** — GitHub Actions builds `client/` using the client `Dockerfile` (Expo web export → Nginx).
3. **Push** — Both images are pushed to GHCR as:
   - `ghcr.io/tomeng99/chatters:latest` / `ghcr.io/tomeng99/chatters:<git-sha>`
   - `ghcr.io/tomeng99/chatters-client:latest` / `ghcr.io/tomeng99/chatters-client:<git-sha>`
4. **Deploy** — Actions copies the latest `docker-compose.yml` to `APP_DIR` on
   the VPS, then SSHs in and runs:
   ```bash
   podman compose pull
   podman compose down
   podman compose up -d
   podman image prune -af
   ```

### Making the GHCR package public (optional)

By default, packages published to GHCR from a public repo are public.
If your package is public, the VPS doesn't need to authenticate for pulls and
you can remove the `podman login` step from the workflow.

Check/set visibility:  
**GitHub → Packages → chatters → Package settings → Change visibility**

---

## 5. Persistent Uploads

Uploaded files are stored inside the container at `/app/uploads`. The
`docker-compose.yml` mounts a named volume (`uploads_data`) at that path so
files survive container restarts and image upgrades:

```yaml
volumes:
  - uploads_data:/app/uploads
```

Podman/Docker creates and manages this volume automatically — no manual setup
is required on the VPS.

### Why an entrypoint script is needed

In rootless Podman, when a named volume is mounted over `/app/uploads` at
runtime the volume's backing directory may appear as owned by `root` (uid 0)
inside the container, even though the `Dockerfile` sets `chown node:node` on
that path.  The image-layer ownership is hidden by the volume mount, so the
`node` user gets `EACCES` the first time the app tries to write there.

`docker-entrypoint.sh` solves this by running briefly as `root` on every
container start, executing `chown node:node /app/uploads`, and then switching
to the `node` user via `su-exec` before starting the application.  No manual
VPS setup is required.

> **Note:** If you previously ran the stack without this volume, existing
> uploaded files inside the old container are not migrated automatically.
> They are lost when the container is replaced. Future uploads will persist.

---

## 6. Resource Limits

The `docker-compose.yml` splits the 4 GB budget across all containers:

```yaml
# postgres service
mem_limit: 512m

# server service
mem_limit: 3328m   # 3.3 GB

# client service (Nginx static serving)
mem_limit: 256m

# combined ≈ 4 GB
```

On your 6-CPU / 12 GB RAM VPS this leaves plenty of headroom for the OS
and other workloads. Both services already have memory limits configured in
`docker-compose.yml` via `mem_limit`: `server` is capped at `3584m` (3.5 GB)
and `postgres` at `512m`. PostgreSQL memory is also influenced by its own
configuration (`shared_buffers`, `work_mem`, etc.); tune those as needed.

> **Note:** `mem_limit` is a top-level Compose Spec key and is enforced by
> `podman compose` on Linux via cgroups. It is also honoured by Docker Compose
> without requiring compatibility mode, unlike the `deploy.resources` block.

---

## 7. HTTPS Setup with Caddy

Caddy runs as a **system service** on the VPS (outside the container stack).  
It handles TLS automatically (free certificates from Let's Encrypt) and proxies
traffic to the Podman containers over localhost. The containers are bound to
`127.0.0.1` only and are **not** directly reachable from the internet.

> **Why Caddy and not just port 8080?**  
> Port 8080 (the frontend container) serves plain HTTP. Browsers require port
> 443 and a valid TLS certificate for a connection to be shown as "secure".
> Attempting `curl -Ik https://host:8080` fails with an SSL `wrong version number`
> error because the TLS handshake hits a plain HTTP response — exactly what
> Caddy fixes.

### 7a. Open ports on the VPS firewall

Ports 80 (HTTP challenge for cert issuance) and 443 (HTTPS) must be reachable
from the internet. With UFW:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### 7b. Install Caddy

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 7c. Deploy the Caddyfile

A ready-made config is provided at `deploy/Caddyfile` in this repository.
Copy it to the VPS and replace the placeholder domain:

```bash
# On your local machine — scp the file to the VPS:
scp deploy/Caddyfile deploy@<VPS_IP>:/tmp/Caddyfile

# On the VPS — install it.
# If your domain is NOT chat.eng.software, replace it first:
sudo sed 's/chat\.eng\.software/<your-actual-domain>/g' /tmp/Caddyfile \
  | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy   # should show "active (running)"
```

If your domain is already `chat.eng.software` you can skip the `sed` step:

```bash
sudo cp /tmp/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy will automatically request a certificate from Let's Encrypt the first
time it handles a request for the domain (ports 80 and 443 must be open).

### 7d. Update the app environment and GitHub secret

On the VPS, edit `/opt/chatters/.env` to set the HTTPS origins and lock the
container ports to localhost:

```bash
ALLOWED_ORIGINS=https://chat.eng.software
SERVER_BIND_ADDRESS=127.0.0.1
FRONTEND_HOST_BIND=127.0.0.1
```

In GitHub → Settings → Secrets and variables → Actions, set:

```
EXPO_PUBLIC_API_URL = https://chat.eng.software
```

This is **required** for the Caddy path-routing setup. Without it, the web app
auto-detects the backend as `https://<domain>:3001`, which is now an internal-only
port. Setting `EXPO_PUBLIC_API_URL` bakes the correct HTTPS origin (without a
port) into the client image so API calls are routed through Caddy on port 443.

### 7e. Restart the containers and trigger a re-deploy

```bash
cd /opt/chatters
podman compose down
podman compose up -d
```

Then push any small change to `main` (or re-run the workflow manually in
GitHub Actions) so the client image is rebuilt with the updated
`EXPO_PUBLIC_API_URL`.

### Architecture after Caddy is running

```
browser → https://chat.eng.software (port 443)
               │
               ▼
         Caddy (system service, handles TLS)
               ├── /api/*        → http://127.0.0.1:3001  (Express API)
               ├── /socket.io/*  → http://127.0.0.1:3001  (Socket.IO WebSocket)
               ├── /uploads/*    → http://127.0.0.1:3001  (file serving)
               ├── /health       → http://127.0.0.1:3001  (health check)
               └── /*            → http://127.0.0.1:8080  (Nginx web frontend)
```

---

## 8. Accessing the App

After Caddy is set up and the containers are running:

| URL | Purpose |
|-----|---------|
| `https://<your-domain>/` | Web frontend (Chatters UI) |
| `https://<your-domain>/health` | Backend health check |
| `https://<your-domain>/api/...` | REST API routes |

> **Port 8080 is internal HTTP only.**  
> Do not access `https://your-domain:8080` — that port serves plain HTTP and
> TLS clients will get an `SSL wrong version number` error. Always use the
> standard HTTPS URL (port 443) via Caddy.

---

## 9. Rollback

Each push is also tagged with the commit SHA. To roll back, SSH into the VPS
and change the image tags in `docker-compose.yml` to a previous SHA, then
restart:

```bash
cd /opt/chatters
# edit docker-compose.yml: change server image to ghcr.io/tomeng99/chatters:<old-sha>
#                           change client image to ghcr.io/tomeng99/chatters-client:<old-sha>
podman compose up -d
```

---

## 10. Logs and Monitoring

```bash
# Follow server logs
podman compose logs -f server

# Follow client (Nginx) logs
podman compose logs -f client

# Check running containers
podman ps

# Inspect resource usage
podman stats
```
