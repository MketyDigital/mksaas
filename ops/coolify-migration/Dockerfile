FROM node:22-bookworm-slim

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

EXPOSE 3000
CMD ["node", "-e", "require('http').createServer((req,res)=>{res.statusCode=200;res.end('ok')}).listen(3000,'0.0.0.0')"]
