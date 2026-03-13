import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function finalAudit(filePath) {
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

  // Lenient regex (no anchors)
  const KOTAK_RE = /(\d+)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})/;
  const OPENING_BAL_RE = /-   -   Opening Balance\s+-\s+-\s+-\s+(-?[\d,]+\.\d{2})/i;
  const DATE_RE = /\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/;

  const transactions = [];
  const missedDates = [];
  let lastBalance = null;

  for (const line of allLines) {
    const obMatch = line.match(OPENING_BAL_RE);
    if (obMatch) {
      lastBalance = parseFloat(obMatch[1].replace(/,/g, ''));
      continue;
    }

    const m = line.match(KOTAK_RE);
    if (m) {
       const currentBal = parseFloat(m[5].replace(/,/g, ''));
       let type = 'debit';
       if (lastBalance !== null) {
          const diff = Math.round((currentBal - lastBalance) * 100) / 100;
          type = (diff > 0) ? 'credit' : 'debit';
       }
       transactions.push({ id: m[1], date: m[2], desc: m[3], amount: m[4], type, bal: m[5] });
       lastBalance = currentBal;
    } else if (line.match(DATE_RE) && !line.includes('Statement Generated') && !line.includes('Account Statement')) {
       missedDates.push(line);
    }
  }

  console.log("FINAL AUDIT RESULT (LENIENT):");
  console.log("Total Transactions Found:", transactions.length);
  console.log("Debits:", transactions.filter(t => t.type === 'debit').length);
  console.log("Credits:", transactions.filter(t => t.type === 'credit').length);
  
  if (missedDates.length > 0) {
    console.log("\nMISSED DATE LINES (" + missedDates.length + "):");
    missedDates.forEach(d => console.log(d));
  }

  // Check last ID
  if (transactions.length > 0) console.log("Last ID:", transactions[transactions.length-1].id);
}

finalAudit("C:\\Users\\Mohith Reddy\\Downloads\\Account_10 Dec 2025 - 10 Mar 2026_XX5075.pdf").catch(console.error);
