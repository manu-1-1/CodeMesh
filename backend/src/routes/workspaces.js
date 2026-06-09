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


// Get all workspaces the current user belongs to
router.get('/', async (req, res) => {
    const userId = req.user.id;

    try {
        const workspaces = await prisma.workspace.findMany({
            where: {
                members: {
                    some: {
                        userId: userId,
                    },
                },
            },
            include: {
                members: {
                    select: {
                        role: true,
                        joinedAt: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
        });

        res.json(workspaces);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific workspace details by ID
router.get('/:workspaceId', async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    try {
        // 1. Verify user membership in this workspace
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

        // 2. Retrieve workspace details
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: {
                members: {
                    select: {
                        role: true,
                        joinedAt: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
        });

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        res.json(workspace);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
