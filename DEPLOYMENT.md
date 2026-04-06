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
    └── SSH → VPS
            ├── podman compose pull
            ├── podman compose up -d
            └── podman image prune -f

VPS containers (managed by Podman + Compose)
    ├── chatters-client   (port 80,  memory ≤ 256 MB) ← web frontend (Nginx)
    ├── chatters-server   (port 3001, memory ≤ 3.3 GB) ← API + WebSocket
    └── chatters-postgres (internal, port 5432, memory ≤ 512 MB)
                                     ← combined ≤ 4 GB
```

---

## 1. VPS Requirements

- Ubuntu 24.04 LTS
- 1+ CPU, 4+ GB RAM (server capped at 3.5 GB + postgres at 512 MB = 4 GB combined)
- Podman 4.x or later

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
ALLOWED_ORIGINS=http://<your-domain-or-server-ip>

# For production with TLS, use https:// to prevent session hijacking:
# ALLOWED_ORIGINS=https://<your-domain>

# Optional — port to expose the web frontend on (default: 80)
# FRONTEND_PORT=80

# Optional — if you want to bake the API URL into the frontend image at build
# time rather than relying on auto-detection, set this in CI as a secret called
# EXPO_PUBLIC_API_URL (e.g. https://api.example.com). Leave unset to let the
# browser auto-detect the backend at window.location.hostname:3001.
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
| `EXPO_PUBLIC_API_URL` | *(Optional)* Full URL of the backend API to bake into the client image at build time (e.g. `https://chat.eng.software:3001`). Leave unset to use auto-detection. |

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
4. **Deploy** — Actions SSHs into the VPS and runs:
   ```bash
   podman compose pull
   podman compose up -d
   podman image prune -f
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

## 7. Accessing the App

After deploy, two services are running on your VPS:

| URL | Purpose |
|-----|---------|
| `http://<VPS_IP>/` | Web frontend (Chatters UI) |
| `http://<VPS_IP>:3001/health` | Backend health check |
| `http://<VPS_IP>:3001` | API + WebSocket endpoint |

The web frontend auto-detects the backend: when loaded from `http://<VPS_IP>`,
it connects to `http://<VPS_IP>:3001` automatically.

For a custom domain (e.g. `chat.eng.software`), point DNS to the VPS and set
`ALLOWED_ORIGINS=http://chat.eng.software` in `/opt/chatters/.env`.

For production TLS, put Nginx (or Caddy) in front of port 80 and 3001 with
your certificate. A minimal Nginx vhost for the web frontend would proxy to the
client container; alternatively the `FRONTEND_PORT` variable lets you bind the
client container directly to a different port if you prefer to terminate TLS
outside the container stack.

---

## 8. Rollback

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

## 9. Logs and Monitoring

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
