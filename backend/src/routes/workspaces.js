import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes in this router
router.use(authenticateToken);

export default router;

// Create a new workspace
router.post('/', async (req, res) => {
    const { name, description } = req.body;
    const userId = req.user.id; // Extracted by authenticateToken middleware

    if (!name) {
        return res.status(400).json({ error: 'Workspace name is required' });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create workspace
            const workspace = await tx.workspace.create({
                data: {
                    name,
                    description,
                    ownerId: userId,
                },
            });

            // 2. Add owner to workspace memberships
            const membership = await tx.workspaceMember.create({
                data: {
                    workspaceId: workspace.id,
                    userId: userId,
                    role: 'OWNER',
                },
            });

            return { workspace, membership };
        });

        res.status(201).json({
            message: 'Workspace created successfully',
            workspace: result.workspace,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
