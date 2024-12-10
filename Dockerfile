# Use the official Node.js runtime as a base image
FROM node:20

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgstreamer-gl1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libenchant2-2 \
    libsecret-1-0 \
    libmanette-0.2-0 \
    libgles2-mesa \
    && apt-get clean

# Install Playwright browsers
# RUN npx playwright install

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json /app/
COPY package-lock.json /app/
RUN npm install

# Copy the rest of your application
COPY . .
# COPY .env /app/


# Expose the port your app will run on
EXPOSE 10000

# Start the application
CMD ["node", "index.js"]
