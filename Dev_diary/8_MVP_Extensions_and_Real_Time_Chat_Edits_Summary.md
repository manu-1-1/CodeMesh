# CodeMesh MVP Extensions & Message Editing/Deletion Summary (Phase 8)

This document describes my design, code changes, and verification of the **MVP Extensions & Chat Features** implemented today. These features finalize the initial real-time communication scope of CodeMesh.

---

## 1. What Was Accomplished Today

I completed the implementation of remaining functional requirements from the Version 1 MVP:
1. **User Settings & Authentication Extensions**: Created the `/api/v1/users` endpoint router allowing profile updates (name and avatar URL) and secure password updates.
2. **Workspace & Administration Extensions**: Implemented the Leave Workspace action and the Promote/Demote Member Role action.
3. **Message Edit/Delete Capabilities**: Expanded the WebSocket real-time chat service to handle message edits (marking them as `edited: true` in the database) and deletions (physically removing them), with live broadcasts to channel rooms.
4. **Verification**: Checked all new features via the automated test script [test_user.js](file:///d:/Projects/CodeMesh/backend/test_user.js) and archived its execution logs inside [test_user.log](file:///d:/Projects/CodeMesh/logs/test_user.log).

---

## 2. Why I Implemented This & Practical Rationale

### Account Integrity & Settings
Providing `PUT /profile` and `PUT /password` gives users control over their profile data and security. Password updates run through `bcrypt` validation to prevent arbitrary overwrites, checking the `oldPassword` hash before hashing and storing the `newPassword`.

### Role Administration & Association Control
Administrators and owners need direct authority to promote regular members to `ADMIN` or demote them. Similarly, non-owners must be allowed to leave workspaces they no longer collaborate in. These are core controls of the membership database system.

### Dynamic Chat State Management (Edits & Deletion)
In a collaborative environment, users expect to fix typos or delete accidental posts:
* **Integrity Check**: Only the original sender of a message can edit it.
* **Administrative Moderation**: The original sender *or* any workspace `OWNER` / `ADMIN` can delete a message to moderate discussion.
* **State Sync**: Updates and deletions are committed to the PostgreSQL table using Prisma, and instantly distributed to all active listeners in the room using Socket.io broadcasts (`message_edited` and `message_deleted` events).

---

## 3. Database Schema Modifications

The `Message` model in [schema.prisma](file:///d:/Projects/CodeMesh/backend/prisma/schema.prisma) was updated to add the `edited` flag:

```prisma
model Message {
  id        String   @id @default(uuid())
  content   String
  channelId String   @map("channel_id")
  senderId  String   @map("sender_id")
  edited    Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  channel   Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  sender    User     @relation(fields: [senderId], references: [id], onDelete: Cascade)

  @@map("messages")
}
```

---

## 4. Code Breakdown and Explanations

### 4.1 Profile Router ([users.js](file:///d:/Projects/CodeMesh/backend/src/routes/users.js))
Handles profile metadata and secure credential rotation. Protected by the `authenticateToken` middleware:

```javascript
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { hashPassword, comparePassword } from '../utils/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Update profile name and/or avatarUrl
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

// Update password with old credential verification
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

export default router;
```

### 4.2 Workspace leave and role promotion ([workspaces.js](file:///d:/Projects/CodeMesh/backend/src/routes/workspaces.js))
Allows members to depart and owners to administer access roles:

```javascript
// Leave workspace (Owners are blocked from leaving directly)
router.post('/:workspaceId/leave', async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    try {
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } },
        });

        if (!member) {
            return res.status(400).json({ error: 'You are not a member of this workspace' });
        }

        if (member.role === 'OWNER') {
            return res.status(400).json({ error: 'The workspace owner cannot leave. You must transfer ownership or delete the workspace' });
        }

        await prisma.workspaceMember.delete({
            where: { workspaceId_userId: { workspaceId, userId } },
        });

        res.json({ message: 'Successfully left the workspace' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update member role (Requires OWNER access)
router.put('/:workspaceId/members/:userId', async (req, res) => {
    const { workspaceId, userId: targetUserId } = req.params;
    const { role } = req.body;
    const callerId = req.user.id;

    if (!role) {
        return res.status(400).json({ error: 'Role is required' });
    }

    const validRoles = ['ADMIN', 'MEMBER'];
    const targetRole = role.toUpperCase();
    if (!validRoles.includes(targetRole)) {
        return res.status(400).json({ error: 'Invalid role. Must be ADMIN or MEMBER' });
    }

    try {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        if (workspace.ownerId !== callerId) {
            return res.status(403).json({ error: 'Access denied: Only the workspace owner can change member roles' });
        }

        const targetMember = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
        });

        if (!targetMember) {
            return res.status(404).json({ error: 'Member not found in this workspace' });
        }

        if (targetMember.role === 'OWNER') {
            return res.status(400).json({ error: 'Cannot modify the role of the workspace owner' });
        }

        const updatedMember = await prisma.workspaceMember.update({
            where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
            data: { role: targetRole },
            select: {
                role: true,
                joinedAt: true,
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        res.json({
            message: 'Member role updated successfully',
            member: updatedMember,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### 4.3 WebSocket Message Edits & Deletion ([socket.js](file:///d:/Projects/CodeMesh/backend/src/lib/socket.js))
Event handlers mapping real-time mutations with database storage:

```javascript
        // Handle editing a message (Author-only restriction)
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
                            select: { id: true, name: true, email: true, avatarUrl: true },
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

        // Handle deleting a message (Author, Owner, or Admin permission)
        socket.on('delete_message', async ({ messageId }) => {
            if (!messageId) {
                socket.emit('error', { message: 'Message ID is required' });
                return;
            }

            try {
                const message = await prisma.message.findUnique({
                    where: { id: messageId },
                    include: { channel: true },
                });

                if (!message) {
                    socket.emit('error', { message: 'Message not found' });
                    return;
                }

                const isAuthor = message.senderId === socket.userId;
                const member = await prisma.workspaceMember.findUnique({
                    where: {
                        workspaceId_userId: {
                            workspaceId: message.channel.workspaceId,
                            userId: socket.userId,
                        },
                    },
                });

                const isAuthorized = isAuthor || (member && (member.role === 'OWNER' || member.role === 'ADMIN'));

                if (!isAuthorized) {
                    socket.emit('error', { message: 'Access denied: You do not have permission to delete this message' });
                    return;
                }

                await prisma.message.delete({
                    where: { id: messageId },
                });

                io.to(`channel:${message.channelId}`).emit('message_deleted', {
                    messageId,
                    channelId: message.channelId,
                });
                console.log(`✉️ Message ${messageId} deleted by user:${socket.userId}`);
            } catch (error) {
                console.error("Error in delete_message event:", error);
                socket.emit('error', { message: error.message });
            }
        });
```

---

## 5. Verification Log Reference

All endpoints and Socket event flows were verified via [test_user.log](file:///d:/Projects/CodeMesh/logs/test_user.log):
```text
=== Testing MVP Extensions & Message Editing/Deletion ===

1. Registering users...
✅ Users registered.

2. Testing profile update...
Status: 200 {
  message: 'Profile updated successfully',
  user: {
    id: '4a701fa8-1875-4652-a34d-835729026f9c',
    name: 'Updated Ext Owner',
    email: 'owner_1781897741735@example.com',
    avatarUrl: 'https://avatar.com/owner',
    createdAt: '2026-06-19T19:35:41.837Z'
  }
}
✅ Profile updated successfully.

3. Testing password update...
Status: 200 { message: 'Password updated successfully' }
✅ Password updated & verified successfully.

4. Creating workspace...
Inviting member...
Promoting member to ADMIN...
Status: 200 {
  message: 'Member role updated successfully',
  member: {
    role: 'ADMIN',
    joinedAt: '2026-06-19T19:35:42.073Z',
    user: {
      id: 'b065ae6d-6ace-4b9c-a6b6-7d7e4ce40970',
      name: 'Ext Member',
      email: 'member_1781897741735@example.com'
    }
  }
}
✅ Member promoted to ADMIN successfully.
Testing leave workspace...
Status: 200 { message: 'Successfully left the workspace' }
✅ Member successfully left workspace.

5. Testing message edit & delete via Sockets...
✅ Received message_edited event in real-time. Content: Edited message content
✅ Received message_deleted event in real-time for message ID: 70cf0efe-c477-489a-b8a7-2e31ad714712

6. Cleaning up test workspace...

✅ ALL EXTENSION TESTS PASSED SUCCESSFULLY!
```
