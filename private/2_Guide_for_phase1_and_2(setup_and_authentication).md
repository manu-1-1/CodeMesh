# CodeMesh: Master Architecture & Code Reference Guide

This document is a comprehensive architectural map and code reference guide for the **CodeMesh** project (Phases 1 & 2). It documents every file created, explains how they connect, and detail the technical decisions made.

---

## 1. How the Files Connect (Architecture Map)

Here is a visual map showing how the backend files interact to handle an authentication request:

```mermaid
flowchart TD
    Client[Client Browser / PowerShell] -- "1. Sends HTTP Request" --> Server[backend/src/index.js]
    
    subgraph Express Routing & Middleware
        Server -- "2. Routes /api/v1/auth/*" --> Router[backend/src/routes/auth.js]
        Router -- "3. Protects Route (/me)" --> Middleware[backend/src/middleware/auth.js]
    end
    
    subgraph Authentication Utilities
        Router -- "4. Hashes passwords / signs JWTs" --> Utils[backend/src/utils/auth.js]
    end

    subgraph Database Layer
        Router -- "5. Executes Queries" --> SharedPrisma[backend/src/lib/prisma.js]
        SharedPrisma -- "6. Loads connection string" --> Env[backend/.env]
        SharedPrisma -- "7. Connects via Pool" --> Postgres[(PostgreSQL Database)]
    end
```

### The Request Lifecycle Flow:
1. **Entry Point (`src/index.js`)**: The server initializes, configures global CORS settings and JSON parsing middleware, and listens on port `5000`. It acts as the gatekeeper, forwarding any request starting with `/api/v1/auth` to the auth router.
2. **Auth Router (`src/routes/auth.js`)**: Maps the sub-paths (`/register`, `/login`, `/me`) to their respective controller functions.
3. **Shared Database Instance (`src/lib/prisma.js`)**: To perform database operations, the router talks to the shared database file. This file ensures that `dotenv.config()` is executed *first* before any connection is made, loading your credentials from `.env` to connect to PostgreSQL.
4. **Security Utilities (`src/utils/auth.js`)**: When registering or logging in, the router calls this helper to either hash a new password using `bcrypt` or sign a JWT session token to return to the client.
5. **Session Verification (`src/middleware/auth.js`)**: When the user requests their profile via `/me`, the request must pass through this security guard. The middleware reads the token, decodes the user's ID, and validates it. If valid, it allows the router code to fetch the user profile.

---

## 2. Comprehensive File Breakdown

Here is the complete source code for each file in the workspace, along with detailed explanations.

### 2.1 Configuration Files

#### **`backend/package.json`**
```json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "CodeMesh Backend Service",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.13.3"
  },
  "devDependencies": {
    "nodemon": "^3.1.14",
    "prisma": "^7.8.0"
  }
}
```
* **`"type": "module"`**: Directs Node.js to treat our JavaScript files as ES Modules, enabling the `import/export` syntax instead of CommonJS `require()`.
* **`nodemon`**: A tool that monitors source code changes and automatically restarts the process, removing the need to restart the server manually.
* **`pg` & `@prisma/adapter-pg`**: The PostgreSQL node driver and its Prisma adapter. Needed because Prisma 7 requires driver adapters to handle database connections.

---

#### **`backend/.gitignore`**
```git
node_modules/
# Keep environment variables out of version control
.env

/generated/prisma
```
* **Why**: Prevents massive folders (`node_modules/`) and sensitive server secrets (`.env` containing database passwords) from being committed to Git.

---

#### **`backend/.env`**
```env
DATABASE_URL="postgresql://postgres:op%40098@localhost:5432/codemesh?schema=public"
PORT=5000
JWT_SECRET="your-long-random-secret-key
```
* **`DATABASE_URL`**: Connects to the PostgreSQL instance running locally. The `@` character in the password `your_password` and it should be URL-encoded so it doesn't break URL path parsing.
* **`JWT_SECRET`**: A private key used by the cryptographic algorithm to sign and verify our authentication tokens.

---

### 2.2 Database Layer

#### **`backend/prisma/schema.prisma`**
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  OWNER
  ADMIN
  MEMBER
}

model User {
  id           String            @id @default(uuid())
  name         String
  email        String            @unique
  passwordHash String
  avatarUrl    String?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  workspaces   Workspace[]       @relation("WorkspaceOwner")
  memberships  WorkspaceMember[]

  @@map("users")
}

model Workspace {
  id          String            @id @default(uuid())
  name        String
  description String?
  ownerId     String
  owner       User              @relation("WorkspaceOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  members     WorkspaceMember[]

  @@map("workspaces")
}

model WorkspaceMember {
  workspaceId String
  userId      String
  role        Role      @default(MEMBER)
  joinedAt    DateTime  @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([workspaceId, userId])
  @@map("workspace_members")
}
```
* **UUIDs (`uuid()`)**: Using Universally Unique Identifiers (e.g., `f25aef8e-321a-4402...`) prevents sequential ID scanning attacks.
* **Workspace Roles**: Storing the user `role` in the relation table (`WorkspaceMember`) rather than on the `User` model allows the user to have different permissions depending on the workspace.
* **Cascading Deletes (`onDelete: Cascade`)**: Ensures that if a workspace is deleted, all its memberships are wiped automatically to clean up database space.

---

#### **`backend/src/lib/prisma.js`**
```javascript
import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from '@prisma/client';

const { PrismaClient } = pkg;

// Load environment variables immediately before database initialization
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
```
* **Why**: Solves the ES Modules initialization order bug. By calling `dotenv.config()` here before `new pg.Pool(...)` is evaluated, we ensure `process.env.DATABASE_URL` is loaded.
* **Reuse Connection Pool**: Exporting a single `prisma` instance guarantees the entire server shares one database connection pool, preventing connection leaks.

---

### 2.3 Middleware & Utilities

#### **`backend/src/utils/auth.js`**
```javascript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;

// Hash user password
export const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

// Compare plain-text password with hashed password
export const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

// Generate JWT Token
export const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '24h',
    });
};
```
* **`bcrypt.hash()`**: Salting hashes (10 rounds) ensures that even if two users choose the same password, they will have completely different hashes stored in the database.
* **`jwt.sign()`**: Packages the user ID into a secure token string, which expires in 24 hours.

---

#### **`backend/src/middleware/auth.js`**
```javascript
import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Expecting format: "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: decoded.id };
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
```
* **`req.user = { id: decoded.id }`**: Attaches the validated user ID to the request object so subsequent handlers know exactly who is calling them.
* **`next()`**: Passes control to the actual endpoint controller if verification passes.

---

### 2.4 Server & Router

#### **`backend/src/routes/auth.js`**
```javascript
import express from 'express';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

// 1. Register User
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    try {
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email is already in use' });
        }

        // Hash password & Save
        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash: hashedPassword,
            },
        });

        // Generate token
        const token = generateToken(user.id);

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: user.id, name: user.name, email: user.email },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Login User
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get Current User Profile (Secured)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```
* **Security best practice**: On login failure, we send `"Invalid email or password"` instead of distinguishing whether the email was wrong or the password was wrong. This prevents attackers from guessing valid emails registered on our platform.
* **`select` Object**: Specifically filters out the `passwordHash` field when returning the user profile from `/me`.

---

#### **`backend/src/index.js`**
```javascript
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import { prisma } from './lib/prisma.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Auth routes registration
app.use('/api/v1/auth', authRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'UP', database: 'CONNECTED' });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
```
* **`express.json()`**: Extracts incoming request payload and binds it to `req.body`.
* **Health Check**: Executes `SELECT 1` on the database to make sure the database is alive and connected.

---

### 2.5 Testing Script

#### **`backend/test_auth.js`**
```javascript
const BASE_URL = 'http://localhost:5000/api/v1/auth';
const testUser = {
  name: "Test User",
  email: `test_${Date.now()}@example.com`,
  password: "password123"
};

async function runTests() {
  console.log("=== Testing Authentication Endpoints ===");
  
  // 1. Test Register
  console.log("\n1. Registering new user...");
  try {
    const registerResponse = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const registerData = await registerResponse.json();
    console.log(`Status: ${registerResponse.status}`);
    console.log("Response:", registerData);
    
    if (registerResponse.status !== 201) {
      throw new Error("Registration failed");
    }
    
    const token = registerData.token;
    
    // 2. Test Login
    console.log("\n2. Logging in...");
    const loginResponse = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    const loginData = await loginResponse.json();
    console.log(`Status: ${loginResponse.status}`);
    console.log("Response:", loginData);
    
    if (loginResponse.status !== 200) {
      throw new Error("Login failed");
    }
    
    // 3. Test Private Route (/me)
    console.log("\n3. Fetching user profile (/me)...");
    const meResponse = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const meData = await meResponse.json();
    console.log(`Status: ${meResponse.status}`);
    console.log("Response:", meData);
    
    if (meResponse.status === 200) {
      console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY!");
    } else {
      console.log("\n❌ Private profile check failed.");
    }
  } catch (error) {
    console.error("\n❌ Test failed with error:", error.message);
  }
}

runTests();
```
* **Why**: Automates the integration testing process using native Node.js `fetch` without needing external API clients like Postman.

---

## 3. Key Technical Challenges and Solutions

| Problem | Cause | Solution |
|---|---|---|
| **`client password must be a string`** | ES Modules hoisting executed the routes (which connected to the database) before `dotenv.config()` could read the environment file. | Created `src/lib/prisma.js` to run `dotenv.config()` first, ensuring database credentials load before initialization. |
| **Database connection parsing error** | The database password `op@098` contains `@`, which conflicts with the URL syntax (`user:password@host`). | URL-encoded the `@` character as `%40` in `.env`. |
| **Prisma 7 instantiation error** | Prisma 7 no longer embeds query engines. Calling `new PrismaClient()` without adapters throws an error. | Installed `pg` and `@prisma/adapter-pg` to build a manual connection adapter pool. |
| **PowerShell `curl` errors** | PowerShell defines `curl` as an alias to `Invoke-WebRequest`, which parses JSON headers differently than standard curl. | Used PowerShell's native **`Invoke-RestMethod`** for direct testing, which handles JSON strings cleanly. |
