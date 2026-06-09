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

// Update workspace details
router.put('/:workspaceId', async (req, res) => {
    const { workspaceId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    try {
        // Find workspace to verify ownership
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        // Verify that the user is the owner
        if (workspace.ownerId !== userId) {
            return res.status(403).json({ error: 'Access denied: Only the workspace owner can update it' });
        }

        const updatedWorkspace = await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
                name: name !== undefined ? name : workspace.name,
                description: description !== undefined ? description : workspace.description,
            },
        });

        res.json({
            message: 'Workspace updated successfully',
            workspace: updatedWorkspace,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete workspace
router.delete('/:workspaceId', async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    try {
        // Find workspace to verify ownership
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        // Verify that the user is the owner
        if (workspace.ownerId !== userId) {
            return res.status(403).json({ error: 'Access denied: Only the workspace owner can delete it' });
        }

        await prisma.workspace.delete({
            where: { id: workspaceId },
        });

        res.json({ message: 'Workspace deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// List all members of a workspace
router.get('/:workspaceId/members', async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    try {
        // Verify current user is a member of this workspace
        const callerMember = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        if (!callerMember) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }

        // Get all members
        const members = await prisma.workspaceMember.findMany({
            where: { workspaceId },
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
        });

        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Add/Invite a member to the workspace
router.post('/:workspaceId/members', async (req, res) => {
    const { workspaceId } = req.params;
    const { email, role } = req.body;
    const userId = req.user.id;

    if (!email) {
        return res.status(400).json({ error: 'User email is required' });
    }

    // Validate role if provided
    const validRoles = ['ADMIN', 'MEMBER'];
    const memberRole = role ? role.toUpperCase() : 'MEMBER';
    if (role && !validRoles.includes(memberRole)) {
        return res.status(400).json({ error: 'Invalid role. Role must be ADMIN or MEMBER' });
    }

    try {
        // 1. Verify caller is OWNER or ADMIN
        const callerMember = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        if (!callerMember || (callerMember.role !== 'OWNER' && callerMember.role !== 'ADMIN')) {
            return res.status(403).json({ error: 'Access denied: Only owners and admins can invite members' });
        }

        // 2. Find the user to add by email
        const userToAdd = await prisma.user.findUnique({
            where: { email },
        });

        if (!userToAdd) {
            return res.status(404).json({ error: 'User with this email not found' });
        }

        // 3. Check if user is already a member
        const existingMember = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: userToAdd.id,
                },
            },
        });

        if (existingMember) {
            return res.status(400).json({ error: 'User is already a member of this workspace' });
        }

        // 4. Add the user
        const newMember = await prisma.workspaceMember.create({
            data: {
                workspaceId,
                userId: userToAdd.id,
                role: memberRole,
            },
            select: {
                role: true,
                joinedAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        res.status(201).json({
            message: 'Member added successfully',
            member: newMember,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
