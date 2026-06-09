const BASE_URL = 'http://localhost:5000/api/v1/auth';

const testUser = {
  name: "Test User",
  email: `test_${Date.now()}@example.com`,
  password: "password123"
};

async function runTests() {
  console.log("=== Testing Authentication Endpoints ===");

  // 1. Test Register
  console.log("\n1. Registering new user...");
  try {
    const registerResponse = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const registerData = await registerResponse.json();
    console.log(`Status: ${registerResponse.status}`);
    console.log("Response:", registerData);

    if (registerResponse.status !== 201) {
      throw new Error("Registration failed");
    }

    const token = registerData.token;

    // 2. Test Login
    console.log("\n2. Logging in...");
    const loginResponse = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    const loginData = await loginResponse.json();
    console.log(`Status: ${loginResponse.status}`);
    console.log("Response:", loginData);

    if (loginResponse.status !== 200) {
      throw new Error("Login failed");
    }

    // 3. Test Private Route (/me)
    console.log("\n3. Fetching user profile (/me)...");
    const meResponse = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const meData = await meResponse.json();
    console.log(`Status: ${meResponse.status}`);
    console.log("Response:", meData);

    if (meResponse.status === 200) {
      console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY!");
    } else {
      console.log("\n❌ Private profile check failed.");
    }
  } catch (error) {
    console.error("\n❌ Test failed with error:", error.message);
  }
}

runTests();
