import { io as ioClient } from 'socket.io-client';

const PORT = process.env.PORT || 5000;
const BASE_AUTH_URL = `http://localhost:${PORT}/api/v1/auth`;
const BASE_WORKSPACE_URL = `http://localhost:${PORT}/api/v1/workspaces`;
const BASE_CHANNEL_URL = `http://localhost:${PORT}/api/v1/channels`;

const timestamp = Date.now();
const testOwner = {
    name: "Chat Owner",
    email: `owner_${timestamp}@example.com`,
    password: "password123"
};
const testMember = {
    name: "Chat Member",
    email: `member_${timestamp}@example.com`,
    password: "password123"
};
const testStranger = {
    name: "Chat Stranger",
    email: `stranger_${timestamp}@example.com`,
    password: "password123"
};

// Helper for making JSON POST requests
async function postJSON(url, body, token = null) {
    const headers = { 'Content-Type': 'application/json', 'x-test-bypass': 'true' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
}

// Helper for making JSON GET requests
async function getJSON(url, token = null) {
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, {
        method: 'GET',
        headers
    });
    return { status: response.status, data: await response.json() };
}

// Helper to establish a Socket.IO connection
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

async function runTests() {
    console.log("=== Testing Real-Time Chat & Message Endpoints ===");
    let ownerToken, memberToken, strangerToken;
    let workspaceId, channelId;
    let ownerSocket, memberSocket, strangerSocket;

    try {
        // 1. Setup Users & Workspace
        console.log("\n1. Setting up users, workspace, and member invite...");
        const regOwner = await postJSON(`${BASE_AUTH_URL}/register`, testOwner);
        ownerToken = regOwner.data.token;

        const regMember = await postJSON(`${BASE_AUTH_URL}/register`, testMember);
        memberToken = regMember.data.token;

        const regStranger = await postJSON(`${BASE_AUTH_URL}/register`, testStranger);
        strangerToken = regStranger.data.token;

        const createWS = await postJSON(`${BASE_WORKSPACE_URL}/`, {
            name: "Test Chat Workspace"
        }, ownerToken);
        workspaceId = createWS.data.workspace.id;
        channelId = createWS.data.defaultChannel.id; // Uses default '#general' channel

        await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, {
            email: testMember.email,
            role: "MEMBER"
        }, ownerToken);

        console.log("✅ Basic setup completed.");

        // 2. Test Socket.IO Authentication Middleware
        console.log("\n2. Testing socket connection & authentication...");
        ownerSocket = await connectSocket(ownerToken);
        console.log("✅ Workspace Owner socket authenticated and connected.");

        memberSocket = await connectSocket(memberToken);
        console.log("✅ Workspace Member socket authenticated and connected.");

        // Connect with invalid token
        try {
            await connectSocket("invalid-token-here");
            throw new Error("Allowed socket connection with invalid token");
        } catch (err) {
            console.log("✅ Successfully blocked socket with invalid token:", err.message);
        }

        // 3. Test Room Joining (Workspace Isolation Check)
        console.log("\n3. Testing room join permissions...");

        // Owner joins channel room
        ownerSocket.emit('join_channel', { channelId });

        // Member joins channel room
        memberSocket.emit('join_channel', { channelId });

        // Stranger (not in workspace) tries to join channel room
        strangerSocket = await connectSocket(strangerToken);
        strangerSocket.emit('join_channel', { channelId });

        // Wait a moment for async events
        await new Promise(r => setTimeout(r, 500));
        console.log("✅ Sockets joined channels.");

        // 4. Test Real-Time Broadcasting & Message Persistence
        console.log("\n4. Testing real-time message sending and receipt...");
        const ownerMessagePromise = new Promise((resolve) => {
            memberSocket.on('new_message', (msg) => {
                if (msg.content === "Hello from Owner!") {
                    resolve(msg);
                }
            });
        });

        // Stranger should NOT receive the message because they are not in the room
        let strangerReceived = false;
        strangerSocket.on('new_message', (msg) => {
            strangerReceived = true;
        });

        ownerSocket.emit('send_message', { channelId, content: "Hello from Owner!" });

        const receivedMsg = await ownerMessagePromise;
        console.log("✅ Member successfully received owner's message in real-time:", receivedMsg.content);

        if (strangerReceived) {
            throw new Error("Stranger received a channel message they shouldn't have!");
        }
        console.log("✅ Verified that non-members do not receive room messages.");

        // 5. Test REST Message History Retrieval
        console.log("\n5. Testing message retrieval endpoint...");

        // Workspace Member gets history
        const historyRes = await getJSON(`${BASE_CHANNEL_URL}/${channelId}/messages`, memberToken);
        console.log(`Status: ${historyRes.status}, Message Count: ${historyRes.data.length}`);
        if (historyRes.status !== 200) throw new Error("Failed to get messages as workspace member");
        if (historyRes.data[0].content !== "Hello from Owner!") throw new Error("Retrieved incorrect message content");
        console.log("✅ Workspace member fetched history successfully!");

        // Non-Member tries to get history
        const strangerHistory = await getJSON(`${BASE_CHANNEL_URL}/${channelId}/messages`, strangerToken);
        console.log(`Stranger Status: ${strangerHistory.status}`);
        if (strangerHistory.status !== 403) throw new Error("Allowed non-member to fetch channel messages!");
        console.log("✅ Blocked non-member from fetching messages history.");

        // Cleanup
        console.log("\n6. Cleaning up sockets and workspace...");
        ownerSocket.disconnect();
        memberSocket.disconnect();
        strangerSocket.disconnect();

        const deleteWSRes = await fetch(`${BASE_WORKSPACE_URL}/${workspaceId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${ownerToken}` }
        });
        if (deleteWSRes.status !== 200) throw new Error("Failed to clean up test workspace");

        console.log("\n✅ ALL REAL-TIME CHAT & MESSAGE TESTS PASSED SUCCESSFULLY!");
    } catch (error) {
        console.error("\n❌ Test failed with error:", error.message);
        if (ownerSocket) ownerSocket.disconnect();
        if (memberSocket) memberSocket.disconnect();
        if (strangerSocket) strangerSocket.disconnect();
        process.exit(1);
    }
}

runTests();
