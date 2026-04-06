# 💬 Chatters

A secure, end-to-end encrypted messenger application built with React Native (+ Web) and Node.js.

## Features

- 🔒 **End-to-end encryption** by default using TweetNaCl
- 💬 **1:1 and group chats**
- 🌐 **Works on mobile AND web** (React Native + React Native Web)
- ⚡ **Real-time messaging** via Socket.io WebSockets
- 🗄️ **Self-hostable** Node.js backend with PostgreSQL

---

## Architecture

```
chatters/
├── server/              # Node.js + Express + Socket.io backend
│   ├── src/
│   │   ├── config/      # Database (PostgreSQL via pg)
│   │   ├── middleware/  # JWT auth middleware
│   │   ├── routes/      # REST API routes
│   │   ├── services/    # Socket.io service
│   │   └── index.js     # Entry point
│   ├── package.json
│   └── .env.example
├── client/              # Expo + React Native + Web
│   ├── src/
│   │   ├── components/  # Reusable UI components (design system)
│   │   ├── screens/     # App screens
│   │   ├── theme/       # Design tokens (colors, typography, spacing)
│   │   ├── utils/       # E2E encryption utilities
│   │   ├── store/       # Zustand auth store
│   │   ├── services/    # Socket service
│   │   └── navigation/  # React Navigation
│   ├── App.tsx
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm
- Podman 4+
- podman-compose (or `podman compose` plugin)

### 1. Backend Setup

```bash
# Install once (Ubuntu/Debian)
sudo apt update
sudo apt install -y podman podman-compose

# Create your local .env from the example (first time only)
cp .env.example .env
# Edit .env and set JWT_SECRET to a long random string.
# To generate one:  openssl rand -hex 32

# In project root: starts PostgreSQL + backend
podman-compose up -d

# Health check
curl http://localhost:3001/health
```

> **Environment variables**: `podman-compose` (and `docker compose`) automatically
> reads a `.env` file in the project root. Copy `.env.example` to `.env` and set
> `JWT_SECRET` before starting the stack. You can also pass variables inline for
> a quick smoke test: `JWT_SECRET=dev-secret podman-compose up -d`, but for any
> persistent deployment always use the `.env` file so the secret survives restarts.

### 2. Frontend Setup

```bash
cd client
npm install
npx expo start --web   # Open in web browser
npx expo start         # Open in Expo Go (mobile)
```

> **Mobile devices on LAN**: When you run `npx expo start` and open the app
> in Expo Go on a phone, the client automatically detects the development
> server's IP address and connects to the backend at `http://<server-ip>:3001`.
> You can override this by setting `EXPO_PUBLIC_API_URL` before starting the
> client (e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.50:3001 npx expo start`).

### 3. Stop Podman Services

```bash
podman-compose down
```

If your system uses the compose plugin command, replace `podman-compose` with `podman compose`.

---

## Environment Variables

### Compose deployment (`.env` — project root)

When using `podman-compose` / `docker compose`, copy `.env.example` to `.env` in the
**project root** (next to `docker-compose.yml`). Compose reads this file automatically.

| Variable              | Default                             | Description                    |
|-----------------------|-------------------------------------|--------------------------------|
| `JWT_SECRET`          | *(required)*                        | JWT signing secret             |
| `POSTGRES_PASSWORD`   | `chatters`                          | PostgreSQL password            |
| `ALLOWED_ORIGINS`     | *(unset — localhost and RFC1918 network origins allowed)* | Comma-separated allowed origins|

### Direct server execution (`server/.env`)

When running the server directly with `node src/index.js` (outside compose),
copy `server/.env.example` to `server/.env`.

| Variable              | Default                             | Description                    |
|-----------------------|-------------------------------------|--------------------------------|
| `PORT`                | `3001`                              | HTTP + WebSocket port          |
| `JWT_SECRET`          | *(required)*                        | JWT signing secret             |
| `POSTGRES_HOST`       | `localhost`                         | PostgreSQL host                |
| `POSTGRES_PORT`       | `5432`                              | PostgreSQL port                |
| `POSTGRES_USER`       | `chatters`                          | PostgreSQL user                |
| `POSTGRES_PASSWORD`   | `chatters`                          | PostgreSQL password            |
| `POSTGRES_DB`         | `chatters`                          | PostgreSQL database name       |
| `POSTGRES_POOL_MAX`   | `20`                                | Maximum pool connections       |
| `POSTGRES_SSL`        | *(unset)*                           | Set `true` to enable SSL       |
| `ALLOWED_ORIGINS`     | `http://localhost:8081,...`          | Comma-separated allowed origins|

### Client Environment Variables

| Variable              | Default                             | Description                    |
|-----------------------|-------------------------------------|--------------------------------|
| `EXPO_PUBLIC_API_URL` | auto-detected from Expo dev host    | Backend URL for API + WebSocket|

---

## API Reference

### Auth

| Method | Path                    | Body                                | Description         |
|--------|-------------------------|-------------------------------------|---------------------|
| `POST` | `/api/auth/register`    | `{username, password, publicKey}`   | Register new user   |
| `POST` | `/api/auth/login`       | `{username, password}`              | Login               |
| `PUT`  | `/api/auth/public-key`  | `{publicKey}`                       | Update public key   |

### Conversations (requires JWT Bearer token)

| Method | Path                              | Description                  |
|--------|-----------------------------------|------------------------------|
| `GET`  | `/api/conversations`              | List user's conversations    |
| `POST` | `/api/conversations`              | Create new conversation      |
| `GET`  | `/api/conversations/:id/messages` | Fetch messages (paginated)   |

### Users (requires JWT Bearer token)

| Method | Path                       | Description            |
|--------|----------------------------|------------------------|
| `GET`  | `/api/users/search?q=...`  | Search users           |
| `GET`  | `/api/users/:id/publicKey` | Get user's public key  |

---

## End-to-End Encryption

- **Key generation**: On registration, a NaCl box keypair is generated on the client. The public key is sent to the server; the private key is stored locally in AsyncStorage and **never sent to the server**.
- **1:1 chats**: Messages are encrypted with `nacl.box` using the recipient's public key and the sender's secret key.
- **Group chats**: A random shared secret (`nacl.secretbox`) is generated locally per group conversation and stored in AsyncStorage.
- **Server role**: The server stores only ciphertext — it cannot read message content.

---

## Design System

All styles are centralized in `client/src/theme/index.ts`:

- **`colors`** — Primary, backgrounds, text hierarchy, message bubbles
- **`typography`** — Font sizes and weights
- **`spacing`** — Consistent spacing scale (xs → xxl)
- **`borderRadius`** — Corner radius tokens
- **`shadows`** — Cross-platform shadow definitions

Components import exclusively from theme — no magic numbers in screens.

---

## WebSocket Events

### Client → Server

| Event              | Payload                                      | Description       |
|--------------------|----------------------------------------------|-------------------|
| `send_message`     | `{conversationId, content, iv, isEncrypted}` | Send a message    |
| `join_conversation`| `conversationId`                             | Join a room       |
| `typing`           | `{conversationId, isTyping}`                 | Typing indicator  |

### Server → Client

| Event         | Payload                              | Description            |
|---------------|--------------------------------------|------------------------|
| `new_message` | Message object                       | New message received   |
| `user_typing` | `{userId, username, isTyping}`       | Typing notification    |
