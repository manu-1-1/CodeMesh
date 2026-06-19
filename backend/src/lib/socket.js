import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

export function initSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    // 1. Socket.IO JWT Authentication Middleware
    io.use(async (socket, next) => {
        try {
            // Check auth header, query param, or auth handshake configuration
            const token = socket.handshake.auth?.token ||
                socket.handshake.headers['authorization']?.split(' ')[1] ||
                socket.handshake.query?.token;

            if (!token) {
                return next(new Error('Authentication error: Token required'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            socket.userId = decoded.id;

            // Ensure user exists in the database
            const user = await prisma.user.findUnique({
                where: { id: socket.userId },
            });

            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            next();
        } catch (error) {
            return next(new Error('Authentication error: Invalid or expired token'));
        }
    });

    // 2. Real-Time Events Configuration
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id} (User: ${socket.userId})`);

        // Handle joining a channel
        socket.on('join_channel', async ({ channelId }) => {
            if (!channelId) return;

            try {
                // Verify channel exists
                const channel = await prisma.channel.findUnique({
                    where: { id: channelId },
                });

                if (!channel) {
                    socket.emit('error', { message: 'Channel not found' });
                    return;
                }

                // Verify user membership in workspace
                const member = await prisma.workspaceMember.findUnique({
                    where: {
                        workspaceId_userId: {
                            workspaceId: channel.workspaceId,
                            userId: socket.userId,
                        },
                    },
                });

                if (!member) {
                    socket.emit('error', { message: 'Access denied: You are not a member of this workspace' });
                    return;
                }

                socket.join(`channel:${channelId}`);
                console.log(`👤 User ${socket.userId} joined room: channel:${channelId}`);

                // Broadcast user joined info to other channel members
                socket.to(`channel:${channelId}`).emit('user_joined', { userId: socket.userId });
            } catch (error) {
                console.error("Error in join_channel event:", error);
                socket.emit('error', { message: error.message });
            }
        });

        // Handle leaving a channel
        socket.on('leave_channel', ({ channelId }) => {
            if (!channelId) return;
            socket.leave(`channel:${channelId}`);
            console.log(`👤 User ${socket.userId} left room: channel:${channelId}`);

            socket.to(`channel:${channelId}`).emit('user_left', { userId: socket.userId });
        });

        // Handle sending a message
        socket.on('send_message', async ({ channelId, content }) => {
            if (!channelId || !content || content.trim() === '') {
                socket.emit('error', { message: 'Channel ID and content are required' });
                return;
            }

            const trimmedContent = content.trim();

            try {
                const channel = await prisma.channel.findUnique({
                    where: { id: channelId },
                });

                if (!channel) {
                    socket.emit('error', { message: 'Channel not found' });
                    return;
                }

                // Verify membership
                const member = await prisma.workspaceMember.findUnique({
                    where: {
                        workspaceId_userId: {
                            workspaceId: channel.workspaceId,
                            userId: socket.userId,
                        },
                    },
                });

                if (!member) {
                    socket.emit('error', { message: 'Access denied: You are not a member of this workspace' });
                    return;
                }

                // Create the message in Database
                const message = await prisma.message.create({
                    data: {
                        content: trimmedContent,
                        channelId,
                        senderId: socket.userId,
                    },
                    include: {
                        sender: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatarUrl: true,
                            },
                        },
                    },
                });

                // Broadcast to everyone in the room (including the sender)
                io.to(`channel:${channelId}`).emit('new_message', message);
                console.log(`✉️ Message sent in channel:${channelId} by user:${socket.userId}`);
            } catch (error) {
                console.error("Error in send_message event:", error);
                socket.emit('error', { message: error.message });
            }
        });

        // Handle typing indicators
        socket.on('typing', ({ channelId, isTyping }) => {
            try {
                if (!channelId) return;
                const eventName = isTyping ? 'typing_started' : 'typing_stopped';
                socket.to(`channel:${channelId}`).emit(eventName, { userId: socket.userId });
            } catch (error) {
                console.error("Error in typing event:", error);
            }
        });

        // Handle editing a message
        socket.on('edit_message', async ({ messageId, content }) => {
            if (!messageId || !content || content.trim() === '') {
                socket.emit('error', { message: 'Message ID and content are required' });
                return;
            }
            try {
                const message = await prisma.message.findUnique({
                    where: { id: messageId },
                });
                if (!message) {
                    socket.emit('error', { message: 'Message not found' });
                    return;
                }
                // Only original sender can edit
                if (message.senderId !== socket.userId) {
                    socket.emit('error', { message: 'Access denied: You can only edit your own messages' });
                    return;
                }
                const updatedMessage = await prisma.message.update({
                    where: { id: messageId },
                    data: {
                        content: content.trim(),
                        edited: true,
                    },
                    include: {
                        sender: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatarUrl: true,
                            },
                        },
                    },
                });
                io.to(`channel:${message.channelId}`).emit('message_edited', updatedMessage);
                console.log(`✉️ Message ${messageId} edited by user:${socket.userId}`);
            } catch (error) {
                console.error("Error in edit_message event:", error);
                socket.emit('error', { message: error.message });
            }
        });



        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id} (User: ${socket.userId})`);
        });
    });

    return io;
}
