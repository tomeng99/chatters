FROM node:20-alpine
RUN apk add --no-cache su-exec
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm install --production
COPY --chown=node:node . .
COPY --chown=root:root docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    mkdir -p /app/uploads && chown node:node /app/uploads
EXPOSE 3001
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
