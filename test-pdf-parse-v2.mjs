import { PDFParse } from 'pdf-parse';

async function testParse() {
  const minimalPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 21 >>\nstream\nBT /F1 12 Tf ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000216 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n288\n%%EOF'
  );
  
  // Pass the pdf data in the constructor options
  const parser = new PDFParse({ data: minimalPdf });
  console.log("Instantiated PDFParse successfully");
  
  try {
    const textResult = await parser.getText();
    console.log("Text result object:", textResult);
    console.log("Extracted Text:", textResult.text);
  } catch (err) {
    console.error("Load/Parse failed:", err.message);
  } finally {
    parser.destroy();
  }
}

testParse();
