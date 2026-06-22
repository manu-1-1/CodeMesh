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


export default router;
