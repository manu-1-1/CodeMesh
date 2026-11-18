# Stage 1: Build the React (Vite) Application
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency manifests first for Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Build argument for backend API URL (inlined by Vite at build time)
ARG VITE_BACKEND_URL=http://localhost:5000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

# Copy source code and build production assets
COPY . .
RUN npm run build


# Stage 2: Serve static assets with Nginx
FROM nginx:alpine

# Remove default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built production assets from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration with SPA routing and gzip support
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose standard HTTP port
EXPOSE 80

# Start Nginx server in the foreground
CMD ["nginx", "-g", "daemon off;"]
