import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import { prisma } from './lib/prisma.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Auth routes registration
app.use('/api/v1/auth', authRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'UP', database: 'CONNECTED' });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
