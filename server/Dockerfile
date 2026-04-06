FROM node:20-alpine
RUN addgroup -S deploy && adduser -S deploy -G deploy
WORKDIR /app
COPY --chown=deploy:deploy package*.json ./
RUN npm install --production
COPY --chown=deploy:deploy . .
RUN mkdir -p /app/uploads && chown deploy:deploy /app/uploads
USER deploy
EXPOSE 3001
CMD ["node", "src/index.js"]
