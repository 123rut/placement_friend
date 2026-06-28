async function testTwoTurnAgent() {
  const userId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // sample UUID
  try {
    // 1. First request (creates conversation)
    console.log("Sending first message...");
    let res = await fetch("http://127.0.0.1:4000/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        message: "hi"
      })
    });
    
    let data = await res.json();
    console.log("First Response:", data.reply);
    const convId = data.conversationId;
    console.log("Conv ID:", convId);

    // 2. Second request (uses existing conversation)
    console.log("\nSending second message...");
    res = await fetch("http://127.0.0.1:4000/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        message: "any new jobs?",
        conversationId: convId
      })
    });
    
    console.log("Second status:", res.status);
    data = await res.json();
    console.log("Second Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Two-turn test failed:", err);
  }
}

testTwoTurnAgent();
