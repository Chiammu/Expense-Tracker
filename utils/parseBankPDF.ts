import * as pdfjsLib from 'pdfjs-dist';

const pdfWorker = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  type: 'debit' | 'credit';
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function normalizeDate(raw: string, defaultYear: string): string | null {
  if (!raw) return null;
  const str = raw.trim();

  // DD MMM YYYY / DD-MMM-YYYY / DD/MMM/YY
  const alphaMatch = str.match(/^(\d{1,2})[\s/\-]*([A-Za-z]{3})[\s/\-]*(\d{2,4})$/);
  if (alphaMatch) {
    const day = alphaMatch[1].padStart(2, '0');
    const mon = MONTHS[alphaMatch[2].toLowerCase()];
    let year = alphaMatch[3];
    if (year.length === 2) year = '20' + year;
    if (mon) return `${year}-${mon}-${day}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const numMatch = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const month = numMatch[2].padStart(2, '0');
    let year = numMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  // DD-MMM (Missing Year, e.g., 05-Jan)
  const missingYearMatch = str.match(/^(\d{1,2})[\s/\-]*([A-Za-z]{3})$/);
  if (missingYearMatch) {
    const day = missingYearMatch[1].padStart(2, '0');
    const mon = MONTHS[missingYearMatch[2].toLowerCase()];
    if (mon) return `${defaultYear}-${mon}-${day}`;
  }

  return null;
}

function cleanAmount(s: string): number {
  return Math.abs(parseFloat(s.replace(/,/g, '').trim())) || 0;
}

function cleanDescription(desc: string): string {
  return desc
    .replace(/\(Value Date:.*?\)/i, '') // Remove "(Value Date: 09-02-2026)" noise
    .replace(/\s+/g, ' ')               // Collapse multiple spaces
    .trim();
}

const SKIP_RE = /opening balance|closing balance|brought forward|carried forward|statement summary|statement of account|page\s+\d+|total\b|generated on|branch\s*:|ifsc|account\s*(no|number)|customer\s*id|date\s+(of\s+)?txn|value\s+date|chq\s*\.?\s*no|deposit\s+withdrawal|address\s*:|nominee|email\s*:|phone\s*:|micr|swift|routing|iban|page\s+\d+\s+of/i;

// Patterns for SBI, HDFC, Kotak
const TRANSACTION_LINE_RE = [
  // Generic 3-amount: Date, Desc, Debit, Credit, Balance (SBI/HDFC style)
  /(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*$/,
  // Standard SBI: Date, Desc, Ref, Debit, Credit, Balance
  /(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})\s+(.+?)\s+\S+\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*$/,
  // Kotak Style: # Date Desc Ref Withdrawal/Deposit Balance
  // Handle optional minus in Balance
  /(\d+)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/,
  // HDFC simplified: Date, Desc, Withdraw, Deposit, Balance
  /(\d{1,2}[/\-]\d{1,2}[/\-]\d{2})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/,
  // Single amount with Dr/Cr indicator (Common for Savings & CC)
  // Handles Forex inline numbers gracefully by forcing the amount to be right next to Cr/Dr at the end
  /(\d{1,2}[/\-][\w]{2,3}[/\-]\d{2,4})\s+(.+?)\s+([\d,]+\.?\d*)\s*(Cr|Dr)\s*$/i,
  
  // -- Credit Card Specific Patterns --
  // Date, Desc, Amount (No running balance, typical SBI/ICICI CC)
  // Anchored to end to avoid matching inline forex multipliers as final amounts
  /(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}(?:\s+\d{1,2}:\d{2}:\d{2})?)\s+(.+?)\s+([\d,]+\.\d{2})\s*$/,
  // Date, Ref No, Desc, Amount (HDFC CC style)
  /(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\s+\S+\s+(.+?)\s+([\d,]+\.\d{2})\s*$/
];

const OPENING_BAL_RE = /-   -   Opening Balance\s+-\s+-\s+-\s+(-?[\d,]+\.\d{2})/i;

function parseTransactionLines(lines: string[], defaultYear: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  let lastBalance: number | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Try to catch initial balance for Kotak
    const obMatch = line.match(OPENING_BAL_RE);
    if (obMatch) {
      const bStr = obMatch[1].replace(/,/g, '');
      lastBalance = parseFloat(bStr);
      continue;
    }

    if (SKIP_RE.test(line)) continue;

    for (const re of TRANSACTION_LINE_RE) {
      const m = line.match(re);
      if (m) {
        // Distinguish based on group count and content
        let dateStr = "";
        let desc = "";
        let amount = 0;
        let type: 'debit' | 'credit' = 'debit';
        let currentBalance: number | null = null;

        if (m.length === 6 && /^\d+$/.test(m[1])) {
          // Kotak specifically (# Date Desc Amount Balance)
          dateStr = m[2];
          desc = cleanDescription(m[3]);
          amount = cleanAmount(m[4]);
          
          const balStr = m[5].replace(/,/g, '');
          currentBalance = parseFloat(balStr);

          if (lastBalance !== null && !isNaN(currentBalance)) {
            // Use balance diff for precise detection
            // We round to avoid float precision issues
            const diff = Math.round((currentBalance - lastBalance) * 100) / 100;
            type = (diff > 0) ? 'credit' : 'debit';
          } else {
            // Fallback for first row if Opening Balance line missed
            const lower = desc.toLowerCase();
            if (lower.includes('trf from') || lower.includes('proceeds') || lower.includes('int.pd') || 
                lower.includes('credit') || lower.includes('deposit') || lower.includes('refund') || lower.includes('sweep trf from')) {
              type = 'credit';
            }
          }
          lastBalance = currentBalance;
        } else if (m.length === 6) {
          // Standard SBI/HDFC (Date Desc Debit Credit Balance)
          dateStr = m[1];
          desc = cleanDescription(m[2]);
          const debit = cleanAmount(m[3]);
          const credit = cleanAmount(m[4]);
          if (debit > 0) {
            amount = debit;
            type = 'debit';
          } else if (credit > 0) {
            amount = credit;
            type = 'credit';
          }
        } else if (m.length === 5 && (m[4].toLowerCase() === 'cr' || m[4].toLowerCase() === 'dr')) {
          // Dr/Cr pattern
          dateStr = m[1];
          desc = cleanDescription(m[2]);
          amount = cleanAmount(m[3]);
          type = m[4].toLowerCase().includes('cr') ? 'credit' : 'debit';
        } else if (m.length === 5) {
          // HDFC CC style (Date, Ref, Desc, Amount)
          dateStr = m[1];
          desc = cleanDescription(m[2]);
          amount = cleanAmount(m[3]);
          // Standard CC transactions are debits unless marked otherwise (e.g. PAYMENT THANK YOU)
          const lowerDesc = desc.toLowerCase();
          type = (lowerDesc.includes('payment') || lowerDesc.includes('thank you') || lowerDesc.includes('refund') || lowerDesc.includes('reversal')) ? 'credit' : 'debit';
        } else if (m.length === 4) {
          // SBI/ICICI CC style (Date, Desc, Amount)
          dateStr = m[1];
          desc = cleanDescription(m[2]);
          amount = cleanAmount(m[3]);
          const lowerDesc = desc.toLowerCase();
          type = (lowerDesc.includes('payment') || lowerDesc.includes('thank you') || lowerDesc.includes('refund') || lowerDesc.includes('reversal')) ? 'credit' : 'debit';
        }

        const date = normalizeDate(dateStr, defaultYear);
        if (date && amount > 0) {
          transactions.push({ date, amount, description: desc, type });
          break;
        }
      }
    }
  }

  return transactions;
}

export async function parseBankPDF(arrayBuffer: ArrayBuffer, password?: string): Promise<ParsedTransaction[]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), password }).promise;
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    
    // Group text items by their vertical position (Y coordinate)
    const yMap = new Map<number, string[]>();
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round((item as any).transform[5]);
      if (!yMap.has(y)) yMap.set(y, []);
      yMap.get(y)!.push((item as { str: string }).str);
    }

    // Sort by Y coordinate descending (top to bottom)
    const sortedYs = Array.from(yMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      allLines.push(yMap.get(y)!.join(' ').trim());
    }
  }

  // Try to find a year from statement headers (usually in top 50 lines)
  let statementYear = new Date().getFullYear().toString();
  for (let i = 0; i < Math.min(allLines.length, 50); i++) {
    const m = allLines[i].match(/\b(20\d{2})\b/);
    if (m) {
      statementYear = m[1];
      break;
    }
  }

  return parseTransactionLines(allLines, statementYear);
}

/** Internal helper for testing */
export function _parseTransactionLines(lines: string[], defaultYear: string = "2024"): ParsedTransaction[] {
  return parseTransactionLines(lines, defaultYear);
}
