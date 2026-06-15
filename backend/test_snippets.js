const PORT = process.env.PORT || 5000;
const BASE_AUTH_URL = `http://localhost:${PORT}/api/v1/auth`;
const BASE_WORKSPACE_URL = `http://localhost:${PORT}/api/v1/workspaces`;
const BASE_SNIPPET_URL = `http://localhost:${PORT}/api/v1/snippets`;

const timestamp = Date.now();
const testOwner = {
    name: "Snippet Owner",
    email: `owner_${timestamp}@example.com`,
    password: "password123"
};
const testMember = {
    name: "Snippet Member",
    email: `member_${timestamp}@example.com`,
    password: "password123"
};
const testStranger = {
    name: "Snippet Stranger",
    email: `stranger_${timestamp}@example.com`,
    password: "password123"
};

async function postJSON(url, body, token = null) {
    const headers = { 'Content-Type': 'application/json' };
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

async function putJSON(url, body, token = null) {
    const headers = { 'Content-Type': 'application/json' };
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

async function deleteJSON(url, token = null) {
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, {
        method: 'DELETE',
        headers
    });
    return { status: response.status, data: await response.json() };
}

async function runTests() {
    console.log("=== Testing Snippet CRUD & Permission Endpoints ===");
    let ownerToken, memberToken, strangerToken;
    let workspaceId, snippetId;

    try {
        // 1. Setup Users & Workspace
        console.log("\n1. Setting up users and workspaces...");
        const regOwner = await postJSON(`${BASE_AUTH_URL}/register`, testOwner);
        ownerToken = regOwner.data.token;

        const regMember = await postJSON(`${BASE_AUTH_URL}/register`, testMember);
        memberToken = regMember.data.token;

        const regStranger = await postJSON(`${BASE_AUTH_URL}/register`, testStranger);
        strangerToken = regStranger.data.token;

        const createWS = await postJSON(`${BASE_WORKSPACE_URL}/`, {
            name: "Snippet Test Workspace"
        }, ownerToken);
        workspaceId = createWS.data.workspace.id;

        // Invite member
        await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, {
            email: testMember.email,
            role: "MEMBER"
        }, ownerToken);

        console.log("✅ Setup complete.");

        // 2. Create Snippet as Workspace Member (Should succeed)
        console.log("\n2. Creating a snippet as workspace member...");
        const createSnippet = await postJSON(`${BASE_SNIPPET_URL}/`, {
            workspaceId,
            title: "Bubble Sort",
            language: "javascript",
            code: "console.log('bubble sort');"
        }, memberToken);
        console.log(`Status: ${createSnippet.status}`, createSnippet.data);
        if (createSnippet.status !== 201) throw new Error("Snippet creation failed");
        snippetId = createSnippet.data.id;
        console.log("✅ Snippet created successfully.");

        // 3. Create Snippet as Stranger (Should fail with 403)
        console.log("\n3. Stranger attempting to create snippet (should fail)...");
        const strangerCreate = await postJSON(`${BASE_SNIPPET_URL}/`, {
            workspaceId,
            title: "Evil Code",
            language: "javascript",
            code: "eval('evil');"
        }, strangerToken);
        console.log(`Status: ${strangerCreate.status}`, strangerCreate.data);
        if (strangerCreate.status !== 403) throw new Error("Allowed non-member to create snippet!");
        console.log("✅ Correctly blocked stranger from creating a snippet.");

        // 4. Get Snippet Details by ID (Should succeed for workspace owner)
        console.log("\n4. Retrieving snippet details as owner...");
        const getSnippet = await getJSON(`${BASE_SNIPPET_URL}/${snippetId}`, ownerToken);
        console.log(`Status: ${getSnippet.status}`, getSnippet.data);
        if (getSnippet.status !== 200) throw new Error("Failed to retrieve snippet details");
        console.log("✅ Snippet details retrieved successfully.");

        // 5. Get Snippet Details as Stranger (Should fail with 403)
        console.log("\n5. Stranger trying to fetch snippet details (should fail)...");
        const strangerGet = await getJSON(`${BASE_SNIPPET_URL}/${snippetId}`, strangerToken);
        console.log(`Status: ${strangerGet.status}`, strangerGet.data);
        if (strangerGet.status !== 403) throw new Error("Allowed stranger to view snippet!");
        console.log("✅ Correctly blocked stranger from viewing snippet.");

        // 6. Update Snippet as Author (Should succeed)
        console.log("\n6. Updating snippet title and code as author...");
        const updateSnippet = await putJSON(`${BASE_SNIPPET_URL}/${snippetId}`, {
            title: "Improved Bubble Sort",
            code: "console.log('faster bubble sort');"
        }, memberToken);
        console.log(`Status: ${updateSnippet.status}`, updateSnippet.data);
        if (updateSnippet.status !== 200 || updateSnippet.data.title !== "Improved Bubble Sort") {
            throw new Error("Failed to update snippet as author");
        }
        console.log("✅ Snippet successfully updated by author.");

        // 7. Update Snippet as Stranger (Should fail with 403)
        console.log("\n7. Stranger attempting to update snippet (should fail)...");
        const strangerUpdate = await putJSON(`${BASE_SNIPPET_URL}/${snippetId}`, {
            title: "Hacked Title"
        }, strangerToken);
        console.log(`Status: ${strangerUpdate.status}`, strangerUpdate.data);
        if (strangerUpdate.status !== 403) throw new Error("Allowed stranger to edit snippet!");
        console.log("✅ Correctly blocked stranger from updating snippet.");

        // 8. Delete Snippet as Stranger (Should fail)
        console.log("\n8. Stranger trying to delete snippet (should fail)...");
        const strangerDelete = await deleteJSON(`${BASE_SNIPPET_URL}/${snippetId}`, strangerToken);
        console.log(`Status: ${strangerDelete.status}`, strangerDelete.data);
        if (strangerDelete.status !== 403) throw new Error("Allowed stranger to delete snippet!");
        console.log("✅ Correctly blocked stranger from deleting snippet.");

        // 9. Delete Snippet as Owner/Admin (Should succeed)
        console.log("\n9. Deleting snippet as workspace owner...");
        const ownerDelete = await deleteJSON(`${BASE_SNIPPET_URL}/${snippetId}`, ownerToken);
        console.log(`Status: ${ownerDelete.status}`, ownerDelete.data);
        if (ownerDelete.status !== 200) throw new Error("Owner failed to delete snippet");
        console.log("✅ Snippet deleted successfully by workspace owner.");

        // 10. Clean up
        console.log("\n10. Cleaning up test workspace...");
        await deleteJSON(`${BASE_WORKSPACE_URL}/${workspaceId}`, ownerToken);
        console.log("✅ Workspace deleted successfully.");

        console.log("\n✅ ALL SNIPPET TESTS PASSED SUCCESSFULLY!");
    } catch (error) {
        console.error("\n❌ Test failed with error:", error.message);
        process.exit(1);
    }
}

runTests();
