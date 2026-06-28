async function testAgent() {
  const userId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // test UUID with mock profile
  try {
    const res = await fetch("http://127.0.0.1:4002/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        message: "hi"
      })
    });
    
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

// Wait 4 seconds then run to allow NestJS server to boot fully
setTimeout(testAgent, 4000);
