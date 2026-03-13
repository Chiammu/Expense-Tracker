import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function analyzePDF(filePath) {
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

  const KOTAK_RE = /^(\d+)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
  const credits = [];
  const debits = [];
  const missed = [];

  allLines.forEach((line, i) => {
    const match = line.match(KOTAK_RE);
    if (match) {
      const desc = match[3].toLowerCase();
      const isCredit = (desc.includes('trf from') || desc.includes('proceeds') || desc.includes('int.pd') || 
                        desc.includes('credit') || desc.includes('deposit') || desc.includes('refund') ||
                        desc.includes('sweep trf from'));
      if (isCredit) credits.push(line);
      else debits.push(line);
    } else if (/^\d+\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(line)) {
      missed.push(line);
    }
  });

  console.log("Total Lines:", allLines.length);
  console.log("Kotak Matches (Debits):", debits.length);
  console.log("Kotak Matches (Credits):", credits.length);
  console.log("Total Matches:", debits.length + credits.length);
  console.log("Potentially Missed (Started with Index/Date but No Regex Match):", missed.length);
  
  if (missed.length > 0) {
    console.log("\nMISSED LINES:");
    missed.forEach(m => console.log(m));
  }
}

analyzePDF("C:\\Users\\Mohith Reddy\\Downloads\\Account_10 Dec 2025 - 10 Mar 2026_XX5075.pdf").catch(console.error);
