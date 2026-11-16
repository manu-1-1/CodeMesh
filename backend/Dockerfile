FROM node:20-slim

# Install OpenSSL (required by Prisma Client engine)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Copy package definitions first for Docker layer caching
COPY package*.json ./

# Copy Prisma schema and config before install so Prisma client can generate
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install project dependencies
RUN npm install

# Generate Prisma client for Linux
RUN npx prisma generate

# Copy the rest of backend application source code
COPY . .

# Expose backend service port
EXPOSE 5000

# Set default environment variables
ENV PORT=5000
ENV NODE_ENV=production

# Start backend server
CMD ["npm", "start"]
