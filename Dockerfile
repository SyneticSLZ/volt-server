FROM ghcr.io/puppeteer/puppeteer:23.10.2

# Switch to root to install dependencies
USER root
# Install Chrome and dependencies
# Install Chrome with verbose output and debug steps
RUN apt-get update && \
    apt-get install -y wget gnupg && \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
    apt-get update && \
    apt-get install -y google-chrome-stable --no-install-recommends && \
    which google-chrome && \
    google-chrome --version && \
    ls -l /usr/bin/google-chrome*

# Debugging step to check Chrome
RUN echo "Chrome executable path contents:" && \
    ls -l /usr/bin/google-chrome-stable || echo "Chrome stable not found" && \
    ls -l /usr/bin/google-chrome || echo "Chrome not found"

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app


COPY package*.json ./


RUN npm ci

COPY . .


EXPOSE 10000
CMD ["node", "index.js"]