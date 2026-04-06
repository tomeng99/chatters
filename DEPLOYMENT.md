# Deployment Guide — Ubuntu 24 + Podman + GHCR

This guide explains how to set up automated deployment for Chatters using:

- **GitHub Actions** — builds the server image on every push to `main`
- **GHCR (GitHub Container Registry)** — stores the built image
- **Podman** — runs the containers on your VPS (no Docker daemon required)

> The **client** (Expo / React Native) is a mobile-first app. For production,
> users install it on their phone via Expo Go or a native build. The web variant
> can be served separately if needed. This guide focuses on the **server**
> (Node.js + Socket.io + PostgreSQL), which is the only service that runs on
> the VPS.

---

## Architecture

```
GitHub push to main
    │
    ▼
GitHub Actions
    ├── Build server image
    ├── Push to ghcr.io/tomeng99/chatters:latest (+ :<sha>)
    └── SSH → VPS
            ├── podman compose pull
            ├── podman compose up -d
            └── podman image prune -f

VPS containers (managed by Podman + Compose)
    ├── chatters-server   (port 3001, memory ≤ 3.5 GB)
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
ALLOWED_ORIGINS=https://<your-domain-or-server-ip>:3001
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

1. **Build** — GitHub Actions builds `server/` using the `Dockerfile`.
2. **Push** — The image is pushed to GHCR as:
   - `ghcr.io/tomeng99/chatters:latest`
   - `ghcr.io/tomeng99/chatters:<git-sha>` (for rollbacks)
3. **Deploy** — Actions SSHs into the VPS and runs:
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

## 5. Resource Limits

The `docker-compose.yml` splits the 4 GB budget across both containers:

```yaml
# postgres service
mem_limit: 512m

# server service
mem_limit: 3584m   # 3.5 GB — combined with postgres = 4 GB
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

## 6. Accessing the App

After deploy, the server listens on port `3001` of your VPS.

| URL | Purpose |
|-----|---------|
| `http://<VPS_IP>:3001/health` | Health check |
| `http://<VPS_IP>:3001` | API + WebSocket endpoint |

Point your Expo client at the server by setting:

```bash
EXPO_PUBLIC_API_URL=http://<VPS_IP>:3001
```

For production web access, put a reverse proxy (Nginx or Caddy) in front of
port 3001 with TLS.

---

## 7. Rollback

Each push is also tagged with the commit SHA. To roll back, SSH into the VPS
and change the image tag in `docker-compose.yml` to a previous SHA, then
restart:

```bash
cd /opt/chatters
# edit docker-compose.yml: change image tag to ghcr.io/tomeng99/chatters:<old-sha>
podman compose up -d
```

---

## 8. Logs and Monitoring

```bash
# Follow server logs
podman compose logs -f server

# Check running containers
podman ps

# Inspect resource usage
podman stats
```
