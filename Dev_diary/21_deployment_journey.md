# Deployment Journey: CodeMesh

This document summarizes all the work I have completed to take my CodeMesh application from a local development environment to a fully deployed, professional-grade production environment!

## 1. The Architecture
I successfully decoupled my application and deployed it across three specialized, free-tier services:
- **Frontend (Vite/React)**: Deployed on **Vercel** for lightning-fast, edge-cached static hosting.
- **Backend (Node.js/Socket.IO)**: Deployed as a Web Service on **Render** to maintain the persistent WebSocket connections required for my chat application.
- **Database (PostgreSQL)**: Hosted on **Neon.tech** to provide a persistent, serverless database that doesn't expire.

## 2. Backend Configuration & Fixes (Render)
While deploying the backend to Render, I applied several critical fixes to ensure it worked in a production environment:
- **Prisma Build Fix**: I updated the build command to `npm install && npx prisma generate && npx prisma migrate deploy`. This ensures the Prisma Client is generated *after* dependencies are installed and uses the safe `deploy` command instead of `dev` for production.
- **Root Directory Filter**: I set the Root Directory to `backend`. This automatically configured Render to ignore any changes happening in my frontend folder, solving the monorepo deployment issue.
- **Authentication Fix**: When the server crashed with `secretOrPrivateKey must have a value`, I identified that the `JWT_SECRET` was missing. I added this to the Render environment variables to securely sign user login tokens.

## 3. Frontend Configuration & Fixes (Vercel)
To successfully deploy the frontend on Vercel, I had to bridge the gap between my local computer and the cloud:
- **Removed Hardcoded URLs**: I found that `api.js` and `ChatArea.jsx` were hardcoded to talk to `http://localhost:5000`. I updated the code to use `import.meta.env.VITE_BACKEND_URL`, which allows the code to dynamically connect to the Render backend in production while falling back to `localhost` for local development.
- **Secured Environment Variables**: 
  > [!CAUTION]
  > I caught a critical security risk where my `frontend/.env` file was staged to be committed to GitHub. 
  
  I removed it from the staging area and added `.env` to my `frontend/.gitignore` file. I then configured Vercel to use the environment variables directly from its dashboard.
- **Vercel Monorepo Support**: By setting the Root Directory to `frontend` in Vercel, it automatically recognized the Vite framework and configured itself to only deploy when frontend files are changed.

## 4. Professional Branching Strategy Setup
I established a real-world CI/CD (Continuous Integration / Continuous Deployment) pipeline using branching:
- **`main` Branch**: This is my protected production branch. Render and Vercel are watching this branch to deploy the live website.
- **`staging` Branch**: I created this branch for testing. 
- **Preview Deployments**: Because of Vercel's intelligent defaults, anytime I push code to my `staging` branch (or any branch that isn't `main`), Vercel will automatically generate a private Preview URL. I can test my new frontend features on this secret URL before merging them into `main`.

---

### What's Next?
My application is now live, secure, and configured like a professional tech company's infrastructure. 
If I want to take it even further in the future, I can look into implementing **GitHub Actions** to run automated tests on my `staging` branch before I merge!
