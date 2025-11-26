FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to install dependencies if needed (though puppeteer image handles most)
USER root

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# --omit=dev not strictly necessary but good practice, though we might need dev deps if puppeteer is one
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "server.js"]
