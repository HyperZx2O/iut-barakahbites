FROM node:20-alpine
WORKDIR /app
COPY services/notification-hub/package*.json ./
RUN npm install --only=production
COPY services/shared ./shared
COPY services/notification-hub/src ./src
COPY services/notification-hub/tests ./tests
EXPOSE 3005
CMD ["node", "src/index.js"]
