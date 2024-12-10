# FROM node:20-bookworm

# # Install Playwright and its dependencies
# RUN npx -y playwright@1.49.0 install --with-deps

# # Set working directory
# WORKDIR /app

# # Copy package.json and install dependencies
# COPY package.json /app/
# RUN npm install


# # Copy rest of the application
# COPY . /app/

# # Expose port if needed
# EXPOSE 10000

# # Start the application
# CMD ["node", "index.js"]

FROM node:20-bookworm

# Install system dependencies and Playwright dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    libgconf-2-4 \
    libunwind8 \
    libxss1 \
    libx11-dev \
    libxext-dev \
    libxdmcp-dev \
    libxtst6 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2

# Add this after system dependencies
RUN useradd -m myuser
USER myuser

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Playwright browsers
RUN npx playwright install --with-deps chromium

# Copy the rest of the application
COPY . .

# Expose port if needed
EXPOSE 10000

# Start the application
CMD ["node", "index.js"]