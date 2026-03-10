import Papa from 'papaparse';

export interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  type: 'debit' | 'credit';
}

function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const str = dateStr.trim();

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];

    // If year is first (YYYY-MM-DD or YYYY/MM/DD)
    if (year.length === 2 && parts[0].length === 4) {
      year = parts[0];
      day = parts[2];
    }

    // Normalize to 4 digit year
    if (year.length === 2) year = '20' + year;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Handle DD MMM YYYY (e.g., 15 Jan 2023)
  const regexAlphaMonth = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/;
  const match = str.match(regexAlphaMonth);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthStr = match[2].toLowerCase();
    const year = match[3];
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const month = months[monthStr];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

export function parseBankCSV(csvString: string): ParsedTransaction[] {
  const parsed = Papa.parse(csvString, {
    header: false,
    skipEmptyLines: true,
  });

  const rows = parsed.data as string[][];
  const transactions: ParsedTransaction[] = [];

  let headerRowIndex = -1;
  let dateCol = -1;
  let descCol = -1;
  let debitCol = -1;
  let creditCol = -1;
  let amountCol = -1;
  let drCrCol = -1;

  // Detect header row by finding 'date' and ('description' or 'narration' or 'particulars')
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i].map(c => typeof c === 'string' ? c.toLowerCase().trim() : '');
    
    dateCol = row.findIndex(c => c.includes('date'));
    descCol = row.findIndex(c => c.includes('description') || c.includes('narration') || c.includes('particulars'));
    debitCol = row.findIndex(c => c === 'debit' || c === 'withdrawal' || c.includes('withdrawal amount'));
    creditCol = row.findIndex(c => c === 'credit' || c === 'deposit' || c.includes('deposit amount'));
    
    amountCol = row.findIndex(c => c === 'amount' || c.includes('amount(inr)') || c.includes('amount (inr)'));
    drCrCol = row.findIndex(c => c.includes('dr/cr') || c === 'cr/dr' || c === 'type' || c === 'dr');

    // Axis Bank specific override
    if (drCrCol === -1) {
       debitCol = Math.max(debitCol, row.findIndex(c => c === 'dr'));
       creditCol = Math.max(creditCol, row.findIndex(c => c === 'cr'));
    }

    if (dateCol !== -1 && descCol !== -1) {
      headerRowIndex = i;
      break;
    }
  }

  // If we couldn't confidently find a header, try to blindly parse row by row if possible
  const startIndex = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    // Use mapped columns; if no header found, guess common spots (0=date, 1=desc, 2=debit/credit or amount)
    let dateStr = row[dateCol >= 0 ? dateCol : 0];
    let desc = row[descCol >= 0 ? descCol : 1] || '';
    
    let debitStr = debitCol >= 0 ? row[debitCol] : '';
    let creditStr = creditCol >= 0 ? row[creditCol] : '';
    let amountStr = amountCol >= 0 ? row[amountCol] : '';
    let typeStr = drCrCol >= 0 ? row[drCrCol] : '';

    const lowerDesc = desc.toLowerCase();
    // Skip opening/closing balances and empty lines
    if (!dateStr || lowerDesc.includes('opening balance') || lowerDesc.includes('closing balance') || lowerDesc.includes('brought forward') || lowerDesc.includes('carried forward')) {
      continue;
    }

    const cleanNum = (str: string) => parseFloat(str?.replace(/,/g, '').trim()) || 0;

    let debit = cleanNum(debitStr);
    let credit = cleanNum(creditStr);
    let amount = cleanNum(amountStr);

    let type: 'debit' | 'credit' | null = null;
    let finalAmount = 0;

    if (debit > 0) {
      type = 'debit';
      finalAmount = debit;
    } else if (credit > 0) {
      type = 'credit';
      finalAmount = credit;
    } else if (amount > 0) {
      finalAmount = Math.abs(amount);
      if (typeStr && typeStr.toLowerCase().includes('dr')) {
        type = 'debit';
      } else if (typeStr && typeStr.toLowerCase().includes('cr')) {
        type = 'credit';
      } else if (amountStr.includes('-')) {
        type = 'debit'; // Often exported with minus for debit
      } else {
        type = 'debit'; // Ultimate fallback for unknowns
      }
    }

    if (!type || finalAmount <= 0) continue;

    const normalizedDate = normalizeDate(dateStr);
    if (!normalizedDate) continue;

    transactions.push({
      date: normalizedDate,
      amount: finalAmount,
      description: desc.trim(),
      type
    });
  }

  return transactions;
}
