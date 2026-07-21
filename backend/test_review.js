const PORT = process.env.PORT || 5000;
const BASE_AUTH_URL = `http://localhost:${PORT}/api/v1/auth`;
const BASE_WORKSPACE_URL = `http://localhost:${PORT}/api/v1/workspaces`;
const BASE_SNIPPET_URL = `http://localhost:${PORT}/api/v1/snippets`;
const BASE_REVIEW_URL = `http://localhost:${PORT}/api/v1/reviews`;

const timestamp = Date.now();
const testUser = {
    name: "Reviewer Tester",
    email: `review_${timestamp}@example.com`,
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

async function runTests() {
    console.log("=== Testing AI Code Reviews ===");
    try {
        // Register & login
        const regRes = await postJSON(`${BASE_AUTH_URL}/register`, testUser);
        const token = regRes.data.token;

        // Create workspace
        const wsRes = await postJSON(`${BASE_WORKSPACE_URL}/`, { name: "Review WS" }, token);
        const workspaceId = wsRes.data.workspace.id;

        // Create snippet with a security vulnerability
        const snippetRes = await postJSON(`${BASE_SNIPPET_URL}/`, {
            workspaceId,
            title: "Test Insecure Eval",
            language: "javascript",
            code: "let password = '123'; eval('alert(password)');"
        }, token);
        const snippetId = snippetRes.data.id;

        // Request Review
        console.log("\nRequesting AI Review...");
        const reviewRes = await postJSON(`${BASE_REVIEW_URL}/`, { snippetId }, token);
        console.log(`Status: ${reviewRes.status}`);
        console.log("Response:", reviewRes.data);
        if (reviewRes.status !== 201) throw new Error("Review request failed");

        // Fetch Review
        console.log("\nRetrieving AI Review details...");
        const getRes = await getJSON(`${BASE_REVIEW_URL}/${reviewRes.data.id}`, token);
        console.log(`Status: ${getRes.status}`);
        console.log("Summary:\n", getRes.data.summary);
        if (getRes.status !== 200) throw new Error("Could not retrieve review");

        console.log("\n✅ ALL AI REVIEW TESTS PASSED SUCCESSFULLY!");
    } catch (e) {
        console.error("❌ Test failed:", e.message);
        process.exit(1);
    }
}

runTests();
