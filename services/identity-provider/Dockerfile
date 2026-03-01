FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN rm -rf node_modules package-lock.json && npm install

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
