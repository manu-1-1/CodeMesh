# Deployment Journey: CodeMesh

This document summarizes all the work we have completed to take your CodeMesh application from a local development environment to a fully deployed, professional-grade production environment!

## 1. The Architecture
We successfully decoupled your application and deployed it across three specialized, free-tier services:
- **Frontend (Vite/React)**: Deployed on **Vercel** for lightning-fast, edge-cached static hosting.
- **Backend (Node.js/Socket.IO)**: Deployed as a Web Service on **Render** to maintain the persistent WebSocket connections required for your chat application.
- **Database (PostgreSQL)**: Hosted on **Neon.tech** to provide a persistent, serverless database that doesn't expire.

## 2. Backend Configuration & Fixes (Render)
While deploying the backend to Render, we applied several critical fixes to ensure it worked in a production environment:
- **Prisma Build Fix**: We updated the build command to `npm install && npx prisma generate && npx prisma migrate deploy`. This ensures the Prisma Client is generated *after* dependencies are installed and uses the safe `deploy` command instead of `dev` for production.
- **Root Directory Filter**: We set the Root Directory to `backend`. This automatically configured Render to ignore any changes happening in your frontend folder, solving the monorepo deployment issue.
- **Authentication Fix**: When the server crashed with `secretOrPrivateKey must have a value`, we identified that the `JWT_SECRET` was missing. We added this to the Render environment variables to securely sign user login tokens.

## 3. Frontend Configuration & Fixes (Vercel)
To successfully deploy the frontend on Vercel, we had to bridge the gap between your local computer and the cloud:
- **Removed Hardcoded URLs**: We found that `api.js` and `ChatArea.jsx` were hardcoded to talk to `http://localhost:5000`. We updated the code to use `import.meta.env.VITE_BACKEND_URL`, which allows the code to dynamically connect to the Render backend in production while falling back to `localhost` for local development.
- **Secured Environment Variables**: 
  > [!CAUTION]
  > We caught a critical security risk where the `frontend/.env` file was staged to be committed to GitHub. 
  
  We removed it from the staging area and added `.env` to your `frontend/.gitignore` file. We then configured Vercel to use the environment variables directly from its dashboard.
- **Vercel Monorepo Support**: By setting the Root Directory to `frontend` in Vercel, it automatically recognized the Vite framework and configured itself to only deploy when frontend files are changed.

## 4. Professional Branching Strategy Setup
We established a real-world CI/CD (Continuous Integration / Continuous Deployment) pipeline using branching:
- **`main` Branch**: This is your protected production branch. Render and Vercel are watching this branch to deploy the live website.
- **`staging` Branch**: We created this branch for testing. 
- **Preview Deployments**: Because of Vercel's intelligent defaults, anytime you push code to your `staging` branch (or any branch that isn't `main`), Vercel will automatically generate a private Preview URL. You can test your new frontend features on this secret URL before merging them into `main`.

---

### What's Next?
Your application is now live, secure, and configured like a professional tech company's infrastructure. 
If you want to take it even further in the future, you can look into implementing the **GitHub Actions**  to run automated tests on your `staging` branch before you merge!
