FROM node:20-alpine
WORKDIR /app
COPY services/stock-service/package*.json ./
RUN npm install --only=production
COPY services/shared ./shared
COPY services/stock-service/src ./src
EXPOSE 3003
CMD ["node", "src/index.js"]
