const PORT = process.env.PORT || 5000;
const BASE_AUTH_URL = `http://localhost:${PORT}/api/v1/auth`;
const BASE_WORKSPACE_URL = `http://localhost:${PORT}/api/v1/workspaces`;
const BASE_CHANNEL_URL = `http://localhost:${PORT}/api/v1/channels`;

const timestamp = Date.now();
const testOwner = {
    name: "Channel Owner",
    email: `owner_${timestamp}@example.com`,
    password: "password123"
};
const testMember = {
    name: "Channel Member",
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
    console.log("=== Testing Channel Management Endpoints ===");
    let ownerToken, memberToken;
    let workspaceId, defaultChannelId, customChannelId;

    try {
        // 1. Register Owner
        console.log("\n1. Registering workspace owner...");
        const regOwner = await postJSON(`${BASE_AUTH_URL}/register`, testOwner);
        console.log(`Status: ${regOwner.status}`, regOwner.data);
        if (regOwner.status !== 201) throw new Error("Owner registration failed");
        ownerToken = regOwner.data.token;

        // 2. Register Member
        console.log("\n2. Registering regular workspace member...");
        const regMember = await postJSON(`${BASE_AUTH_URL}/register`, testMember);
        console.log(`Status: ${regMember.status}`, regMember.data);
        if (regMember.status !== 201) throw new Error("Member registration failed");
        memberToken = regMember.data.token;

        // 3. Create Workspace as Owner
        console.log("\n3. Creating workspace (should automatically create 'general' channel)...");
        const createWS = await postJSON(`${BASE_WORKSPACE_URL}/`, {
            name: "Test Channels Workspace",
            description: "Testing channels isolation"
        }, ownerToken);
        console.log(`Status: ${createWS.status}`, createWS.data);
        if (createWS.status !== 201) throw new Error("Workspace creation failed");
        workspaceId = createWS.data.workspace.id;
        
        // Check default channel
        const defaultChannel = createWS.data.defaultChannel;
        if (!defaultChannel) throw new Error("Default channel was not returned");
        if (defaultChannel.name !== "general" || defaultChannel.type !== "GENERAL") {
            throw new Error(`Default channel parameters invalid: ${JSON.stringify(defaultChannel)}`);
        }
        defaultChannelId = defaultChannel.id;
        console.log("✅ Default general channel verified successfully!");

        // 4. Invite Member to Workspace
        console.log("\n4. Adding member to workspace...");
        const addMem = await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, {
            email: testMember.email,
            role: "MEMBER"
        }, ownerToken);
        console.log(`Status: ${addMem.status}`, addMem.data);
        if (addMem.status !== 201) throw new Error("Failed to add member to workspace");

        // 5. Create Custom Channel as Owner
        console.log("\n5. Creating custom CHAT channel as owner...");
        const createChan = await postJSON(`${BASE_CHANNEL_URL}/`, {
            workspaceId,
            name: "code-reviews",
            type: "CODE_REVIEW"
        }, ownerToken);
        console.log(`Status: ${createChan.status}`, createChan.data);
        if (createChan.status !== 201) throw new Error("Failed to create custom channel");
        customChannelId = createChan.data.channel.id;

        // 6. Test Duplicate Channel Name Check
        console.log("\n6. Trying to create duplicate channel (case-insensitive name check)...");
        const createDup = await postJSON(`${BASE_CHANNEL_URL}/`, {
            workspaceId,
            name: "  Code-Reviews  ",
            type: "CHAT"
        }, ownerToken);
        console.log(`Status: ${createDup.status}`, createDup.data);
        if (createDup.status === 201) throw new Error("Allowed duplicate channel name creation!");
        console.log("✅ Correctly rejected duplicate channel name!");

        // 7. Test Channel Creation Permissions (Member should be blocked)
        console.log("\n7. Trying to create channel as regular member (should fail)...");
        const memberCreate = await postJSON(`${BASE_CHANNEL_URL}/`, {
            workspaceId,
            name: "member-secrets",
            type: "CHAT"
        }, memberToken);
        console.log(`Status: ${memberCreate.status}`, memberCreate.data);
        if (memberCreate.status !== 403) throw new Error("Non-admin allowed to create channel!");
        console.log("✅ Correctly blocked regular member from creating a channel");

        // 8. List Channels as Owner
        console.log("\n8. Listing channels as workspace owner...");
        const listOwner = await getJSON(`${BASE_CHANNEL_URL}?workspaceId=${workspaceId}`, ownerToken);
        console.log(`Status: ${listOwner.status}, Count: ${listOwner.data.length}`, listOwner.data);
        if (listOwner.status !== 200) throw new Error("Failed to list channels as owner");
        if (listOwner.data.length !== 2) throw new Error("Incorrect channel list count");

        // 9. List Channels as Member
        console.log("\n9. Listing channels as workspace member...");
        const listMember = await getJSON(`${BASE_CHANNEL_URL}?workspaceId=${workspaceId}`, memberToken);
        console.log(`Status: ${listMember.status}, Count: ${listMember.data.length}`);
        if (listMember.status !== 200) throw new Error("Failed to list channels as member");

        // 10. List Channels as Non-Member (should fail)
        console.log("\n10. Listing channels as non-member of workspace...");
        // Let's register another user who is not in the workspace
        const regNonMember = await postJSON(`${BASE_AUTH_URL}/register`, {
            name: "Stranger",
            email: `stranger_${timestamp}@example.com`,
            password: "password123"
        });
        const strangerToken = regNonMember.data.token;
        const listStranger = await getJSON(`${BASE_CHANNEL_URL}?workspaceId=${workspaceId}`, strangerToken);
        console.log(`Status: ${listStranger.status}`, listStranger.data);
        if (listStranger.status !== 403) throw new Error("Non-member allowed to list channels!");
        console.log("✅ Correctly blocked non-member from listing channels");

        // 11. Delete Default 'general' Channel (should fail)
        console.log("\n11. Trying to delete default general channel (should fail)...");
        const delGeneral = await deleteJSON(`${BASE_CHANNEL_URL}/${defaultChannelId}`, ownerToken);
        console.log(`Status: ${delGeneral.status}`, delGeneral.data);
        if (delGeneral.status !== 400) throw new Error("Allowed deletion of general channel!");
        console.log("✅ Correctly blocked deletion of default general channel");

        // 12. Delete Custom Channel as Member (should fail)
        console.log("\n12. Trying to delete custom channel as regular member (should fail)...");
        const delCustomMember = await deleteJSON(`${BASE_CHANNEL_URL}/${customChannelId}`, memberToken);
        console.log(`Status: ${delCustomMember.status}`, delCustomMember.data);
        if (delCustomMember.status !== 403) throw new Error("Regular member allowed to delete channel!");
        console.log("✅ Correctly blocked member from deleting channel");

        // 13. Delete Custom Channel as Owner (should succeed)
        console.log("\n13. Deleting custom channel as owner...");
        const delCustomOwner = await deleteJSON(`${BASE_CHANNEL_URL}/${customChannelId}`, ownerToken);
        console.log(`Status: ${delCustomOwner.status}`, delCustomOwner.data);
        if (delCustomOwner.status !== 200) throw new Error("Owner failed to delete channel");

        // 14. Verify Channel was Deleted
        console.log("\n14. Listing channels again to verify deletion...");
        const listFinal = await getJSON(`${BASE_CHANNEL_URL}?workspaceId=${workspaceId}`, ownerToken);
        console.log(`Status: ${listFinal.status}, Count: ${listFinal.data.length}`, listFinal.data);
        if (listFinal.data.length !== 1 || listFinal.data[0].id !== defaultChannelId) {
            throw new Error("Channel deletion verification failed");
        }
        console.log("✅ Deletion successfully verified!");

        // 15. Clean Up Workspace (Cascades to channels & members)
        console.log("\n15. Cleaning up test workspace (Cascade check)...");
        const delWS = await deleteJSON(`${BASE_WORKSPACE_URL}/${workspaceId}`, ownerToken);
        console.log(`Status: ${delWS.status}`, delWS.data);
        if (delWS.status !== 200) throw new Error("Failed to delete workspace");

        console.log("\n✅ ALL CHANNEL TESTS PASSED SUCCESSFULLY!");
    } catch (error) {
        console.error("\n❌ Test failed with error:", error.message);
        process.exit(1);
    }
}

runTests();
