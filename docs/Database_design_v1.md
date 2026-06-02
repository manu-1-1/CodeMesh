# CodeMesh Database Design

## Overview

The database is designed using PostgreSQL and follows a relational model.

---

# users

Stores user account information.

| Column | Type | Constraints |
|----------|----------|----------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| avatar_url | VARCHAR(500) | NULL |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

---

# workspaces

Stores workspace information.

| Column | Type | Constraints |
|----------|----------|----------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| description | TEXT | NULL |
| owner_id | UUID | FK |
| created_at | TIMESTAMP | NOT NULL |

Foreign Keys:

- owner_id → users.id

---

# workspace_members

Stores workspace membership.

| Column | Type | Constraints |
|----------|----------|----------|
| workspace_id | UUID | FK |
| user_id | UUID | FK |
| role | ENUM | NOT NULL |
| joined_at | TIMESTAMP | NOT NULL |

Roles:

- OWNER
- ADMIN
- MEMBER

Foreign Keys:

- workspace_id → workspaces.id
- user_id → users.id

---

# channels

Stores workspace channels.

| Column | Type | Constraints |
|----------|----------|----------|
| id | UUID | PK |
| workspace_id | UUID | FK |
| name | VARCHAR(100) | NOT NULL |
| type | ENUM | NOT NULL |
| created_at | TIMESTAMP | NOT NULL |

Channel Types:

- GENERAL
- CHAT
- CODE_REVIEW

Foreign Keys:

- workspace_id → workspaces.id

---

# messages

Stores chat messages.

| Column | Type | Constraints |
|----------|----------|----------|
| id | UUID | PK |
| channel_id | UUID | FK |
| sender_id | UUID | FK |
| content | TEXT | NOT NULL |
| edited | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMP | NOT NULL |

Foreign Keys:

- channel_id → channels.id
- sender_id → users.id

---

# snippets

Stores code snippets.

| Column | Type | Constraints |
|----------|----------|----------|
| id | UUID | PK |
| workspace_id | UUID | FK |
| author_id | UUID | FK |
| title | VARCHAR(255) | NOT NULL |
| language | VARCHAR(50) | NOT NULL |
| code | TEXT | NOT NULL |
| created_at | TIMESTAMP | NOT NULL |

Foreign Keys:

- workspace_id → workspaces.id
- author_id → users.id

---

# code_reviews

Stores AI-generated code reviews.

| Column | Type | Constraints |
|----------|----------|----------|
| id | UUID | PK |
| snippet_id | UUID | FK |
| summary | TEXT | NOT NULL |
| reviewer_type | VARCHAR(50) | NOT NULL |
| created_at | TIMESTAMP | NOT NULL |

Foreign Keys:

- snippet_id → snippets.id

---

# github_integrations

Stores GitHub account connections.

| Column | Type | Constraints |
|----------|----------|----------|
| id | UUID | PK |
| user_id | UUID | FK |
| github_user_id | VARCHAR(255) | NOT NULL |
| access_token | TEXT | NOT NULL |
| connected_at | TIMESTAMP | NOT NULL |

Foreign Keys:

- user_id → users.id

---

# Relationships

User (1) -------- (M) Workspace

User (M) -------- (M) Workspace
via workspace_members

Workspace (1) -------- (M) Channel

Channel (1) -------- (M) Message

Workspace (1) -------- (M) Snippet

Snippet (1) -------- (M) Code Review
