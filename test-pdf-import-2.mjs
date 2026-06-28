import * as pdfParseNamespace from 'pdf-parse';

console.log("pdfParseNamespace type:", typeof pdfParseNamespace);
console.log("pdfParseNamespace keys:", Object.keys(pdfParseNamespace));
try {
  // Call it directly
  pdfParseNamespace(Buffer.from([]));
} catch (err) {
  console.error("Direct call failed:", err.message);
}

try {
  // Call default
  const pdfParse = (pdfParseNamespace.default || pdfParseNamespace);
  console.log("Resolved pdfParse type:", typeof pdfParse);
} catch (err) {
  console.error("Default resolve failed:", err.message);
}
