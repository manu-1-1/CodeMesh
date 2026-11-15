import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// POST /peer-reviews — Request a peer review
router.post('/', async (req, res) => {
  const { snippetId, reviewerId } = req.body;
  const requesterId = req.user.id;

  if (!snippetId || !reviewerId) {
    return res.status(400).json({ error: 'snippetId and reviewerId are required' });
  }

  if (reviewerId === requesterId) {
    return res.status(400).json({ error: 'You cannot request a review from yourself' });
  }

  try {
    // Fetch snippet to get workspaceId
    const snippet = await prisma.snippet.findUnique({ where: { id: snippetId } });
    if (!snippet) {
      return res.status(404).json({ error: 'Snippet not found' });
    }

    const { workspaceId } = snippet;

    // Caller must be a workspace member
    const callerMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: requesterId } }
    });
    if (!callerMember) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
    }

    // Reviewer must also be a workspace member
    const reviewerMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: reviewerId } }
    });
    if (!reviewerMember) {
      return res.status(400).json({ error: 'Reviewer is not a member of this workspace' });
    }

    const peerReview = await prisma.peerReview.create({
      data: { snippetId, reviewerId },
      include: {
        reviewer: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(201).json(peerReview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /peer-reviews?snippetId=:id — Get all peer reviews for a snippet
router.get('/', async (req, res) => {
  const { snippetId } = req.query;
  const userId = req.user.id;

  if (!snippetId) {
    return res.status(400).json({ error: 'snippetId query parameter is required' });
  }

  try {
    const snippet = await prisma.snippet.findUnique({ where: { id: snippetId } });
    if (!snippet) {
      return res.status(404).json({ error: 'Snippet not found' });
    }

    // Caller must be a workspace member
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: snippet.workspaceId, userId } }
    });
    if (!member) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
    }

    const peerReviews = await prisma.peerReview.findMany({
      where: { snippetId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });

    res.json(peerReviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /peer-reviews/:reviewId — Submit/update review (assigned reviewer only)
router.patch('/:reviewId', async (req, res) => {
  const { reviewId } = req.params;
  const { status, comment } = req.body;
  const userId = req.user.id;

  const validStatuses = ['APPROVED', 'CHANGES_REQUESTED'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'status must be APPROVED or CHANGES_REQUESTED' });
  }

  try {
    const peerReview = await prisma.peerReview.findUnique({ where: { id: reviewId } });
    if (!peerReview) {
      return res.status(404).json({ error: 'Peer review not found' });
    }

    // Only the assigned reviewer can submit
    if (peerReview.reviewerId !== userId) {
      return res.status(403).json({ error: 'Access denied: Only the assigned reviewer can submit this review' });
    }

    const updated = await prisma.peerReview.update({
      where: { id: reviewId },
      data: { status, comment: comment ?? peerReview.comment },
      include: {
        reviewer: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /peer-reviews/:reviewId — Cancel a pending review request
router.delete('/:reviewId', async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user.id;

  try {
    const peerReview = await prisma.peerReview.findUnique({
      where: { id: reviewId },
      include: { snippet: true }
    });

    if (!peerReview) {
      return res.status(404).json({ error: 'Peer review not found' });
    }

    if (peerReview.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only PENDING reviews can be cancelled' });
    }

    const { workspaceId, authorId } = peerReview.snippet;

    // Must be snippet author or workspace OWNER/ADMIN
    const isAuthor = authorId === userId;
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });
    const isAdminOrOwner = member && (member.role === 'OWNER' || member.role === 'ADMIN');

    if (!isAuthor && !isAdminOrOwner) {
      return res.status(403).json({ error: 'Access denied: Only the snippet author or workspace OWNER/ADMIN can cancel this review' });
    }

    await prisma.peerReview.delete({ where: { id: reviewId } });

    res.json({ message: 'Peer review cancelled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
