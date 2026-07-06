import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// 1. Connect GitHub Account (POST /api/v1/github/connect)
router.post('/connect', async (req, res) => {
    const { githubUsername, accessToken } = req.body;
    const userId = req.user.id;
    if (!githubUsername || !accessToken) {
        return res.status(400).json({ error: 'githubUsername and accessToken are required' });
    }
    try {
        const connection = await prisma.gitHubConnection.upsert({
            where: { userId },
            update: { githubUsername, accessToken },
            create: { userId, githubUsername, accessToken }
        });
        res.status(200).json({
            message: 'GitHub account connected successfully',
            connection: {
                id: connection.id,
                githubUsername: connection.githubUsername,
                createdAt: connection.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Disconnect GitHub Account (DELETE /api/v1/github/disconnect)
router.delete('/disconnect', async (req, res) => {
    const userId = req.user.id;
    try {
        const existing = await prisma.gitHubConnection.findUnique({
            where: { userId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'No connected GitHub account found' });
        }
        await prisma.gitHubConnection.delete({
            where: { userId }
        });
        res.json({ message: 'GitHub account disconnected successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// 3. Sync Workspace Repositories & PRs (POST /api/v1/github/sync)
router.post('/sync', async (req, res) => {
    const { workspaceId } = req.body;
    const userId = req.user.id;
    if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required' });
    }
    try {
        // A. Verify caller workspace membership
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } }
        });
        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }
        // B. Verify caller has connected GitHub connection
        const connection = await prisma.gitHubConnection.findUnique({
            where: { userId }
        });
        if (!connection) {
            return res.status(400).json({ error: 'Access denied: Please connect your GitHub account first' });
        }
        // C. Fetch real repositories from GitHub API
        const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100', {
            headers: {
                'Authorization': `Bearer ${connection.accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'CodeMesh-Backend'
            }
        });
        if (!reposResponse.ok) {
            const errorText = await reposResponse.text();
            return res.status(reposResponse.status).json({ error: `GitHub API error: ${errorText}` });
        }
        const githubRepos = await reposResponse.json();
        // D. Perform repository & PR sync logic using transactions
        const syncedData = await prisma.$transaction(async (tx) => {
            const result = [];
            for (const repoInfo of githubRepos) {
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
                // Fetch real Pull Requests for this repository
                const prsResponse = await fetch(`https://api.github.com/repos/${repoInfo.full_name}/pulls?state=all&per_page=100`, {
                    headers: {
                        'Authorization': `Bearer ${connection.accessToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'CodeMesh-Backend'
                    }
                });
                let githubPRs = [];
                if (prsResponse.ok) {
                    githubPRs = await prsResponse.json();
                }
                const prs = [];
                for (const prInfo of githubPRs) {
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
                    prs.push(pr);
                }
                result.push({ ...repo, pullRequests: prs });
            }
            return result;
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. List Synced Repositories for a Workspace (GET /api/v1/github/repositories)
router.get('/repositories', async (req, res) => {
    const { workspaceId } = req.query;
    const userId = req.user.id;
    if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId query param is required' });
    }
    try {
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } }
        });
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

// 5. Check GitHub Connection Status (GET /api/v1/github/status)
router.get('/status', async (req, res) => {
    const userId = req.user.id;
    try {
        const connection = await prisma.gitHubConnection.findUnique({
            where: { userId },
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
