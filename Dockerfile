FROM ghcr.io/puppeteer/puppeteer:23.10.2


# Install Chrome explicitly if needed
USER root
RUN apt-get update && apt-get install -y google-chrome-stable

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app


COPY package*.json ./


RUN npm ci

COPY . .


EXPOSE 10000
CMD ["node", "index.js"]