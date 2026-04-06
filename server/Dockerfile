FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN addgroup -S chatters && adduser -S chatters -G chatters && chown -R chatters:chatters /app
USER chatters
EXPOSE 3001
CMD ["node", "src/index.js"]
