# Dev Diary 25: Dockerizing the Frontend with Multi-Stage Nginx Build

**Date:** November 18, 2026  
**Focus:** Implementing a high-performance, lightweight, multi-stage Docker build for the React + Vite frontend using Nginx.

---

## 1. The Goal

After containerizing the backend service, the next milestone was containerizing the React SPA (Single Page Application) frontend. The objectives:
1. Ensure the final container image is minimal in size (<30MB) and resource-efficient.
2. Prevent dev dependencies, Node runtime, and `node_modules` from shipping in production.
3. Solve SPA client-side routing fallback so page refreshes never throw 404 errors.
4. Support build-time injection of `VITE_BACKEND_URL` for flexible deployments across environments.

---

## 2. Key Technical Architecture

### A. Multi-Stage Build Pattern
Single Page Applications are static HTML, CSS, and JS bundles once compiled. Shipping a Node.js runtime to serve static files wastes memory and storage. We utilized Docker's multi-stage build:

1. **Stage 1 (`build` using `node:20-alpine`)**:
   - Copies `package*.json` and installs dependencies using layer caching.
   - Accepts the `VITE_BACKEND_URL` build argument.
   - Executes `npm run build` to generate compiled static assets in `/app/dist`.
2. **Stage 2 (`nginx:alpine`)**:
   - Copies *only* the compiled `/app/dist` folder into `/usr/share/nginx/html`.
   - Leaves Node, npm, and dev dependencies behind.
   - Result: Final container image size drops from ~1GB to **~25-30MB**.

### B. Custom Nginx Configuration (`nginx.conf`)
- **SPA Routing Fallback:** Added `try_files $uri $uri/ /index.html;` to direct all route navigation to React's client-side router.
- **Gzip Compression:** Enabled compression for CSS, JS, HTML, JSON, and SVG assets to reduce network transfer latency.
- **Static Asset Caching:** Configured a 1-year `Cache-Control` header for hashed static assets (`.js`, `.css`, images).

### C. Build-Time Environment Variable Injection
Vite inlines `import.meta.env.*` values at compile time. By declaring:
```dockerfile
ARG VITE_BACKEND_URL=http://localhost:5000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
```
The Docker image defaults to `http://localhost:5000` for local testing, while cloud deployments can pass custom URLs:
```bash
docker build --build-arg VITE_BACKEND_URL=https://api.example.com -t codemesh-frontend ./frontend
```

---

## 3. Usage Commands

```bash
# Build the container
docker build -t codemesh-frontend ./frontend

# Run the container mapping host port 8080 to container HTTP port 80
docker run -d -p 8080:80 --name codemesh-frontend codemesh-frontend
```
