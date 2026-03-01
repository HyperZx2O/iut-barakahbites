FROM node:20-alpine
WORKDIR /app
COPY services/kitchen-queue/package*.json ./
RUN npm install --only=production
COPY services/shared ./shared
COPY services/kitchen-queue/src ./src
COPY services/kitchen-queue/tests ./tests
EXPOSE 3004
CMD ["node", "src/index.js"]
