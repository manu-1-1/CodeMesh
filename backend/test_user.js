import { io as ioClient } from 'socket.io-client';

const PORT = process.env.PORT || 5000;
const BASE_AUTH_URL = `http://localhost:${PORT}/api/v1/auth`;
const BASE_USERS_URL = `http://localhost:${PORT}/api/v1/users`;
const BASE_WORKSPACE_URL = `http://localhost:${PORT}/api/v1/workspaces`;

const timestamp = Date.now();
const testOwner = {
    name: "Ext Owner",
    email: `owner_${timestamp}@example.com`,
    password: "password123"
};
const testMember = {
    name: "Ext Member",
    email: `member_${timestamp}@example.com`,
    password: "password123"
};

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

async function putJSON(url, body, token = null) {
    const headers = { 'Content-Type': 'application/json', 'x-test-bypass': 'true' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
}

function connectSocket(token) {
    return new Promise((resolve, reject) => {
        const socket = ioClient(`http://localhost:${PORT}`, {
            auth: { token }
        });
        socket.on('connect', () => {
            resolve(socket);
        });
        socket.on('connect_error', (err) => reject(err));
    });
}

async function runTests() {
    console.log("=== Testing MVP Extensions & Message Editing/Deletion ===");
    let ownerToken, memberToken;
    let workspaceId, channelId;
    let ownerSocket, memberSocket;

    try {
        // 1. Setup Users
        console.log("\n1. Registering users...");
        const regOwner = await postJSON(`${BASE_AUTH_URL}/register`, testOwner);
        ownerToken = regOwner.data.token;
        const regMember = await postJSON(`${BASE_AUTH_URL}/register`, testMember);
        memberToken = regMember.data.token;
        console.log("✅ Users registered.");

        // 2. Test profile & password update endpoints
        console.log("\n2. Testing profile update...");
        const profRes = await putJSON(`${BASE_USERS_URL}/profile`, { name: "Updated Ext Owner", avatarUrl: "https://avatar.com/owner" }, ownerToken);
        console.log(`Status: ${profRes.status}`, profRes.data);
        if (profRes.status !== 200 || profRes.data.user.name !== "Updated Ext Owner") {
            throw new Error("Profile update failed");
        }
        console.log("✅ Profile updated successfully.");

        console.log("\n3. Testing password update...");
        const passRes = await putJSON(`${BASE_USERS_URL}/password`, { oldPassword: "password123", newPassword: "newsecurepass" }, ownerToken);
        console.log(`Status: ${passRes.status}`, passRes.data);
        if (passRes.status !== 200) {
            throw new Error("Password update failed");
        }
        // Test logging in with new password
        const loginRes = await postJSON(`${BASE_AUTH_URL}/login`, { email: testOwner.email, password: "newsecurepass" });
        if (loginRes.status !== 200) {
            throw new Error("Login with new password failed");
        }
        ownerToken = loginRes.data.token;
        console.log("✅ Password updated & verified successfully.");

        // 4. Test workspace roles & leave workspace
        console.log("\n4. Creating workspace...");
        const createWS = await postJSON(`${BASE_WORKSPACE_URL}/`, { name: "Ext Workspace" }, ownerToken);
        workspaceId = createWS.data.workspace.id;
        channelId = createWS.data.defaultChannel.id;

        console.log("Inviting member...");
        await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, { email: testMember.email, role: "MEMBER" }, ownerToken);

        console.log("Promoting member to ADMIN...");
        const roleRes = await putJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members/${regMember.data.user.id}`, { role: "ADMIN" }, ownerToken);
        console.log(`Status: ${roleRes.status}`, roleRes.data);
        if (roleRes.status !== 200 || roleRes.data.member.role !== "ADMIN") {
            throw new Error("Member promotion failed");
        }
        console.log("✅ Member promoted to ADMIN successfully.");

        console.log("Testing leave workspace...");
        const leaveRes = await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/leave`, {}, memberToken);
        console.log(`Status: ${leaveRes.status}`, leaveRes.data);
        if (leaveRes.status !== 200) {
            throw new Error("Member failed to leave workspace");
        }
        console.log("✅ Member successfully left workspace.");

        // Re-invite member to test socket chat editing/deleting
        await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, { email: testMember.email, role: "MEMBER" }, ownerToken);

        // 5. Connect Sockets & Test Message Edit/Delete
        console.log("\n5. Testing message edit & delete via Sockets...");
        ownerSocket = await connectSocket(ownerToken);
        memberSocket = await connectSocket(memberToken);

        ownerSocket.emit('join_channel', { channelId });
        memberSocket.emit('join_channel', { channelId });
        await new Promise(r => setTimeout(r, 200));

        let sentMsgId;
        const msgPromise = new Promise((resolve) => {
            memberSocket.on('new_message', (msg) => {
                sentMsgId = msg.id;
                resolve();
            });
        });
        ownerSocket.emit('send_message', { channelId, content: "Original message" });
        await msgPromise;

        // Edit message
        const editPromise = new Promise((resolve) => {
            memberSocket.on('message_edited', (msg) => {
                if (msg.id === sentMsgId && msg.content === "Edited message content") {
                    resolve(msg);
                }
            });
        });
        ownerSocket.emit('edit_message', { messageId: sentMsgId, content: "Edited message content" });
        const editedMsg = await editPromise;
        console.log("✅ Received message_edited event in real-time. Content:", editedMsg.content);
        if (!editedMsg.edited) throw new Error("Message edited flag was not true!");

        // Delete message
        const deletePromise = new Promise((resolve) => {
            memberSocket.on('message_deleted', (msg) => {
                if (msg.messageId === sentMsgId) {
                    resolve(msg);
                }
            });
        });
        ownerSocket.emit('delete_message', { messageId: sentMsgId });
        const deletedMsg = await deletePromise;
        console.log("✅ Received message_deleted event in real-time for message ID:", deletedMsg.messageId);

        // Clean up
        ownerSocket.disconnect();
        memberSocket.disconnect();

        console.log("\n6. Cleaning up test workspace...");
        const deleteWS = await fetch(`${BASE_WORKSPACE_URL}/${workspaceId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${ownerToken}` }
        });
        if (deleteWS.status !== 200) throw new Error("Workspace cleanup failed");

        console.log("\n✅ ALL EXTENSION TESTS PASSED SUCCESSFULLY!");
    } catch (err) {
        console.error("\n❌ Test failed with error:", err.message);
        if (ownerSocket) ownerSocket.disconnect();
        if (memberSocket) memberSocket.disconnect();
        process.exit(1);
    }
}

runTests();
