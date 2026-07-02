async function testUpload() {
  const userId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  
  // Create a minimal PDF buffer representation
  const pdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 21 >>\nstream\nBT /F1 12 Tf ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000216 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n288\n%%EOF'
  );
  
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  const form = new FormData();
  form.append("file", blob, "resume.pdf");
  form.append("userId", userId);

  try {
    const res = await fetch("http://127.0.0.1:4000/api/resume/parse", {
      method: "POST",
      body: form
    });
    
    console.log("Upload Status:", res.status);
    const data = await res.json();
    console.log("Upload Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Upload failed:", err.message);
  }
}

// Run after 2 seconds to ensure port 4002 server is active
setTimeout(testUpload, 2000);
