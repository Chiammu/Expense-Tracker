import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function dumpPage4(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true, disableFontFace: true });
  const pdf = await loadingTask.promise;

  const page = await pdf.getPage(4);
  const content = await page.getTextContent();
  
  const items = content.items.map(item => ({
    str: item.str,
    y: Math.round(item.transform[5]),
    x: Math.round(item.transform[4])
  }));
  
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  let currentY = null;
  let currentLine = [];
  
  for (const item of items) {
    if (currentY === null || Math.abs(item.y - currentY) > 2) {
      if (currentLine.length > 0) lines.push(currentLine.join(' '));
      currentLine = [item.str];
      currentY = item.y;
    } else {
      currentLine.push(item.str);
    }
  }
  if (currentLine.length > 0) lines.push(currentLine.join(' '));
  
  fs.writeFileSync('page4_lines.txt', lines.join('\n'));
}

dumpPage4("C:\\Users\\Mohith Reddy\\Downloads\\Account_10 Dec 2025 - 10 Mar 2026_XX5075.pdf").catch(console.error);
