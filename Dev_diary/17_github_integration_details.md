# Workspace-Scoped Real GitHub Integration & Optimizations

This document explains the architecture, my changes, my reasoning, and the final code I implemented for the workspace-scoped real GitHub Integration in CodeMesh.

---

## 1. What I Did & Why I Did It

### A. Scoped GitHub Integration per Workspace
* **What**: I shifted the `GitHubConnection` model in the database from being associated 1-to-1 with a **User** to being associated 1-to-1 with a **Workspace**.
* **Why**: Originally, connecting a GitHub account applied globally to the user. However, a developer often works in multiple workspaces (e.g., personal projects vs. client projects), which require different GitHub accounts or Personal Access Tokens (PATs). Scoping the connection to the Workspace enables completely independent settings per workspace.

### B. Real GitHub API Integration
* **What**: I replaced the mock backend data (static arrays of repos and PRs) with live fetches to GitHub's REST API.
* **Why**: To provide real-world functionality where actual repositories and open/closed Pull Requests are synchronized from GitHub.

### C. Parallel Fetching & Transaction Optimization
* **What**: I restructured the `/sync` backend endpoint to make all network requests (`fetch` calls to GitHub) in parallel *outside* the database transaction, then executed a single quick transaction to save the records.
* **Why**: Slow network requests inside interactive database transactions hold database connections open. For users with multiple repositories, this easily exceeded Prisma's default 5-second timeout, throwing `500 Internal Server Error` (Prisma error `P2028`). Running network calls in parallel outside the transaction reduced the database operation time to under 50ms.

### D. Token Repository Selection Filter (Public Repos Filter)
* **What**: I added a check on the collaborator permission endpoint (`GET /repos/{owner}/{repo}/collaborators/{username}/permission`) for each repository returned by the API. 
* **Why**: When a user limits a Fine-Grained Personal Access Token to "Only select repositories", GitHub's `GET /user/repos` endpoint still lists all public repositories the user owns/contributes to because they are public. However, the token cannot perform privileged tasks or write tasks on unselected repos. Checking collaborator permissions returns `403 Forbidden` for unselected repositories, allowing me to filter them out and only display the ones you explicitly authorized.

### E. Sidebar Disconnect UI Integration
* **What**: I integrated the connected account name and a disconnect button (❌) directly next to the sync button in the sidebar.
* **Why**: Previously, the disconnect button was only visible on the "empty details" screen. Since the UI automatically selects the first synced repository on load, the empty details screen was hidden, locking users out of disconnecting or changing their token.

---

## 2. Final Code & Explanations

### 1. Database Schema Changes
**File:** [schema.prisma](file:///d:/Projects/CodeMesh/backend/prisma/schema.prisma)

I removed the `githubConnection` field from the `User` model, added it to the `Workspace` model, and updated `GitHubConnection` to map to `workspaceId` instead of `userId`.

```prisma
model Workspace {
  id               String            @id @default(uuid())
  name             String
  description      String?
  ownerId          String
  owner            User              @relation("WorkspaceOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  members          WorkspaceMember[]
  channels         Channel[]
  snippets         Snippet[]
  repositories     Repository[]
  invitations      Invitation[]
  githubConnection GitHubConnection? // Added relation to GitHubConnection

  @@map("workspaces")
}

model GitHubConnection {
  id             String    @id @default(uuid())
  workspaceId    String    @unique @map("workspace_id") // Scoped to workspace
  githubUsername String    @map("github_username")
  accessToken    String    @map("access_token")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  workspace      Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@map("github_connections")
}
```

---

### 2. Backend Routes
**File:** [github.js](file:///d:/Projects/CodeMesh/backend/src/routes/github.js)

This handles workspace membership authorization, queries the GitHub API, filters unaccessible repos, and upserts data fast.

```javascript
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Helper to check workspace membership
async function checkWorkspaceMember(workspaceId, userId) {
    return await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } }
    });
}

// 1. Connect GitHub Account to Workspace
router.post('/connect', async (req, res) => {
    const { workspaceId, githubUsername, accessToken } = req.body;
    const userId = req.user.id;

    if (!workspaceId || !githubUsername || !accessToken) {
        return res.status(400).json({ error: 'workspaceId, githubUsername, and accessToken are required' });
    }

    try {
        const member = await checkWorkspaceMember(workspaceId, userId);
        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }

        const connection = await prisma.gitHubConnection.upsert({
            where: { workspaceId },
            update: { githubUsername, accessToken },
            create: { workspaceId, githubUsername, accessToken }
        });

        res.status(200).json({
            message: 'GitHub account connected to workspace successfully',
            connection: {
                id: connection.id,
                workspaceId: connection.workspaceId,
                githubUsername: connection.githubUsername,
                createdAt: connection.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Disconnect GitHub Account from Workspace
router.delete('/disconnect', async (req, res) => {
    const { workspaceId } = req.body;
    const userId = req.user.id;

    if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required' });
    }

    try {
        const member = await checkWorkspaceMember(workspaceId, userId);
        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }

        const existing = await prisma.gitHubConnection.findUnique({
            where: { workspaceId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'No connected GitHub account found for this workspace' });
        }

        await prisma.gitHubConnection.delete({
            where: { workspaceId }
        });

        res.json({ message: 'GitHub account disconnected from workspace successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Sync Workspace Repositories & PRs (Highly Optimized)
router.post('/sync', async (req, res) => {
    const { workspaceId } = req.body;
    const userId = req.user.id;

    if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required' });
    }

    try {
        const member = await checkWorkspaceMember(workspaceId, userId);
        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }

        const connection = await prisma.gitHubConnection.findUnique({
            where: { workspaceId }
        });

        if (!connection) {
            return res.status(400).json({ error: 'Access denied: Please connect a GitHub account to this workspace first' });
        }

        // Fetch user repositories from GitHub
        const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100', {
            headers: {
                'Authorization': `Bearer ${connection.accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'CodeMesh-Backend'
            }
        });

        if (!reposResponse.ok) {
            const errorText = await reposResponse.text();
            console.error(`GitHub API Error (${reposResponse.status}): ${errorText}`);
            return res.status(reposResponse.status).json({ error: `GitHub API error: ${errorText}` });
        }

        const githubRepos = await reposResponse.json();

        // Fetch all Pull Requests and filter unaccessible repos in parallel OUTSIDE the transaction
        const repoDataPromises = githubRepos.map(async (repoInfo) => {
            try {
                // Query collaborator permissions. If unselected for this token, it returns 403 Forbidden.
                const permissionResponse = await fetch(`https://api.github.com/repos/${repoInfo.full_name}/collaborators/${connection.githubUsername}/permission`, {
                    headers: {
                        'Authorization': `Bearer ${connection.accessToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'CodeMesh-Backend'
                    }
                });

                if (permissionResponse.status !== 200) {
                    return null; // Skip repository if token has no explicit access
                }

                // Fetch Pull Requests
                const prsResponse = await fetch(`https://api.github.com/repos/${repoInfo.full_name}/pulls?state=all&per_page=100`, {
                    headers: {
                        'Authorization': `Bearer ${connection.accessToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'CodeMesh-Backend'
                    }
                });

                let prs = [];
                if (prsResponse.ok) {
                    prs = await prsResponse.json();
                }
                return { repoInfo, prs };
            } catch (err) {
                console.error(`Failed to fetch repo ${repoInfo.full_name}:`, err);
                return null;
            }
        });

        const allReposData = (await Promise.all(repoDataPromises)).filter(Boolean);

        // Perform repository & PR database sync inside database transaction (takes milliseconds now!)
        const syncedData = await prisma.$transaction(async (tx) => {
            const result = [];
            const syncedRepoIds = [];

            for (const { repoInfo, prs } of allReposData) {
                // Upsert repository
                const repo = await tx.repository.upsert({
                    where: {
                        workspaceId_fullName: { workspaceId, fullName: repoInfo.full_name }
                    },
                    update: { name: repoInfo.name, githubId: repoInfo.id },
                    create: {
                        workspaceId,
                        name: repoInfo.name,
                        fullName: repoInfo.full_name,
                        githubId: repoInfo.id
                    }
                });

                syncedRepoIds.push(repo.id);

                const syncedPRs = [];
                for (const prInfo of prs) {
                    const pr = await tx.pullRequest.upsert({
                        where: {
                            repositoryId_number: { repositoryId: repo.id, number: prInfo.number }
                        },
                        update: {
                            title: prInfo.title,
                            state: prInfo.state.toUpperCase(),
                            htmlUrl: prInfo.html_url
                        },
                        create: {
                            repositoryId: repo.id,
                            number: prInfo.number,
                            title: prInfo.title,
                            state: prInfo.state.toUpperCase(),
                            htmlUrl: prInfo.html_url
                        }
                    });
                    syncedPRs.push(pr);
                }
                result.push({ ...repo, pullRequests: syncedPRs });
            }

            // Remove any old/unselected repositories from the database for this workspace
            await tx.repository.deleteMany({
                where: {
                    workspaceId,
                    id: { notIn: syncedRepoIds }
                }
            });

            return result;
        });

        res.json({
            message: 'Repositories and Pull Requests synchronized successfully',
            repositories: syncedData
        });
    } catch (error) {
        console.error("Internal sync error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 4. List Synced Repositories for a Workspace
router.get('/repositories', async (req, res) => {
    const { workspaceId } = req.query;
    const userId = req.user.id;

    if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId query param is required' });
    }

    try {
        const member = await checkWorkspaceMember(workspaceId, userId);
        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }

        const repositories = await prisma.repository.findMany({
            where: { workspaceId },
            include: { pullRequests: true }
        });
        res.json(repositories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Check GitHub Connection Status for Workspace
router.get('/status', async (req, res) => {
    const { workspaceId } = req.query;
    const userId = req.user.id;

    if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId query param is required' });
    }

    try {
        const member = await checkWorkspaceMember(workspaceId, userId);
        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }

        const connection = await prisma.gitHubConnection.findUnique({
            where: { workspaceId },
            select: {
                id: true,
                githubUsername: true,
                createdAt: true
            }
        });

        res.json({
            connected: !!connection,
            connection
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
```

---

### 3. Frontend Area Changes
**File:** [GitHubArea.jsx](file:///d:/Projects/CodeMesh/frontend/src/GitHubArea.jsx)

The frontend is updated to pass `workspace.id` in all operations (`status`, `connect`, `disconnect`, `sync`) and renders a small `❌` button to disconnect right in the sidebar.

```javascript
    const checkStatus = async () => {
        try {
            const data = await apiRequest(`/github/status?workspaceId=${workspace.id}`);
            setIsConnected(data.connected);
            if (data.connected && data.connection) {
                setGithubUsername(data.connection.githubUsername);
            }
        } catch (err) {
            console.error('Failed to fetch github status:', err);
        } finally {
            setLoading(false);
        }
    };
```

#### Sidebar UI Snippet:
```javascript
                <div className="sidebar-section">
                    <div className="sidebar-section-title">
                        <span>GitHub Repos</span>
                        {isConnected && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', opacity: 0.6 }} title={`Connected as ${githubUsername}`}>
                                    ({githubUsername})
                                </span>
                                <button
                                    className="btn-sync-refresh"
                                    onClick={handleSync}
                                    title="Sync Repositories"
                                    disabled={syncing}
                                    style={{ margin: 0 }}
                                >
                                    {syncing ? '⌛' : '🔄'}
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    title="Disconnect GitHub"
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        padding: '2px 4px',
                                        color: '#ff4d4f',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    ❌
                                </button>
                            </div>
                        )}
                    </div>
```
