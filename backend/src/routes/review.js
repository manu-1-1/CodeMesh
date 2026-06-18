import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { performAIReview } from '../utils/aiReviewer.js';
const router = express.Router();
// Protect all review routes
router.use(authenticateToken);

// 1. Request a new AI Code Review
router.post('/', async (req, res) => {
    const { snippetId } = req.body;
    const userId = req.user.id;
    if (!snippetId) {
        return res.status(400).json({ error: 'snippetId is required' });
    }
    try {
        // Fetch snippet to ensure it exists and get workspace ID
        const snippet = await prisma.snippet.findUnique({
            where: { id: snippetId }
        });
        if (!snippet) {
            return res.status(404).json({ error: 'Snippet not found' });
        }
        // Verify that the caller belongs to the snippet's workspace
        const member = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId: snippet.workspaceId,
                    userId
                }
            }
        });
        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }
        // Run the code analyzer
        const reviewResult = performAIReview(snippet.title, snippet.language, snippet.code);
        // Store the result in database
        const codeReview = await prisma.codeReview.create({
            data: {
                snippetId: snippet.id,
                summary: reviewResult.summary,
                reviewerType: reviewResult.reviewerType
            }
        });
        res.status(201).json(codeReview);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

