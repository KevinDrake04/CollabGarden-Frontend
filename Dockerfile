FROM node:22-alpine

WORKDIR /app

RUN npm install --global pnpm@10

COPY package.json ./
RUN pnpm install

COPY . .

EXPOSE 5173

CMD ["pnpm", "dev"]
