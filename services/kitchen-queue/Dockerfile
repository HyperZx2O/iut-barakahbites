FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY shared ./shared
COPY src ./src
COPY tests ./tests
EXPOSE 3004
CMD ["node", "src/index.js"]
