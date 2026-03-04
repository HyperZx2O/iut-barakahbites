FROM node:20-alpine
WORKDIR /app
COPY services/order-gateway/package*.json ./
RUN npm install --only=production
COPY services/shared ./shared
COPY services/order-gateway/src ./src
EXPOSE 3002
CMD ["node", "src/index.js"]
