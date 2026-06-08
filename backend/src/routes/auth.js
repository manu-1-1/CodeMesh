import express from 'express';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

// 1. Register User
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    try {
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email is already in use' });
        }

        // Hash password & Save
        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash: hashedPassword,
            },
        });

        // Generate token
        const token = generateToken(user.id);

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: user.id, name: user.name, email: user.email },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Login User
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isMatch = await comparePassword(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken(user.id);

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Get Current User Profile (Secured)
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
