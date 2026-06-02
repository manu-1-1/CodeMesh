# CodeMesh API Design

Base URL:

```http
/api/v1
```

---

# Authentication APIs

## Register User

```http
POST /auth/register
```

## Login User

```http
POST /auth/login
```

## Logout User

```http
POST /auth/logout
```

## Get Current User

```http
GET /auth/me
```

---

# User APIs

## Update Profile

```http
PUT /users/profile
```

## Change Password

```http
PUT /users/password
```

---

# Workspace APIs

## Create Workspace

```http
POST /workspaces
```

## Get All Workspaces

```http
GET /workspaces
```

## Get Workspace Details

```http
GET /workspaces/{workspaceId}
```

## Update Workspace

```http
PUT /workspaces/{workspaceId}
```

## Delete Workspace

```http
DELETE /workspaces/{workspaceId}
```

---

# Member APIs

## Invite Member

```http
POST /workspaces/{workspaceId}/members
```

## List Members

```http
GET /workspaces/{workspaceId}/members
```

## Remove Member

```http
DELETE /workspaces/{workspaceId}/members/{memberId}
```

---

# Channel APIs

## Create Channel

```http
POST /channels
```

## List Channels

```http
GET /channels
```

## Delete Channel

```http
DELETE /channels/{channelId}
```

---

# Message APIs

## Get Channel Messages

```http
GET /channels/{channelId}/messages
```

---

# Snippet APIs

## Create Snippet

```http
POST /snippets
```

## Get Snippet

```http
GET /snippets/{snippetId}
```

## Update Snippet

```http
PUT /snippets/{snippetId}
```

## Delete Snippet

```http
DELETE /snippets/{snippetId}
```

---

# AI Review APIs

## Request Review

```http
POST /reviews
```

## Get Review

```http
GET /reviews/{reviewId}
```

---

# GitHub APIs

## Connect GitHub

```http
POST /github/connect
```

## Disconnect GitHub

```http
DELETE /github/disconnect
```

## Sync Repositories

```http
POST /github/sync
```
