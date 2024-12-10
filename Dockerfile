FROM ghcr.io/puppeteer/puppeteer:23.10.2

# Switch to root to install dependencies
USER root
# Install Chrome and dependencies
# Install Chrome with verbose output and debug steps
RUN apt-get update && \
    apt-get install -y wget gnupg chromium && \
    which chromium && \
    chromium --version

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /usr/src/app


COPY package*.json ./


RUN npm ci

COPY . .


EXPOSE 10000
CMD ["node", "index.js"]