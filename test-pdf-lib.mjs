import * as pdfParseModule from 'pdf-parse';
console.log("Keys:", Object.keys(pdfParseModule));
console.log("PDFParse class:", pdfParseModule.PDFParse);
if (pdfParseModule.PDFParse) {
  console.log("PDFParse methods:", Object.getOwnPropertyNames(pdfParseModule.PDFParse.prototype));
  console.log("PDFParse static methods:", Object.getOwnPropertyNames(pdfParseModule.PDFParse));
}
