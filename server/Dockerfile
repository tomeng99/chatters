FROM node:20-alpine
RUN addgroup -S chatters && adduser -S chatters -G chatters
WORKDIR /app
COPY --chown=chatters:chatters package*.json ./
RUN npm install --production
COPY --chown=chatters:chatters . .
USER chatters
EXPOSE 3001
CMD ["node", "src/index.js"]
