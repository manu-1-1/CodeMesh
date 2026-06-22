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
        // C. Perform mock repository & PR sync logic using transactions
        const mockRepos = [
            { name: 'api-service', fullName: `${connection.githubUsername}/api-service`, githubId: 10101 },
            { name: 'frontend-app', fullName: `${connection.githubUsername}/frontend-app`, githubId: 10102 }
        ];
        const syncedData = await prisma.$transaction(async (tx) => {
            const result = [];
            for (const repoInfo of mockRepos) {
                // Upsert repository
                const repo = await tx.repository.upsert({
                    where: {
                        workspaceId_fullName: { workspaceId, fullName: repoInfo.fullName }
                    },
                    update: { name: repoInfo.name, githubId: repoInfo.githubId },
                    create: {
                        workspaceId,
                        name: repoInfo.name,
                        fullName: repoInfo.fullName,
                        githubId: repoInfo.githubId
                    }
                });
                // Sync mock PRs
                const mockPRs = [
                    { number: 1, title: 'Fix auth token expiry logic', state: 'OPEN', htmlUrl: `https://github.com/${repo.fullName}/pull/1` },
                    { number: 2, title: 'Add Redis caching support', state: 'CLOSED', htmlUrl: `https://github.com/${repo.fullName}/pull/2` }
                ];
                const prs = [];
                for (const prInfo of mockPRs) {
                    const pr = await tx.pullRequest.upsert({
                        where: {
                            repositoryId_number: { repositoryId: repo.id, number: prInfo.number }
                        },
                        update: { title: prInfo.title, state: prInfo.state, htmlUrl: prInfo.htmlUrl },
                        create: {
                            repositoryId: repo.id,
                            number: prInfo.number,
                            title: prInfo.title,
                            state: prInfo.state,
                            htmlUrl: prInfo.htmlUrl
                        }
                    });
                    prs.push(pr);
                }
                result.push({ ...repo, pullRequests: prs });
            }
            return result;
        });
        res.json({
            message: 'Repositories and Pull Requests synchronized successfully',
            repositories: syncedData
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



export default router;
