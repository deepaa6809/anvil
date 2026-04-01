FROM node:22-slim
WORKDIR /app
COPY package.json tsup.config.ts tsconfig.json ./
COPY src ./src
RUN npm install && npm run build
ENV DATA_DIR=/data PORT=4400
VOLUME ["/data"]
EXPOSE 4400
CMD ["node", "dist/server.js"]
