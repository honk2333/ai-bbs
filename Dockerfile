FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY tsconfig.json ./
COPY src ./src
COPY config ./config

RUN npm run build

RUN mkdir -p data/posts data/uploads

EXPOSE 3000

VOLUME ["/app/data", "/app/config"]

CMD ["node", "dist/server/index.js"]
