# Deployment Guide: CodeMesh

Your application consists of three main parts:
1. **Frontend**: React (Vite)
2. **Backend**: Node.js (Express) with Socket.IO
3. **Database**: PostgreSQL (via Prisma)

Yes, deploying the **Frontend on Vercel** and the **Backend on Render** is a very standard and excellent approach for free hosting! However, for the PostgreSQL database, I recommend using **Neon.tech** or **Supabase**, as Render's free database expires after 90 days.

Here is the recommended stack for 100% free hosting:
* **Frontend**: [Vercel](https://vercel.com/) (Extremely fast, built for React/Vite)
* **Backend**: [Render](https://render.com/) (Great for Node.js + WebSockets, note: the free tier spins down after 15 minutes of inactivity)
* **Database**: [Neon](https://neon.tech/) (Free Serverless PostgreSQL that doesn't expire)

---

## Step 1: Push your code to GitHub
Make sure your entire `CodeMesh` folder is pushed to a single GitHub repository.

---

## Step 2: Set up the Database (Neon)
1. Go to [Neon.tech](https://neon.tech/) and sign up.
2. Create a new project (name it `codemesh-db`).
3. Once created, copy the **Connection String** (it should look like `postgresql://username:password@hostname/dbname?sslmode=require`).
4. Keep this URL handy, you will need it for your backend.

---

## Step 3: Deploy the Backend (Render)
1. Go to [Render](https://render.com/) and sign in with GitHub.
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository containing the `CodeMesh` project.
4. Fill in the following details:
   * **Name**: `codemesh-backend`
   * **Root Directory**: `backend` (This is important! It tells Render where your Node app is)
   * **Environment**: `Node`
   * **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy` (This installs dependencies, generates the Prisma client, and applies migrations to your Neon database safely for production)
   * **Start Command**: `npm start`
5. Scroll down to **Environment Variables** and add:
   * **`DATABASE_URL`** = (Paste the Neon connection string here)
   * **`PORT`** = `10000` (Render uses port 10000 by default)
   * **`FRONTEND_URL`** = (Leave this empty for now, we will update it after deploying Vercel to handle CORS)
   * **`JWT_SECRET`** = (Type any long, random string of characters here. This is used to encrypt user login sessions. Example: `my-super-secret-key-123!`)
6. Select the **Free** instance type and click **Create Web Service**.
7. Wait for it to build and deploy. Once live, copy your backend URL (e.g., `https://codemesh-backend.onrender.com`).

---

## Step 4: Prepare Frontend Environment Variables
In your frontend code, you probably have an API URL or Socket URL pointing to `http://localhost:3000` or similar. 
You need to change this to use an environment variable so it can connect to your new Render backend.

If you don't already have one, create a `.env` file in your `frontend` folder:
```env
VITE_BACKEND_URL=https://codemesh-backend.onrender.com
```

---

## Step 5: Deploy the Frontend (Vercel)
1. Go to [Vercel](https://vercel.com/) and sign in with GitHub.
2. Click **Add New...** -> **Project**.
3. Import your `CodeMesh` GitHub repository.
4. In the configuration settings:
   * **Root Directory**: Click `Edit` and select `frontend`.
   * **Framework Preset**: Vercel should automatically detect **Vite**.
5. Open the **Environment Variables** section and add:
   * **`VITE_BACKEND_URL`** = `https://codemesh-backend.onrender.com` (Your Render URL)
6. Click **Deploy**.
7. Once finished, Vercel will give you a live frontend URL (e.g., `https://codemesh-frontend.vercel.app`).

---

## Step 6: Update Backend CORS
Now that you have your frontend URL, you need to tell your backend to accept requests from it (CORS).
1. Go back to your **Render** dashboard.
2. Open your `codemesh-backend` web service.
3. Go to **Environment** (Environment Variables).
4. Add or update the variable:
   * **`FRONTEND_URL`** = `https://codemesh-frontend.vercel.app` (Your Vercel URL)
5. Save the changes. Render will automatically redeploy your backend with the new variables.

---

## Advanced: Production Branching & Auto-Deployments (Monorepo)

To work like a real production team, you should use branches (e.g., `main` for production, `staging` for testing) and ensure that your frontend and backend only deploy when their specific code changes. Since both `frontend` and `backend` are in the same repository (a "monorepo"), you need to configure Vercel and Render to ignore changes outside their respective folders.

### 1. Branching Strategy
* **`main` branch**: This is your production branch. Only stable, tested code should be merged here. Vercel and Render will monitor this branch for production deployments.
* **`staging` / `develop` branch**: Create a branch called `staging` for testing new features. Both Vercel and Render can be configured to watch this branch to create a "staging" or "preview" environment.
* **Feature branches**: When working on something new, create a branch like `feature/chat-ui`. When finished, create a Pull Request (PR) to merge it into `staging`, and eventually from `staging` into `main`.

### 2. Configure Vercel (Frontend) to only build on Frontend changes
Vercel has built-in monorepo support. Since you set the **Root Directory** to `frontend` in Step 5, Vercel will *automatically* skip the build if a commit only modifies files in the `backend` folder. No extra configuration is needed! Vercel is smart enough to detect this out of the box.

### 3. Configure Render (Backend) to only build on Backend changes
Render will normally rebuild your backend on *every* commit to the repository, even if you only changed the frontend. To fix this:
1. Go to your **Render** dashboard and open your `codemesh-backend` web service.
2. Go to the **Settings** tab.
3. Scroll down to the **Build Filter** (or **Filter by path**) section.
4. Add the path: `backend/**`
5. Save the changes. 



## You're done! 
Your app should now be live and fully functional on the internet for free.
