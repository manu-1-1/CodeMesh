# Dev Diary 24: Dockerizing the Backend Service

**Date:** November 16, 2026  
**Focus:** Creating an optimized, production-ready Dockerfile and `.dockerignore` for the CodeMesh Express and Prisma backend.

---

## 1. The Goal

To prepare the CodeMesh backend for containerized local development and cloud deployments (e.g., Docker Compose, AWS ECS, Render, or Kubernetes), we needed a standardized `Dockerfile`. The container had to:
1. Support Node.js with ES modules (`"type": "module"`).
2. Handle native dependencies like `bcrypt`.
3. Provide the required OpenSSL libraries for Prisma ORM query engine execution on Linux.
4. Leverage Docker layer caching for rapid rebuilds.
5. Prevent local files (`node_modules`, `.env`) from leaking into the container image.

---

## 2. Key Technical Decisions

### A. Base Image: `node:20-slim`
- **Why not `node:latest`?** `latest` is non-deterministic and can pull untested major Node releases. It also ships with full build tools, creating bloated images (>1GB).
- **Why not Alpine (`node:20-alpine`)?** While Alpine is tiny (~120MB), it uses `musl libc` instead of `glibc`. Native C++ modules like `bcrypt` and Prisma's query engine often face binary compatibility hurdles on Alpine without installing additional compilers.
- **Why `node:20-slim`?** It uses standard Debian `glibc`, keeps the footprint down to ~200MB, and provides a stable, zero-friction environment for Prisma and `bcrypt`.

### B. Installing OpenSSL
Prisma's Linux query engine relies on system OpenSSL libraries:
```dockerfile
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
```
Cleaning `/var/lib/apt/lists/*` keeps the final image lightweight.

### C. Layer Caching for Dependencies & Prisma
To optimize rebuild times:
1. `package*.json`, `prisma/`, and `prisma.config.ts` are copied first.
2. `npm install` and `npx prisma generate` run immediately after.
3. Only then is the application source code (`src/`) copied.

When developers change code in `src/`, Docker skips package installation and Prisma generation entirely, finishing rebuilds in seconds.

### D. Security & Sanitation with `.dockerignore`
We added `.dockerignore` to explicitly prevent:
- Local Windows `node_modules` from overwriting Linux container binaries.
- Sensitive environment files (`.env`) from being baked into the image.
- Test logs, Git metadata, and local integration test suites from polluting the production container.

---

## 3. Usage Commands

```bash
# Build the container
docker build -t codemesh-backend ./backend

# Run container with environment configuration
docker run -d -p 5000:5000 --env-file backend/.env codemesh-backend
```
