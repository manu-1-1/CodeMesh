import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'test_github.log');

// Reset the log file
fs.writeFileSync(logFile, `=== Test Log started at ${new Date().toISOString()} ===\n\n`);

const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    originalLog(...args);
    fs.appendFileSync(logFile, args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ') + '\n');
};

console.error = (...args) => {
    originalError(...args);
    fs.appendFileSync(logFile, '[ERROR] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ') + '\n');
};

const PORT = process.env.PORT || 5000;
const BASE_AUTH_URL = `http://localhost:${PORT}/api/v1/auth`;
const BASE_WORKSPACE_URL = `http://localhost:${PORT}/api/v1/workspaces`;
const BASE_GITHUB_URL = `http://localhost:${PORT}/api/v1/github`;

const timestamp = Date.now();
const testUser = {
    name: "GitHub Developer",
    email: `github_dev_${timestamp}@example.com`,
    password: "password123"
};

async function postJSON(url, body, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
}

async function getJSON(url, token = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(url, { method: 'GET', headers });
    return { status: response.status, data: await response.json() };
}

async function deleteJSON(url, body, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers,
        body: JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
}

async function runTests() {
    console.log("=== Testing GitHub Integration ===");
    try {
        // 1. Register & Login
        const regRes = await postJSON(`${BASE_AUTH_URL}/register`, testUser);
        const token = regRes.data.token;
        console.log("1. User registered successfully.");

        // 2. Create Workspace
        const wsRes = await postJSON(`${BASE_WORKSPACE_URL}/`, { name: "GitHub Integration Workspace" }, token);
        const workspaceId = wsRes.data.workspace.id;
        console.log("2. Workspace created successfully.");

        // 3. Attempt Sync without GitHub Connection (Should fail with 400)
        console.log("\n3. Testing sync before connecting GitHub account...");
        const syncFailRes = await postJSON(`${BASE_GITHUB_URL}/sync`, { workspaceId }, token);
        console.log(`Status: ${syncFailRes.status}`);
        console.log("Response:", syncFailRes.data);
        if (syncFailRes.status !== 400) throw new Error("Sync should have failed without active GitHub connection");
        console.log("✅ Successfully blocked sync for disconnected accounts.");

        // 4. Connect GitHub Account
        console.log("\n4. Connecting GitHub account...");
        const connectRes = await postJSON(`${BASE_GITHUB_URL}/connect`, {
            workspaceId,
            githubUsername: "octocat",
            accessToken: "ghp_mock_token_123456"
        }, token);
        console.log(`Status: ${connectRes.status}`);
        console.log("Response:", connectRes.data);
        if (connectRes.status !== 200) throw new Error("Could not connect GitHub account");
        console.log("✅ GitHub account connected successfully.");

        // 5. Sync Repositories & PRs
        console.log("\n5. Syncing repositories and PRs...");
        const syncRes = await postJSON(`${BASE_GITHUB_URL}/sync`, { workspaceId }, token);
        console.log(`Status: ${syncRes.status}`);
        console.log("Response:", JSON.stringify(syncRes.data, null, 2));
        if (syncRes.status !== 200) throw new Error("Sync failed");
        console.log("✅ Repositories and PRs synced successfully.");

        // 6. Fetch Synced Repositories
        console.log("\n6. Retrieving synced repositories...");
        const reposRes = await getJSON(`${BASE_GITHUB_URL}/repositories?workspaceId=${workspaceId}`, token);
        console.log(`Status: ${reposRes.status}`);
        console.log("Synced repositories listing:", JSON.stringify(reposRes.data, null, 2));
        if (reposRes.status !== 200 || reposRes.data.length === 0) throw new Error("Could not fetch synced repositories");
        console.log("✅ Successfully listed synced repositories.");

        // 7. Disconnect GitHub Account
        console.log("\n7. Disconnecting GitHub account...");
        const disconnectRes = await deleteJSON(`${BASE_GITHUB_URL}/disconnect`, { workspaceId }, token);
        console.log(`Status: ${disconnectRes.status}`);
        if (disconnectRes.status !== 200) throw new Error("Disconnect failed");
        console.log("✅ GitHub account disconnected successfully.");

        // 8. Clean up (Cascade check)
        console.log("\n8. Cleaning up workspace...");
        const delRes = await deleteJSON(`${BASE_WORKSPACE_URL}/${workspaceId}`, token);
        if (delRes.status !== 200) throw new Error("Workspace deletion failed");
        console.log("✅ Cleaned up successfully.");

        console.log("\n✅ ALL GITHUB INTEGRATION TESTS PASSED SUCCESSFULLY!");
    } catch (e) {
        console.error("❌ Test failed:", e.message);
        process.exit(1);
    }
}

runTests();
