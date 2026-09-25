FROM node:24.13.1-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build -w packages/contracts
RUN npm run build -w apps/api
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
