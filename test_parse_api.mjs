async function run() {
  const fileContent = "Ruturaj Challawar resume. Skills: Node.js, AWS, PostgreSQL, React. Experience: Backend Engineer at Stripe for 2 years.";
  const blob = new Blob([fileContent], { type: "text/plain" });
  
  const formData = new FormData();
  formData.append("file", blob, "resume.pdf"); // mock it as a PDF name
  formData.append("userId", "8eacbdf4-62b4-4d8e-8906-286e3e1faee7");

  console.log("Sending POST to http://localhost:4000/api/resume/parse...");
  const start = Date.now();
  try {
    const res = await fetch("http://localhost:4000/api/resume/parse", {
      method: "POST",
      body: formData
    });
    console.log("Status:", res.status, "in", Date.now() - start, "ms");
    const data = await res.json();
    console.log("Response Body:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("API Call failed:", err.message);
  }
}

run();
