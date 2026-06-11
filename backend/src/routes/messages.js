import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(authenticateToken);

/**
 * GET /api/v1/channels/:channelId/messages
 * Retrieves message history for a specific channel. Only workspace members of the channel's workspace are allowed access.
 */
router.get('/:channelId/messages', async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user.id;
    try {
        // 1. Fetch channel to find the workspace it belongs to
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
        });
        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }
        // 2. Verify that the user is a member of the workspace the channel belongs to
        const member = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId: channel.workspaceId,
                    userId,
                },
            },
        });
        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }
        // 3. Retrieve all messages for the channel, sorted chronologically
        const messages = await prisma.message.findMany({
            where: { channelId },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true,
                    },
                },
            },
        });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
export default router;