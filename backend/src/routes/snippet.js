import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();
// Apply auth middleware to all routes in this router
router.use(authenticateToken);

