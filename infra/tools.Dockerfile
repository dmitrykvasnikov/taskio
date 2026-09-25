FROM node:24.13.1-alpine

RUN apk add --no-cache curl docker-cli docker-cli-compose

WORKDIR /workspace
