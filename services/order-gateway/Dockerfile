FROM cafeteria-base
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
EXPOSE 3002
CMD ["node", "src/index.js"]
