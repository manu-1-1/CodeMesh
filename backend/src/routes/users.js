import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { hashPassword, comparePassword } from '../utils/auth.js';
const router = express.Router();
router.use(authenticateToken);

// 1. Update Profile (name and/or avatarUrl)
router.put('/profile', async (req, res) => {
    const { name, avatarUrl } = req.body;
    const userId = req.user.id;
    if (name === undefined && avatarUrl === undefined) {
        return res.status(400).json({ error: 'At least one field (name or avatarUrl) is required to update' });
    }
    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name: name !== undefined ? name : undefined,
                avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
            },
            select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
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