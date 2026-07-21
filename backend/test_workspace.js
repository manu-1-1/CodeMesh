const PORT = process.env.PORT || 5000;
const BASE_AUTH_URL = `http://localhost:${PORT}/api/v1/auth`;
const BASE_WORKSPACE_URL = `http://localhost:${PORT}/api/v1/workspaces`;

const timestamp = Date.now();
const testOwner = {
    name: "Workspace Owner",
    email: `ws_owner_${timestamp}@example.com`,
    password: "password123"
};
const testAdmin = {
    name: "Workspace Admin",
    email: `ws_admin_${timestamp}@example.com`,
    password: "password123"
};
const testMember = {
    name: "Workspace Member",
    email: `ws_member_${timestamp}@example.com`,
    password: "password123"
};
const testStranger = {
    name: "Workspace Stranger",
    email: `ws_stranger_${timestamp}@example.com`,
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
    console.log("=== Testing Workspace & Member Management Endpoints ===");
    let ownerToken, adminToken, memberToken, strangerToken;
    let ownerId, adminId, memberId, strangerId;
    let workspaceId;

    try {
        // 1. Register and Login Users
        console.log("\n1. Registering test users...");
        
        const regOwner = await postJSON(`${BASE_AUTH_URL}/register`, testOwner);
        if (regOwner.status !== 201) throw new Error("Owner registration failed");
        ownerToken = regOwner.data.token;
        ownerId = regOwner.data.user.id;

        const regAdmin = await postJSON(`${BASE_AUTH_URL}/register`, testAdmin);
        if (regAdmin.status !== 201) throw new Error("Admin registration failed");
        adminToken = regAdmin.data.token;
        adminId = regAdmin.data.user.id;

        const regMember = await postJSON(`${BASE_AUTH_URL}/register`, testMember);
        if (regMember.status !== 201) throw new Error("Member registration failed");
        memberToken = regMember.data.token;
        memberId = regMember.data.user.id;

        const regStranger = await postJSON(`${BASE_AUTH_URL}/register`, testStranger);
        if (regStranger.status !== 201) throw new Error("Stranger registration failed");
        strangerToken = regStranger.data.token;
        strangerId = regStranger.data.user.id;

        console.log("✅ Users registered successfully.");

        // 2. Create Workspace
        console.log("\n2. Creating workspace as User A (Owner)...");
        const createWS = await postJSON(`${BASE_WORKSPACE_URL}/`, {
            name: "Test Workspace Org",
            description: "Initial workspace description"
        }, ownerToken);
        console.log(`Status: ${createWS.status}`, createWS.data);
        if (createWS.status !== 201) throw new Error("Workspace creation failed");
        workspaceId = createWS.data.workspace.id;

        // 3. List User's Workspaces
        console.log("\n3. Listing workspaces for Owner...");
        const listWS = await getJSON(`${BASE_WORKSPACE_URL}/`, ownerToken);
        console.log(`Status: ${listWS.status}, Count: ${listWS.data.length}`);
        if (listWS.status !== 200 || listWS.data.length === 0) {
            throw new Error("Failed to list workspaces for owner");
        }

        // 4. Fetch Workspace Details by ID
        console.log("\n4. Fetching workspace details by ID...");
        const getWS = await getJSON(`${BASE_WORKSPACE_URL}/${workspaceId}`, ownerToken);
        console.log(`Status: ${getWS.status}`, getWS.data);
        if (getWS.status !== 200) throw new Error("Failed to retrieve workspace details");

        // 5. Update Workspace Details
        console.log("\n5. Updating workspace name and description...");
        const updateWS = await putJSON(`${BASE_WORKSPACE_URL}/${workspaceId}`, {
            name: "Updated Workspace Org",
            description: "Updated workspace description"
        }, ownerToken);
        console.log(`Status: ${updateWS.status}`, updateWS.data);
        if (updateWS.status !== 200 || updateWS.data.workspace.name !== "Updated Workspace Org") {
            throw new Error("Failed to update workspace details");
        }

        // 6. Invite Admin to Workspace
        console.log("\n6. Inviting Admin member...");
        const inviteAdmin = await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, {
            email: testAdmin.email,
            role: "ADMIN"
        }, ownerToken);
        console.log(`Status: ${inviteAdmin.status}`, inviteAdmin.data);
        if (inviteAdmin.status !== 201) throw new Error("Failed to invite admin");

        // 7. Invite Member to Workspace
        console.log("\n7. Inviting regular Member...");
        const inviteMem = await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, {
            email: testMember.email,
            role: "MEMBER"
        }, ownerToken);
        console.log(`Status: ${inviteMem.status}`, inviteMem.data);
        if (inviteMem.status !== 201) throw new Error("Failed to invite regular member");

        // 8. List Workspace Members
        console.log("\n8. Listing all members of the workspace...");
        const listMembers = await getJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, ownerToken);
        console.log(`Status: ${listMembers.status}, Count: ${listMembers.data.length}`, listMembers.data);
        if (listMembers.status !== 200 || listMembers.data.length !== 3) {
            throw new Error("Members list count mismatch");
        }

        // 9. Test Permissions: Regular Member Inviting Someone (Should fail)
        console.log("\n9. Trying to invite user as a regular member (should fail)...");
        const invalidInvite = await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, {
            email: testStranger.email,
            role: "MEMBER"
        }, memberToken);
        console.log(`Status: ${invalidInvite.status}`, invalidInvite.data);
        if (invalidInvite.status !== 403) throw new Error("Regular member was allowed to invite members");
        console.log("✅ Correctly rejected member invitation permission");

        // 10. Test Permissions: Admin Inviting Someone (Should succeed)
        console.log("\n10. Trying to invite user as an Admin (should succeed)...");
        // Invite stranger as member
        const adminInvite = await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, {
            email: testStranger.email,
            role: "MEMBER"
        }, adminToken);
        console.log(`Status: ${adminInvite.status}`, adminInvite.data);
        if (adminInvite.status !== 201) throw new Error("Admin was blocked from inviting member");
        console.log("✅ Admin successfully invited member");

        // 11. Test Permissions: Stranger fetching workspace details (Should fail)
        console.log("\n11. Stranger trying to view workspace details (should fail)...");
        const strangerView = await getJSON(`${BASE_WORKSPACE_URL}/${workspaceId}`, strangerToken);
        console.log(`Status: ${strangerView.status}`, strangerView.data);
        // Stranger is member now because Admin invited them in Step 10. Let's make sure we test using a clean non-member.
        // Wait, stranger is now a member. Let's remove them first, or register another non-member.
        // Let's remove stranger first to test non-member access block.
        console.log("Removing stranger from workspace to test stranger block...");
        const removeStranger = await deleteJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members/${strangerId}`, ownerToken);
        if (removeStranger.status !== 200) throw new Error("Failed to remove stranger");

        const strangerViewBlocked = await getJSON(`${BASE_WORKSPACE_URL}/${workspaceId}`, strangerToken);
        console.log(`Stranger view after removal status: ${strangerViewBlocked.status}`, strangerViewBlocked.data);
        if (strangerViewBlocked.status !== 403) throw new Error("Stranger allowed to view workspace details!");
        console.log("✅ Correctly blocked non-member from viewing workspace details");

        // 12. Test Member Removal Rules: Admin trying to kick the Owner (Should fail)
        console.log("\n12. Admin trying to kick the workspace Owner (should fail)...");
        const kickOwner = await deleteJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members/${ownerId}`, adminToken);
        console.log(`Status: ${kickOwner.status}`, kickOwner.data);
        if (kickOwner.status !== 400) throw new Error("Admin allowed to remove the workspace Owner!");
        console.log("✅ Correctly prevented kicking workspace Owner");

        // 13. Test Member Removal Rules: Admin trying to kick another Admin (Should fail)
        console.log("\n13. Admin trying to kick another Admin (should fail)...");
        // Let's temporarily invite User D (Stranger) as ADMIN
        await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, {
            email: testStranger.email,
            role: "ADMIN"
        }, ownerToken);
        const kickAdminByAdmin = await deleteJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members/${strangerId}`, adminToken);
        console.log(`Status: ${kickAdminByAdmin.status}`, kickAdminByAdmin.data);
        if (kickAdminByAdmin.status !== 403) throw new Error("Admin was allowed to remove another Admin!");
        console.log("✅ Correctly prevented Admin from removing another Admin");

        // 14. Test Member Removal: Admin kicking regular Member (Should succeed)
        console.log("\n14. Admin kicking regular Member (should succeed)...");
        const kickMemByAdmin = await deleteJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members/${memberId}`, adminToken);
        console.log(`Status: ${kickMemByAdmin.status}`, kickMemByAdmin.data);
        if (kickMemByAdmin.status !== 200) throw new Error("Admin failed to remove regular member");
        console.log("✅ Admin successfully kicked regular member");

        // 15. Test Member Removal: Owner kicking Admin (Should succeed)
        console.log("\n15. Owner kicking Admin (should succeed)...");
        const kickAdminByOwner = await deleteJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members/${adminId}`, ownerToken);
        console.log(`Status: ${kickAdminByOwner.status}`, kickAdminByOwner.data);
        if (kickAdminByOwner.status !== 200) throw new Error("Owner failed to remove Admin");
        console.log("✅ Owner successfully kicked Admin");

        // 16. Delete Workspace permissions: Admin trying to delete (Should fail)
        console.log("\n16. Admin trying to delete workspace (should fail)...");
        // Re-invite User B (Admin) to test it
        await postJSON(`${BASE_WORKSPACE_URL}/${workspaceId}/members`, {
            email: testAdmin.email,
            role: "ADMIN"
        }, ownerToken);
        const deleteWSAdmin = await deleteJSON(`${BASE_WORKSPACE_URL}/${workspaceId}`, adminToken);
        console.log(`Status: ${deleteWSAdmin.status}`, deleteWSAdmin.data);
        if (deleteWSAdmin.status !== 403) throw new Error("Admin was allowed to delete workspace!");
        console.log("✅ Correctly prevented Admin from deleting workspace");

        // 17. Delete Workspace as Owner (Should succeed)
        console.log("\n17. Owner deleting workspace (should succeed)...");
        const deleteWSOwner = await deleteJSON(`${BASE_WORKSPACE_URL}/${workspaceId}`, ownerToken);
        console.log(`Status: ${deleteWSOwner.status}`, deleteWSOwner.data);
        if (deleteWSOwner.status !== 200) throw new Error("Owner failed to delete workspace");
        console.log("✅ Workspace deleted successfully");

        // 18. Verify Workspace deletion
        console.log("\n18. Verifying workspace is no longer retrievable...");
        const getDeletedWS = await getJSON(`${BASE_WORKSPACE_URL}/${workspaceId}`, ownerToken);
        console.log(`Status: ${getDeletedWS.status}`, getDeletedWS.data);
        if (getDeletedWS.status !== 403 && getDeletedWS.status !== 404) {
            throw new Error("Deleted workspace is still retrievable");
        }
        console.log("✅ Workspace deletion verified successfully");

        console.log("\n✅ ALL WORKSPACE & MEMBER TESTS PASSED SUCCESSFULLY!");
    } catch (error) {
        console.error("\n❌ Test failed with error:", error.message);
        process.exit(1);
    }
}

runTests();
