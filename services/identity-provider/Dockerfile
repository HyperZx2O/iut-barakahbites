FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY services/identity-provider/package*.json ./
RUN rm -rf node_modules package-lock.json && npm install
COPY services/shared ./shared
COPY services/identity-provider/src ./src
EXPOSE 3001
CMD ["node", "src/index.js"]
