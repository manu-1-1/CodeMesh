# CodeMesh

CodeMesh is a real-time developer collaboration platform. It integrates workspace messaging, chat channels, code snippet sharing, automated peer feedback, and AI-powered code reviews.

## Architecture and Features

CodeMesh is structured as a client-server web application with a React frontend and a Node.js Express backend using a PostgreSQL database.

### 1. Workspace and Member Management
* **Workspaces**: High-level organizational environments containing channels, projects, members, and shared resources.
* **Role-Based Access Control**: Standard roles (Owner, Admin, Member) governing resource creation, modification, and deletion.
* **Member Invitations**: Internal workspace invitation flows managing invite lifecycle states (Pending, Accepted, Declined).

### 2. Real-Time Chat and Messaging
* **Channels**: Multiple chat rooms dedicated to project discussions or code reviews.
* **Socket.IO Integration**: Supports instant message delivery, live typing indications, message editing, and deletion.
* **History Persistence**: Messages are saved in PostgreSQL to provide complete chat logs and audit trails.

### 3. Code Snippet Sharing
* **Snippets**: Developers can publish code blocks labeled by programming language (JavaScript, Python, Go, etc.).
* **Review Loop**: Snippets are linked directly to reviewers or automated feedback utilities.

### 4. Multi-Provider AI Code Review
* **AI Integration**: Out-of-the-box support for Ollama, OpenAI, Anthropic, and Gemini.
* **Structured Feedback**: Automated review returns specific actionable points categorized under security, quality, and style.

### 5. GitHub Integration
* **Account Linkage**: Workspaces connect directly to GitHub using access tokens.
* **Repository Syncing**: Imports repository lists, tracks branches, and displays commit/PR metadata within the workspace interface.

---

## Technology Stack

### Backend
* **Runtime & Framework**: Node.js, Express
* **Database & ORM**: PostgreSQL, Prisma ORM
* **Real-Time Communication**: Socket.IO
* **Security & Auth**: JSON Web Tokens (JWT), bcrypt password hashing

### Frontend
* **UI Library**: React (Vite bundler)
* **Styling**: Vanilla CSS
* **Icons**: Lucide React
* **Socket Integration**: Socket.IO-Client

---

## Directory Structure

```text
├── backend/
│   ├── prisma/             # Database schema and migration logs
│   └── src/
│       ├── lib/            # Shared service initializers (Prisma, Socket)
│       ├── middleware/     # Auth and request verification middlewares
│       ├── routes/         # Express API endpoints
│       ├── utils/          # AI reviewer helpers
│       └── index.js        # Server entry point
├── frontend/
│   ├── src/
│   │   ├── assets/         # Static assets and images
│   │   └── index.css       # Core styles and global design tokens
│   ├── index.html          # Frontend page template
│   └── vite.config.js      # Vite build configuration
└── docs/                   # Specifications and technical design guides
```

---

## Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **PostgreSQL**: Local running instance or cloud database URI

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root of the `backend` directory based on the following template:
   ```env
   DATABASE_URL="postgresql://<username>:<password>@<host>:<port>/<db_name>?schema=public"
   PORT=5000
   JWT_SECRET="your-jwt-secret-key"
   ```

4. Run the database migrations to set up schema tables:
   ```bash
   npm run db:migrate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```
   The backend server will run on `http://localhost:5000`.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root of the `frontend` directory:
   ```env
   VITE_BACKEND_URL=http://localhost:5000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend application will be accessible at `http://localhost:5173`.

---

## Running Tests

The backend tests perform HTTP requests against the running service. 

1. Ensure the backend server is active:
   ```bash
   cd backend
   npm run dev
   ```

2. In a separate terminal session, run the validation tests:
   ```bash
   cd backend
   npm run test
   ```

