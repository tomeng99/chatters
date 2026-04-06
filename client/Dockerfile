# Stage 1 — build the Expo web export
FROM node:20-alpine AS builder
WORKDIR /app

# Optional: bake in a fixed API URL at build time.
# If not provided the app auto-detects the backend using window.location.hostname
# (see client/src/config.ts), which works when the frontend and backend are on
# the same host.
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}

COPY package*.json ./
RUN npm ci
COPY . .
RUN npx expo export --platform web

# Stage 2 — serve the static bundle with Nginx
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
