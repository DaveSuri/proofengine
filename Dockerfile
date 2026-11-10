FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY server.js ./
COPY examples ./examples
COPY src ./src
COPY test ./test

RUN npm install --ignore-scripts && npm run build

ENV PORT=4321
EXPOSE 4321

CMD ["node", "server.js"]
