const fs = require('fs');
const pdfParse = require('pdf-parse');

(async () => {
  const pdfPath = '/Users/julian/Downloads/Zertifikat-Mock.pdf';
  const fileBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(fileBuffer);
  
  console.log("=== ROHTEXT AUS PDF ===\n");
  console.log(data.text);
  console.log("\n=== ANALYSE ===");
  console.log(`Seiten: ${data.numpages}`);
  console.log(`Zeichen: ${data.text.length}`);
})();
