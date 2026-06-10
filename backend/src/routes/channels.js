import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(authenticateToken);

// 1. Create a new channel (Owner & Admin only)
router.post('/', async (req, res) => {
    const { workspaceId, name, type } = req.body;
    const userId = req.user.id;

    if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Channel name is required and cannot be empty' });
    }

    const trimmedName = name.trim();

    // Validate type if provided
    const validTypes = ['GENERAL', 'CHAT', 'CODE_REVIEW'];
    const channelType = type ? type.toUpperCase() : 'CHAT';
    if (type && !validTypes.includes(channelType)) {
        return res.status(400).json({ error: 'Invalid channel type. Type must be GENERAL, CHAT, or CODE_REVIEW' });
    }

    try {
        // Verify user membership and check if user is OWNER or ADMIN
        const member = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            return res.status(403).json({ error: 'Access denied: Only workspace owners and admins can create channels' });
        }

        // Check if a channel with the same name already exists in this workspace (case-insensitive)
        const existingChannel = await prisma.channel.findFirst({
            where: {
                workspaceId,
                name: {
                    equals: trimmedName,
                    mode: 'insensitive',
                },
            },
        });

        if (existingChannel) {
            return res.status(400).json({ error: `A channel with the name "${trimmedName}" already exists in this workspace` });
        }

        // Create the channel
        const channel = await prisma.channel.create({
            data: {
                workspaceId,
                name: trimmedName,
                type: channelType,
            },
        });

        res.status(201).json({
            message: 'Channel created successfully',
            channel,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. List all channels in a workspace (Any workspace member)
router.get('/', async (req, res) => {
    const { workspaceId } = req.query;
    const userId = req.user.id;

    if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required as a query parameter' });
    }

    try {
        // Verify current user is a member of this workspace
        const member = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }

        // Get channels
        const channels = await prisma.channel.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'asc' },
        });

        res.json(channels);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Delete a channel (Owner & Admin only, cannot delete GENERAL channel)
router.delete('/:channelId', async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user.id;

    try {
        // Find the channel to verify existence and get workspaceId
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
        });

        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        // Verify caller's role in the channel's workspace
        const member = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId: channel.workspaceId,
                    userId,
                },
            },
        });

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            return res.status(403).json({ error: 'Access denied: Only workspace owners and admins can delete channels' });
        }

        // Prevent deleting GENERAL channel
        if (channel.type === 'GENERAL') {
            return res.status(400).json({ error: 'Access denied: Cannot delete the default general channel' });
        }

        // Delete the channel
        await prisma.channel.delete({
            where: { id: channelId },
        });

        res.json({ message: 'Channel deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;