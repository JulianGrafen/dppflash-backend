const fs = require('fs');
const pdfParse = require('pdf-parse/lib/pdf-parse');

(async () => {
  const buffer = fs.readFileSync('/Users/julian/Downloads/Zertifikat-Mock (1).pdf');
  try {
    const data = await pdfParse(buffer);
    console.log('SUCCESS! Text length:', data.text?.length);
    console.log('Pages:', data.numpages);
    console.log('First 500 chars:', data.text?.substring(0, 500));
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
