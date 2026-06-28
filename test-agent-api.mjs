async function testAgent() {
  const userId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // valid student UUID
  try {
    console.log("Sending message to agent chat...");
    const start = Date.now();
    const res = await fetch("http://127.0.0.1:4000/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        message: "what are my top matches?"
      })
    });
    
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response time:", (Date.now() - start) / 1000, "seconds");
    console.log("Response data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testAgent();
