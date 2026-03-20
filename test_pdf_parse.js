const fs = require('fs');
const { PDFParse } = require('pdf-parse');

(async () => {
  const buffer = fs.readFileSync('/Users/julian/Downloads/Zertifikat-Mock (1).pdf');
  try {
    const parser = new PDFParse();
    const data = await parser.parseBuffer(buffer);
    console.log('SUCCESS! Text length:', data.text?.length);
    console.log('First 500 chars:', data.text?.substring(0, 500));
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
