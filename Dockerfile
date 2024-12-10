FROM ghcr.io/puppeteer/puppeteer:23.10.2

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app


COPY package*.json ./


RUN npm ci

COPY . .


EXPOSE 3002
CMD ["node", "index.js"]