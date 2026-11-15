# Dev Diary 23: Manual Peer Code Review Integration

**Date:** November 15, 2026  
**Focus:** Introducing human peer code review workflows to complement automated AI reviews within the CodeMesh snippet sharing system.

---

## 1. The Context & Motivation

CodeMesh originally provided code snippet sharing paired with multi-provider AI Code Reviews (Ollama, Gemini, OpenAI, Anthropic, and Mock). While automated AI reviews are effective at catching syntax inconsistencies, security anti-patterns (such as `eval` or exposed keys), and basic style flaws, AI alone lacks understanding of specific domain rules, nuanced architectural constraints, and team-wide context.

To bridge this gap and fulfill the collaborative vision outlined in CodeMesh's architectural specs, we added a complete **Manual Peer Code Review** subsystem. This allows developers to request reviews from specific workspace members, submit feedback, approve snippets, or request changes.

---

## 2. Database Schema Additions

We updated `backend/prisma/schema.prisma` to introduce:
- **`PeerReviewStatus` Enum:** Defines review states (`PENDING`, `APPROVED`, `CHANGES_REQUESTED`).
- **`PeerReview` Model:**
  - `snippetId`: Cascading relation to the target `Snippet`.
  - `reviewerId`: Cascading relation to the assigned `User`.
  - `status`: Current state, default `PENDING`.
  - `comment`: Feedback commentary provided by the reviewer.
  - Timestamps: `createdAt` and `updatedAt`.
- **Bidirectional relations:**
  - Added `peerReviews PeerReview[]` to `Snippet`.
  - Added `peerReviews PeerReview[] @relation("UserPeerReviews")` to `User`.

---

## 3. Backend REST API Implementation

We created `backend/src/routes/peerReviews.js` with authentication and workspace membership authorization:

1. **`POST /api/v1/peer-reviews` (Request Peer Review)**:
   - Validates that caller and target reviewer both belong to the snippet's workspace.
   - Prevents self-review requests (`reviewerId !== req.user.id`).
   - Creates a review in `PENDING` state.
2. **`GET /api/v1/peer-reviews?snippetId=:id` (List Reviews)**:
   - Retrieves all peer reviews for a snippet in descending order of creation, including reviewer profile details (`name`, `email`, `avatarUrl`).
3. **`PATCH /api/v1/peer-reviews/:reviewId` (Submit Review Decision)**:
   - Restricts submission strictly to the assigned reviewer.
   - Accepts status (`APPROVED` or `CHANGES_REQUESTED`) and feedback `comment`.
4. **`DELETE /api/v1/peer-reviews/:reviewId` (Cancel Request)**:
   - Permitted only for the snippet author or workspace `OWNER` / `ADMIN`.
   - Only allowable while the status is still `PENDING`.

We also registered the new router in `backend/src/index.js` under `/api/v1/peer-reviews` and updated `backend/src/routes/snippets.js` so that `GET /api/v1/snippets/:snippetId` eagerly includes `peerReviews` along with AI reviews.

---

## 4. Frontend UI/UX Overhaul

We updated `frontend/src/SnippetsArea.jsx` and `frontend/src/SnippetsArea.css`:

- **Tabbed Review Panel:** The right-hand panel now features a clean toggle between **"AI Review"** and **"Peer Review"**.
- **Reviewer Selection:** Added a member dropdown selector in the Peer Review tab, excluding the current user, enabling one-click peer review requests.
- **Status Badges & Feedback Cards:**
  - 🟡 `Pending Review`
  - 🟢 `Approved`
  - 🔴 `Changes Requested`
- **Interactive Reviewer Action Box:** When the logged-in user is assigned as the reviewer on a pending snippet, an action card appears allowing them to write comments and either click **"Approve"** or **"Request Changes"**.
- **Cancellation Controls:** Authors and workspace administrators can cancel pending review requests directly from the UI.
- **Consistent Design System:** Styled with responsive CSS variables matching CodeMesh's dark theme palette.

---

## 5. Verification & Deployment

- Validated schema definitions with `prisma validate`.
- Applied all backend route handlers and frontend React components cleanly without impacting existing chat or AI review functionality.
- Database migration command prepared for execution against the PostgreSQL instance:
  ```bash
  npx prisma migrate dev --name add_peer_reviews
  ```
