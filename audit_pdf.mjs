import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function auditPDF(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true, disableFontFace: true });
  const pdf = await loadingTask.promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const yMap = new Map();
    for (const item of content.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      if (!yMap.has(y)) yMap.set(y, []);
      yMap.get(y).push(item.str);
    }
    const sortedYs = Array.from(yMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      allLines.push(yMap.get(y).join(' ').trim());
    }
  }

  // Write all lines for manual inspection
  fs.writeFileSync('full_pdf_dump.txt', allLines.join('\n'));

  const KOTAK_RE = /^(\d+)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
  const allTransactions = [];

  allLines.forEach((line, i) => {
    const match = line.match(KOTAK_RE);
    if (match) {
      const id = match[1];
      const desc = match[3];
      const amount = match[4];
      const bal = match[5];
      allTransactions.push({ id, desc, amount, bal, lineIndex: i });
    }
  });

  console.log("Found Transactions:", allTransactions.length);
  
  // Look for gaps in IDs
  let expectedId = 1;
  const gaps = [];
  allTransactions.forEach(t => {
    const id = parseInt(t.id);
    if (id !== expectedId) {
      gaps.push({ expected: expectedId, got: id });
    }
    expectedId = id + 1;
  });

  console.log("ID Gaps:", gaps);
  
  // Log the last few to see the max ID
  if (allTransactions.length > 0) {
    const last = allTransactions[allTransactions.length - 1];
    console.log("Last Transaction ID:", last.id);
  }
}

auditPDF("C:\\Users\\Mohith Reddy\\Downloads\\Account_10 Dec 2025 - 10 Mar 2026_XX5075.pdf").catch(console.error);
