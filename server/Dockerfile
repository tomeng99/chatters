FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm install --production
COPY --chown=node:node . .
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3001
CMD ["node", "src/index.js"]
