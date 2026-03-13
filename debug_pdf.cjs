const fs = require('fs');
const path = require('path');
// Use the local module path
const pdfjsLib = require('./node_modules/pdfjs-dist/legacy/build/pdf.js');

async function extractText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    
    // Group text items by their vertical position (Y coordinate)
    const yMap = new Map();
    for (const item of content.items) {
      if (!item.str) continue;
      // transform[5] is the Y coordinate
      const y = Math.round(item.transform[5]);
      if (!yMap.has(y)) yMap.set(y, []);
      yMap.get(y).push(item.str);
    }

    // Sort by Y coordinate descending (top to bottom)
    const sortedYs = Array.from(yMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      allLines.push(yMap.get(y).join(' ').trim());
    }
  }
  return allLines;
}

const targetPath = "C:\\Users\\Mohith Reddy\\Downloads\\Account_10 Dec 2025 - 10 Mar 2026_XX5075.pdf";

extractText(targetPath)
  .then(lines => {
    console.log("SUCCESS: Extracted " + lines.length + " lines.");
    // Log the first 100 lines to see structure/headers
    lines.slice(0, 100).forEach((line, i) => {
      console.log(`[${i}] ${line}`);
    });
    fs.writeFileSync('pdf_debug_output.txt', lines.join('\n'));
  })
  .catch(err => {
    console.error("FAILED to parse PDF:");
    console.error(err);
  });
