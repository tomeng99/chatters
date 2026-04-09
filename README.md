# 💬 Chatters

A secure, end-to-end encrypted messenger application built with React Native (+ Web) and Node.js.

## Features

- 🔒 **End-to-end encryption** by default using TweetNaCl
- 💬 **1:1 and group chats**
- 🌐 **Works on mobile AND web** (React Native + React Native Web)
- ⚡ **Real-time messaging** via Socket.io WebSockets
- 📸 **File & media sharing** — images, videos, and PDFs up to 20 MB
- 🔔 **Push notifications** with per-user notification preferences
- 🏷️ **@mentions and critical messages** for high-priority alerts
- 🗄️ **Self-hostable** Node.js backend with PostgreSQL

---

## Architecture

```
chatters/
├── server/              # Node.js + Express + Socket.io backend
│   ├── src/
│   │   ├── config/      # Database (PostgreSQL via pg) + env validation
│   │   ├── middleware/  # JWT auth middleware
│   │   ├── routes/      # REST API routes
│   │   ├── services/    # Socket.io service
│   │   └── index.ts     # Entry point
│   ├── package.json
│   └── .env.example
├── client/              # Expo + React Native + Web
│   ├── src/
│   │   ├── components/  # Reusable UI components (design system)
│   │   ├── screens/     # App screens
│   │   ├── theme/       # Design tokens (colors, typography, spacing)
│   │   ├── utils/       # E2E encryption utilities
│   │   ├── store/       # Zustand auth store
│   │   ├── services/    # Socket + notification services
│   │   └── navigation/  # React Navigation
│   ├── App.tsx
│   └── package.json
├── deploy/              # Caddy reverse-proxy config
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm
- Podman 4+
- `podman-compose` package (provides `podman compose` command)

### 1. Backend Setup

```bash
# Install once (Ubuntu/Debian)
sudo apt update
sudo apt install -y podman podman-compose

# In project root: starts PostgreSQL + backend
JWT_SECRET=dev-secret POSTGRES_PASSWORD=chatters podman compose up -d

# Health check
curl http://localhost:3001/health
```

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
podman compose down
```

---

## Environment Variables (server/.env)

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

| Method | Path                                | Description                      |
|--------|-------------------------------------|----------------------------------|
| `GET`  | `/api/conversations`                | List user's conversations        |
| `POST` | `/api/conversations`                | Create new conversation          |
| `GET`  | `/api/conversations/:id/messages`   | Fetch messages (paginated)       |
| `GET`  | `/api/conversations/:id/group-key`  | Get encrypted group key          |
| `PUT`  | `/api/conversations/:id/group-key`  | Distribute encrypted group keys  |

### Users (requires JWT Bearer token)

| Method | Path                         | Description                            |
|--------|------------------------------|----------------------------------------|
| `GET`  | `/api/users/search?q=...`    | Search users                           |
| `GET`  | `/api/users/settings`        | Get notification preference            |
| `PUT`  | `/api/users/settings`        | Update notification preference         |
| `GET`  | `/api/users/:id/publicKey`   | Get user's public key                  |

### Uploads (requires JWT Bearer token)

| Method | Path           | Body                        | Description                                    |
|--------|----------------|-----------------------------|------------------------------------------------|
| `POST` | `/api/upload`  | `multipart/form-data (file)`| Upload image, video, or PDF (max 20 MB)        |

---

## End-to-End Encryption

- **Key generation**: On registration, a NaCl box keypair is generated on the client. The public key is sent to the server; the private key is stored locally in AsyncStorage and **never sent to the server**.
- **1:1 chats**: Messages are encrypted with `nacl.box` using the recipient's public key and the sender's secret key.
- **Group chats**: The conversation creator generates a random shared secret and distributes it to each member by encrypting a copy with each member's public key (using `nacl.box`). The server stores only these encrypted key envelopes. No member's device can decrypt another member's copy. Each member fetches and decrypts their own envelope on first load.
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

| Event              | Payload                   | Description       |
|--------------------|---------------------------|-------------------|
| `send_message`     | See payload below         | Send a message    |
| `join_conversation`| `conversationId`          | Join a room       |
| `typing`           | `{conversationId, isTyping}` | Typing indicator |

**`send_message` payload:**
```json
{
  "conversationId": "string",
  "content": "string",
  "iv": "string | null",
  "isEncrypted": "boolean",
  "isCritical": "boolean",
  "taggedUserIds": ["string"],
  "messageType": "text | image | video | file",
  "fileName": "string | null"
}
```

### Server → Client

| Event         | Payload               | Description                   |
|---------------|-----------------------|-------------------------------|
| `new_message` | See payload below     | New message received          |
| `user_typing` | See payload below     | Typing notification           |
| `notification`| See payload below     | In-app notification           |

**`new_message` payload:**
```json
{
  "id": "string",
  "conversationId": "string",
  "content": "string",
  "iv": "string | null",
  "isEncrypted": "boolean",
  "isCritical": "boolean",
  "taggedUserIds": ["string"],
  "messageType": "text | image | video | file",
  "fileName": "string | null",
  "createdAt": "number (unix timestamp)",
  "sender": { "id": "string", "username": "string" }
}
```

**`user_typing` payload:**
```json
{ "userId": "string", "username": "string", "isTyping": "boolean", "conversationId": "string" }
```

**`notification` payload:**
```json
{
  "type": "new_message",
  "conversationId": "string",
  "conversationName": "string | null",
  "isGroup": "boolean",
  "messageId": "string",
  "senderUsername": "string",
  "isCritical": "boolean",
  "isTagged": "boolean"
}
```
