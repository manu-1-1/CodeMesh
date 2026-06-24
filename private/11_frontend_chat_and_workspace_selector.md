# Frontend Implementation: Workspace Selection & Real-Time Chat Screens

This document outlines the screens added to the CodeMesh frontend today, the reasoning behind the architectural choices, and a detailed explanation of the code changes.

---

## 1. Summary of Changes Today

We moved the frontend from a simple mock authentication page to a fully functioning multi-screen application. The workflow now consists of:
1. **Authentication Screen (`Auth.jsx`)**: Login or register users. We fixed a API payload mismatch where the backend expected `name` but the frontend sent `username`.
2. **Workspace Selector Screen (`WorkspaceSelector.jsx` & `.css`)**: Allows logged-in users to view their joined workspaces and create new ones.
3. **Workspace Chat Screen (`ChatArea.jsx` & `.css`)**: Renders a workspace dashboard containing a list of channels, a list of workspace members, and a real-time message thread powered by Socket.IO.

---

## 2. Why We Implemented These Changes (Design Decisions)

### Modular Styling (Separate CSS Files)
Instead of adding all layout styles into `index.css`, we created individual stylesheets for components:
* `WorkspaceSelector.css` for the workspace dashboard.
* `ChatArea.css` for the sidebar, messaging panel, and modals.

This structure prevents stylesheet bloat, avoids class name collisions, and keeps styles near the Javascript files that use them.

### JWT Authentication via WebSockets
To secure the real-time websocket connection, we passed the JWT from localStorage inside the handshake authentication object when connecting Socket.IO:
```javascript
socketRef.current = io('http://localhost:5000', {
  auth: { token }
});
```
This aligns with the backend socket server middleware, which parses and decodes the token before allowing a socket connection to join channel rooms.

### Shared State Architecture in App.jsx
We used `App.jsx` as the central orchestrator to manage state flow:
* `user`: Determines if the login page should be shown.
* `currentWorkspace`: Determines if the Workspace Selector or the active Workspace Chat view is active.

This simple routing structure makes it easy to switch views without setting up complex routing libraries like React Router.

---

## 3. Detailed Code Explanations

### Auth.jsx API Payload Correction
* **Problem**: The backend PostgreSQL database schema and registration endpoint expected a `name` field, but the frontend React form state was transmitting `username`. This caused the backend validation middleware to return a `400 Bad Request` error.
* **Fix**: In `Auth.jsx`, we mapped the form's `username` field to `name` inside the POST payload:
  ```javascript
  const body = isLogin
      ? { email: formData.email, password: formData.password }
      : { name: formData.username, email: formData.email, password: formData.password };
  ```

### WorkspaceSelector.jsx & WorkspaceSelector.css
This component is the user's dashboard entry point:
* **Fetching Workspaces**: On mount, the component uses `fetchWorkspaces()` to run `apiRequest('/workspaces')` which fetches all workspaces where the current user has a `WorkspaceMember` record.
* **Creating Workspaces**: A `onSubmit` handler takes the user's workspace name and description, posts it to `/workspaces`, and appends the returned workspace object directly to the active state so the UI updates without requiring a page refresh.

### ChatArea.jsx & ChatArea.css
This is the core workspace screen. It handles real-time data synchronization:
* **Websocket Integration**:
  - `socketRef.current` initializes the Socket.IO connection.
  - An effect hook triggers when the `selectedChannel` changes, emitting `join_channel` (which makes the user join the specific channel room on the backend) and leaving the previous channel's room.
  - A listener `socketRef.current.on('new_message')` receives incoming messages and appends them to the messages state if they belong to the current active channel.
* **Typing Scroll-to-Bottom**:
  ```javascript
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  ```
  This effect hooks into the message array update event and moves the scrollbar container down, ensuring the user always sees the newest chat activity.

### App.jsx Coordination
`App.jsx` handles state flow:
```jsx
// Screen 1: Unauthenticated
if (!user) {
  return <Auth onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />;
}

// Screen 2: Authenticated but no Workspace selected
if (!currentWorkspace) {
  return (
    <WorkspaceSelector
      onSelectWorkspace={(ws) => setCurrentWorkspace(ws)}
      onLogout={handleLogout}
    />
  );
}

// Screen 3: Workspace active
return (
  <ChatArea
    workspace={currentWorkspace}
    currentUser={user}
    onBackToWorkspaces={() => setCurrentWorkspace(null)}
  />
);
```

---

## 4. Git History & Pushing Changes

At each step, we committed our progress and pushed the final result to main:
1. `Created ui for workspace creation` (WorkspaceSelector component)
2. `Created css for workspace creation ui`
3. `Added workspace selector to app.jsx`
4. `Created ChatArea.jsx for chat area inside workspace`
5. `Created ChatArea.css for styling chat area`
6. `Added ui for chat area inside workspace` (final integration inside App.jsx)
7. `git push origin main`
