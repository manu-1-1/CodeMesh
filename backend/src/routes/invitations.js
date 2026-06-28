import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Load user email from DB since the JWT token payload only contains the userId
router.use(async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        req.user.email = user.email;
        next();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1. Get all pending invitations for the logged-in user (GET /api/v1/invitations/pending)
router.get('/pending', async (req, res) => {
    const userEmail = req.user.email;
    try {
        const pendingInvitations = await prisma.invitation.findMany({
            where: {
                email: userEmail,
                status: 'PENDING'
            },
            include: {
                workspace: {
                    select: {
                        name: true,
                        description: true
                    }
                },
                invitedBy: {
                    select: {
                        name: true
                    }
                }
            }
        });
        res.json(pendingInvitations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Accept an invitation (POST /api/v1/invitations/:invitationId/accept)
router.post('/:invitationId/accept', async (req, res) => {
    const { invitationId } = req.params;
    const userId = req.user.id;
    const userEmail = req.user.email;

    try {
        const invitation = await prisma.invitation.findUnique({
            where: { id: invitationId }
        });

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        if (invitation.email !== userEmail) {
            return res.status(403).json({ error: 'Access denied: This invitation is not for you' });
        }

        if (invitation.status !== 'PENDING') {
            return res.status(400).json({ error: 'Invitation has already been processed' });
        }

        // Run as transaction: create workspace member, delete/update invitation
        const result = await prisma.$transaction(async (tx) => {
            const membership = await tx.workspaceMember.create({
                data: {
                    workspaceId: invitation.workspaceId,
                    userId,
                    role: invitation.role
                }
            });

            await tx.invitation.delete({
                where: { id: invitationId }
            });

            return membership;
        });

        res.json({ message: 'Invitation accepted successfully', membership: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Decline an invitation (POST /api/v1/invitations/:invitationId/decline)
router.post('/:invitationId/decline', async (req, res) => {
    const { invitationId } = req.params;
    const userEmail = req.user.email;

    try {
        const invitation = await prisma.invitation.findUnique({
            where: { id: invitationId }
        });

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        if (invitation.email !== userEmail) {
            return res.status(403).json({ error: 'Access denied: This invitation is not for you' });
        }

        await prisma.invitation.delete({
            where: { id: invitationId }
        });

        res.json({ message: 'Invitation declined successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
