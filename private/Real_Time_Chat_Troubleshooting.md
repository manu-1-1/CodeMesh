# CodeMesh Real-Time Chat Debugging & Troubleshooting Summary

This document details the issues encountered during the implementation and verification of **Phase 4: Real-Time Chat & Message Management**, the solutions implemented to resolve them, and detailed code explanations of the diagnostic updates.

---

## 1. Port Conflict Error (`EADDRINUSE`)

### The Error
```text
Error: listen EADDRINUSE: address already in use :::5000
    at Server.setupListenHandle [as _listen2] (node:net:1940:16)
    ...
  code: 'EADDRINUSE',
  errno: -4091,
  syscall: 'listen',
  address: '::',
  port: 5000
```

### Explanation & Cause
This error occurs when a developer attempts to start the Node.js backend server (`node src/index.js` or `npm run dev`) while port `5000` is already being bound by:
1. A previously running background server instance (e.g., an orphaned server process running in another terminal).
2. A system level or third-party background application running on Windows.

### The Fix
1. Find the process ID (PID) using port 5000 using PowerShell:
   ```powershell
   Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
   ```
2. Force-terminate the process using its PID:
   ```powershell
   Stop-Process -Id <PID> -Force
   ```
3. Alternatively, kill all orphaned `node` processes:
   ```powershell
   Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
   ```

---

## 2. Silent Test Script Hangs (Lack of Error Visibility)

### The Problem
During execution of `node test_chat.js`, the test client hung indefinitely at step 4:
```text
4. Testing real-time message sending and receipt...
(no logs, no progress, script hangs forever)
```

### Explanation & Cause
Two factors contributed to this silent failure:
1. **Server-side Silenced Catch**: The catch blocks inside the WebSocket handlers in `backend/src/lib/socket.js` were catching database exceptions and emitting them to the client via `socket.emit('error', ...)` but did not print them to the server console (`console.error`).
2. **Client-side Missing Listeners**: The test runner script `backend/test_chat.js` did not listen for the `'error'` event on the socket. When the server rejected the socket request, the error was received silently, and the test continued waiting forever for the `new_message` event.

### The Fix
1. **Server Diagnostics**: Added `console.error("Error in [event_name] event:", error)` inside the catch blocks in [socket.js](file:///d:/Projects/CodeMesh/backend/src/lib/socket.js):
   ```javascript
   } catch (error) {
       console.error("Error in send_message event:", error);
       socket.emit('error', { message: error.message });
   }
   ```
2. **Client Diagnostics**: Added socket-level error listeners in the `connectSocket` helper inside [test_chat.js](file:///d:/Projects/CodeMesh/backend/test_chat.js):
   ```javascript
   socket.on('connect', () => {
       socket.on('error', (err) => console.error(`❌ Socket error event:`, err));
       resolve(socket);
   });
   ```

---

## 3. Prisma Client Out of Sync (`TypeError`)

### The Error
After improving diagnostic logging, the client immediately reported the underlying crash:
```text
❌ Socket error event: { message: "Cannot read properties of undefined (reading 'create')" }
```
And the server console showed:
```text
Error in send_message event: TypeError: Cannot read properties of undefined (reading 'create')
    at Socket.<anonymous> (file:///D:/Projects/CodeMesh/backend/src/lib/socket.js:132:54)
```

### Explanation & Cause
The error was caused by calling `prisma.message.create(...)`. In the database, the `messages` table migration was successfully executed, but the Javascript Prisma Client code generation was skipped. The `@prisma/client` library in `node_modules` was still in its old state and did not have the `.message` property configured on the client instance, making `prisma.message` resolve to `undefined`.

### The Fix
1. Run the Prisma generator to rebuild the Client types and JavaScript library:
   ```powershell
   npx prisma generate
   ```
2. Restart the Express/Socket.IO backend server to load the newly generated client:
   ```powershell
   node src/index.js
   ```

---

## 4. Summary of Code Changes Made

### A. Socket Error Logging
In `backend/src/lib/socket.js`, we updated the error catch routines for real-time events to output stack logs:

* **Join Channel**:
  ```javascript
  } catch (error) {
      console.error("Error in join_channel event:", error);
      socket.emit('error', { message: error.message });
  }
  ```
* **Send Message**:
  ```javascript
  } catch (error) {
      console.error("Error in send_message event:", error);
      socket.emit('error', { message: error.message });
  }
  ```
* **Typing Indicator**:
  ```javascript
  socket.on('typing', ({ channelId, isTyping }) => {
      try {
          if (!channelId) return;
          const eventName = isTyping ? 'typing_started' : 'typing_stopped';
          socket.to(`channel:${channelId}`).emit(eventName, { userId: socket.userId });
      } catch (error) {
          console.error("Error in typing event:", error);
      }
  });
  ```

### B. Socket Error Client Event Handlers
In `backend/test_chat.js`, we added a listener for the `'error'` event on sockets:
```javascript
function connectSocket(token) {
    return new Promise((resolve, reject) => {
        const socket = ioClient(`http://localhost:${PORT}`, {
            auth: { token }
        });
        socket.on('connect', () => {
            socket.on('error', (err) => console.error(`❌ Socket error event:`, err));
            resolve(socket);
        });
        socket.on('connect_error', (err) => reject(err));
    });
}
```
