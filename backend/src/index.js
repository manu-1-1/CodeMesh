import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import { prisma } from './lib/prisma.js';
import workspaceRoutes from './routes/workspaces.js';
import channelRoutes from './routes/channels.js';
import messageRoutes from './routes/messages.js';
import http from 'http';
import { initSocket } from './lib/socket.js'
import snippetRoutes from './routes/snippets.js';
import reviewRoutes from './routes/reviews.js';
import userRoutes from './routes/users.js';


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Auth routes registration
app.use('/api/v1/auth', authRoutes);
// Workspace routes registration
app.use('/api/v1/workspaces', workspaceRoutes);
// Channel routes registration
app.use('/api/v1/channels', channelRoutes);
// Message routes registration
app.use('/api/v1/channels', messageRoutes);
// Snippet routes registration
app.use('/api/v1/snippets', snippetRoutes);
// Reviews route registration
app.use('/api/v1/reviews', reviewRoutes);
// Users route registration
app.use('/api/v1/users', userRoutes)


// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'UP', database: 'CONNECTED' });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', error: error.message });
  }
});

const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
