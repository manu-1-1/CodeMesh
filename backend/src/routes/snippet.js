import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();
// Apply auth middleware to all routes in this router
router.use(authenticateToken);

// 1. Create a Snippet
router.post('/', async (req, res) => {
    const { workspaceId, title, language, code } = req.body;
    const authorId = req.user.id;
    if (!workspaceId || !title || !language || !code) {
        return res.status(400).json({ error: 'workspaceId, title, language, and code are required' });
    }
    try {
        // Verify user is member of the workspace
        const member = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: { workspaceId, userId: authorId }
            }
        });
        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }
        const snippet = await prisma.snippet.create({
            data: {
                workspaceId,
                authorId,
                title,
                language,
                code
            },
            include: {
                author: {
                    select: { id: true, name: true, email: true, avatarUrl: true }
                }
            }
        });
        res.status(201).json(snippet);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Get a Snippet
router.get('/:snippetId', async (req, res) => {
    const { snippetId } = req.params;
    const userId = req.user.id;
    try {
        const snippet = await prisma.snippet.findUnique({
            where: { id: snippetId },
            include: {
                author: {
                    select: { id: true, name: true, email: true, avatarUrl: true }
                }
            }
        });
        if (!snippet) {
            return res.status(404).json({ error: 'Snippet not found' });
        }
        // Verify user is a member of the workspace the snippet belongs to
        const member = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: { workspaceId: snippet.workspaceId, userId }
            }
        });
        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }
        res.json(snippet);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
