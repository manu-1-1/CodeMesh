import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { hashPassword, comparePassword } from '../utils/auth.js';
const router = express.Router();
router.use(authenticateToken);

// 1. Update Profile (name, avatarUrl, and AI configuration settings)
router.put('/profile', async (req, res) => {
    const { name, avatarUrl, aiProvider, aiApiKey, aiModel, aiApiUrl } = req.body;
    const userId = req.user.id;
    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name: name !== undefined ? name : undefined,
                avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
                aiProvider: aiProvider !== undefined ? aiProvider : undefined,
                // If the key is the masked placeholder "••••••••••••••••", don't change it in the database
                aiApiKey: (aiApiKey !== undefined && aiApiKey !== "••••••••••••••••") ? aiApiKey : undefined,
                aiModel: aiModel !== undefined ? aiModel : undefined,
                aiApiUrl: aiApiUrl !== undefined ? aiApiUrl : undefined,
            },
            select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                createdAt: true,
                aiProvider: true,
                aiModel: true,
                aiApiUrl: true
            },
        });
        res.json({
            message: 'Profile updated successfully',
            user: updatedUser,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Change Password
router.put('/password', async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Both oldPassword and newPassword are required' });
    }
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const isMatch = await comparePassword(oldPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect old password' });
        }
        const newHashed = await hashPassword(newPassword);
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newHashed },
        });
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Get User's AI Configuration Settings (Only fetched when opening Settings panel)
router.get('/ai-settings', async (req, res) => {
    const userId = req.user.id;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                aiProvider: true,
                aiModel: true,
                aiApiUrl: true,
                aiApiKey: true
            }
        });

        if (user) {
            // Mask the API key so the raw secret is never sent to the browser
            if (user.aiApiKey) {
                user.aiApiKey = "••••••••••••••••";
            }
            res.json(user);
        } else {
            res.json({ aiProvider: 'mock', aiModel: '', aiApiUrl: '', aiApiKey: '' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;