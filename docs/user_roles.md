# User Roles and Permissions

## Overview

CodeMesh uses Role-Based Access Control (RBAC) to manage permissions within workspaces.

There are four primary roles:

1. System Admin
2. Workspace Owner
3. Workspace Admin
4. Member

---

# System Admin

## Description

The System Admin has the highest level of access across the entire CodeMesh platform.

## Responsibilities

- Manage all users
- Manage all workspaces
- View platform statistics
- Suspend users
- Delete workspaces
- Monitor system health
- Access system-wide logs and metrics

## Permissions

- Full platform access
- Override workspace permissions
- Manage user accounts
- Manage workspace lifecycle

---

# Workspace Owner

## Description

The Workspace Owner is the user who creates a workspace and has complete control over that workspace.

## Responsibilities

- Create and configure workspaces
- Invite members
- Remove members
- Manage workspace settings
- Connect GitHub repositories
- Assign administrative roles

## Permissions

- Create channels
- Delete channels
- Invite members
- Remove members
- Promote members to admin
- Connect repositories
- Manage workspace settings
- Delete workspace
- Transfer ownership

---

# Workspace Admin

## Description

Workspace Admins assist the owner in managing workspace operations.

## Responsibilities

- Manage members
- Moderate channels
- Review pull requests
- Manage workspace activities

## Permissions

- Invite members
- Remove members
- Create channels
- Delete channels
- Manage messages
- Review pull requests
- Manage notifications

## Restrictions

Workspace Admins cannot:

- Delete the workspace
- Transfer ownership
- Modify owner-level settings

---

# Member

## Description

Members are regular users who participate in collaboration activities.

## Responsibilities

- Communicate with team members
- Share code snippets
- Participate in discussions
- Request AI reviews

## Permissions

- Send messages
- Join channels
- Share code snippets
- Create pull requests
- Request AI code reviews
- Comment on reviews

## Restrictions

Members cannot:

- Manage roles
- Delete channels
- Remove members
- Delete workspaces
- Modify workspace settings

---

# Permission Matrix

| Permission | System Admin | Owner | Admin | Member |
|------------|-------------|--------|--------|---------|
| Create Workspace | ✅ | ✅ | ❌ | ❌ |
| Delete Workspace | ✅ | ✅ | ❌ | ❌ |
| Invite Members | ✅ | ✅ | ✅ | ❌ |
| Remove Members | ✅ | ✅ | ✅ | ❌ |
| Create Channels | ✅ | ✅ | ✅ | ❌ |
| Delete Channels | ✅ | ✅ | ✅ | ❌ |
| Send Messages | ✅ | ✅ | ✅ | ✅ |
| Share Code Snippets | ✅ | ✅ | ✅ | ✅ |
| Connect GitHub Repository | ✅ | ✅ | ❌ | ❌ |
| Request AI Review | ✅ | ✅ | ✅ | ✅ |
| Manage Roles | ✅ | ✅ | ❌ | ❌ |
| Review Pull Requests | ✅ | ✅ | ✅ | ❌ |
| Manage Notifications | ✅ | ✅ | ✅ | ❌ |

---

# Workspace-Specific Roles

A user can have different roles in different workspaces.

## Example

```text
User: Manu

Workspace A -> Owner
Workspace B -> Admin
Workspace C -> Member
```

Because roles depend on the workspace:

❌ Do NOT store role in the `users` table.

✅ Store role in the `workspace_members` table.

## Correct Design

```text
users
    │
    └── workspace_members
              │
              ├── user_id
              ├── workspace_id
              └── role
```

This allows the same user to have different permissions in different workspaces.

---

# Future Roles (Optional)

The following roles can be added in future versions:

- AI Reviewer
- Read-Only Guest
- Organization Owner
- Security Auditor
- Repository Maintainer