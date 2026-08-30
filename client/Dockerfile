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

# Inject the Umami tracker into Expo's generated index.html. Expo owns that file
# (there is no checked-in template), so it is patched after export rather than
# replaced - a hand-written public/index.html would have to reproduce Expo's
# bundle tags and would silently break the app if those ever change.
# No UMAMI_WEBSITE_ID (e.g. the dev branch) means no tracking and no failure.
ARG UMAMI_WEBSITE_ID
ARG UMAMI_SCRIPT_URL=https://analytics.eng.software/script.js
RUN if [ -n "$UMAMI_WEBSITE_ID" ]; then \
      f=dist/index.html; \
      if [ ! -f "$f" ]; then echo "FATAL: expo export produced no $f"; exit 1; fi; \
      sed -i "s#</head>#<script defer src=\"$UMAMI_SCRIPT_URL\" data-website-id=\"$UMAMI_WEBSITE_ID\"></script></head>#" "$f"; \
      if grep -q "$UMAMI_WEBSITE_ID" "$f"; then echo "umami: tracker injected into $f"; \
      else echo "umami: WARNING - no </head> in $f, tracker not injected"; fi; \
    fi

# Stage 2 — serve the static bundle with Nginx
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
