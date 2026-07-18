# Deployment Guide: CodeMesh

My application consists of three main parts:
1. **Frontend**: React (Vite)
2. **Backend**: Node.js (Express) with Socket.IO
3. **Database**: PostgreSQL (via Prisma)

Yes, deploying the **Frontend on Vercel** and the **Backend on Render** is a very standard and excellent approach for free hosting! However, for the PostgreSQL database, I decided to use **Neon.tech** or **Supabase**, as Render's free database expires after 90 days.

Here is the stack I used for 100% free hosting:
* **Frontend**: [Vercel](https://vercel.com/) (Extremely fast, built for React/Vite)
* **Backend**: [Render](https://render.com/) (Great for Node.js + WebSockets, note: the free tier spins down after 15 minutes of inactivity)
* **Database**: [Neon](https://neon.tech/) (Free Serverless PostgreSQL that doesn't expire)

---

## Step 1: Push my code to GitHub
I made sure my entire `CodeMesh` folder was pushed to a single GitHub repository.

---

## Step 2: Set up the Database (Neon)
1. I went to [Neon.tech](https://neon.tech/) and signed up.
2. I created a new project (named it `codemesh-db`).
3. Once created, I copied the **Connection String** (it looked like `postgresql://username:password@hostname/dbname?sslmode=require`).
4. I kept this URL handy, as I needed it for my backend.

---

## Step 3: Deploy the Backend (Render)
1. I went to [Render](https://render.com/) and signed in with GitHub.
2. I clicked **New +** and selected **Web Service**.
3. I connected my GitHub repository containing the `CodeMesh` project.
4. I filled in the following details:
   * **Name**: `codemesh-backend`
   * **Root Directory**: `backend` (This is important! It tells Render where my Node app is)
   * **Environment**: `Node`
   * **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy` (This installs dependencies, generates the Prisma client, and applies migrations to my Neon database safely for production)
   * **Start Command**: `npm start`
5. I scrolled down to **Environment Variables** and added:
   * **`DATABASE_URL`** = (I pasted the Neon connection string here)
   * **`PORT`** = `10000` (Render uses port 10000 by default)
   * **`FRONTEND_URL`** = (I left this empty for now, I updated it after deploying Vercel to handle CORS)
   * **`JWT_SECRET`** = (I typed a long, random string of characters here. This is used to encrypt user login sessions. Example: `my-super-secret-key-123!`)
6. I selected the **Free** instance type and clicked **Create Web Service**.
7. I waited for it to build and deploy. Once live, I copied my backend URL (e.g., `https://codemesh-backend.onrender.com`).

---

## Step 4: Prepare Frontend Environment Variables
In my frontend code, I had an API URL and Socket URL pointing to `http://localhost:5000` or similar. 
I needed to change this to use an environment variable so it could connect to my new Render backend.

I created a `.env` file in my `frontend` folder:
```env
VITE_BACKEND_URL=https://codemesh-backend.onrender.com
```

---

## Step 5: Deploy the Frontend (Vercel)
1. I went to [Vercel](https://vercel.com/) and signed in with GitHub.
2. I clicked **Add New...** -> **Project**.
3. I imported my `CodeMesh` GitHub repository.
4. In the configuration settings:
   * **Root Directory**: I clicked `Edit` and selected `frontend`.
   * **Framework Preset**: Vercel automatically detected **Vite**.
5. I opened the **Environment Variables** section and added:
   * **`VITE_BACKEND_URL`** = `https://codemesh-backend.onrender.com` (My Render URL)
6. I clicked **Deploy**.
7. Once finished, Vercel gave me a live frontend URL (e.g., `https://codemesh-frontend.vercel.app`).

---

## Step 6: Update Backend CORS
Now that I had my frontend URL, I needed to tell my backend to accept requests from it (CORS).
1. I went back to my **Render** dashboard.
2. I opened my `codemesh-backend` web service.
3. I went to **Environment** (Environment Variables).
4. I added or updated the variable:
   * **`FRONTEND_URL`** = `https://codemesh-frontend.vercel.app` (My Vercel URL)
5. I saved the changes. Render automatically redeployed my backend with the new variables.

---

## Advanced: Production Branching & Auto-Deployments (Monorepo)

To work like a real production team, I used branches (e.g., `main` for production, `staging` for testing) and ensured that my frontend and backend only deploy when their specific code changes. Since both `frontend` and `backend` are in the same repository (a "monorepo"), I configured Vercel and Render to ignore changes outside their respective folders.

### 1. Branching Strategy
* **`main` branch**: This is my production branch. Only stable, tested code should be merged here. Vercel and Render will monitor this branch for production deployments.
* **`staging` / `develop` branch**: I created a branch called `staging` for testing new features. Both Vercel and Render can be configured to watch this branch to create a "staging" or "preview" environment.
* **Feature branches**: When working on something new, I create a branch like `feature/chat-ui`. When finished, I create a Pull Request (PR) to merge it into `staging`, and eventually from `staging` into `main`.

### 2. Configure Vercel (Frontend) to only build on Frontend changes
Vercel has built-in monorepo support. Since I set the **Root Directory** to `frontend` in Step 5, Vercel *automatically* skips the build if a commit only modifies files in the `backend` folder. No extra configuration was needed! Vercel is smart enough to detect this out of the box.

### 3. Configure Render (Backend) to only build on Backend changes
Render would normally rebuild my backend on *every* commit to the repository, even if I only changed the frontend. To fix this:
1. I went to my **Render** dashboard and opened my `codemesh-backend` web service.
2. I went to the **Settings** tab.
3. I scrolled down to the **Build Filter** (or **Filter by path**) section.
4. I added the path: `backend/**`
5. I saved the changes. 



## I'm done! 
My app is now live and fully functional on the internet for free.
