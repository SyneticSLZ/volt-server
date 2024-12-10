FROM node:20-bookworm

# Install Playwright and its dependencies
RUN npx -y playwright@1.49.0 install --with-deps

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json /app/
RUN npm install

# Copy rest of the application
COPY . /app/

# Expose port if needed
EXPOSE 10000

# Start the application
CMD ["node", "index.js"]