import React, { useMemo, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker?url';
import { AppState, Expense, ParsedTransaction } from '../types';
import { parseStatementText, suggestTransactionCategories } from '../services/geminiService';

GlobalWorkerOptions.workerSrc = pdfWorker;

type ImportMethod = 'pdf' | 'csv' | 'upi';

interface StatementImporterProps {
  state: AppState;
  addExpense: (expense: Omit<Expense, 'id' | 'updatedAt'>) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface ReviewTransaction extends ParsedTransaction {
  id: string;
  category: string;
  person: 'Person1' | 'Person2' | 'Both';
  import: boolean;
  isDuplicate: boolean;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Groceries: ['grocery', 'supermarket', 'dmart', 'big bazaar', 'bigbazaar', 'more', 'spencer', 'mart', 'kirana'],
  Rent: ['rent', 'lease'],
  Bills: ['electricity', 'power', 'gas', 'water', 'bill', 'broadband', 'fiber', 'recharge', 'mobile', 'dth'],
  EMIs: ['emi', 'loan', 'finance', 'nbfc'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'shopping', 'store', 'mall'],
  Travel: ['uber', 'ola', 'rapido', 'irctc', 'makemytrip', 'ixigo', 'flight', 'bus', 'metro', 'petrol', 'diesel', 'fuel'],
  Food: ['swiggy', 'zomato', 'restaurant', 'cafe', 'food', 'pizza', 'burger', 'dining'],
  Entertainment: ['netflix', 'prime', 'hotstar', 'movie', 'cinema', 'spotify', 'bookmyshow', 'game'],
  Medical: ['pharmacy', 'apollo', 'clinic', 'hospital', 'medic', 'doctor'],
  Education: ['course', 'udemy', 'coursera', 'school', 'college', 'exam', 'tuition'],
  Investments: ['sip', 'mutual', 'fund', 'stock', 'zerodha', 'groww', 'upstox', 'investment', 'lic'],
  Others: []
};

const DATE_HEADERS = ['txn date', 'transaction date', 'date', 'value date', 'posting date'];
const DESC_HEADERS = ['narration', 'description', 'transaction remarks', 'transaction details', 'remarks', 'details', 'particulars'];
const DEBIT_HEADERS = ['debit', 'withdrawal amt', 'withdrawal', 'amount debit', 'dr', 'paid out', 'debit amount'];
const CREDIT_HEADERS = ['credit', 'deposit amt', 'deposit', 'amount credit', 'cr', 'paid in', 'credit amount'];
const STATUS_HEADERS = ['status'];

const parseAmount = (value: string) => {
  const cleaned = value.replace(/[₹,]/g, '').replace(/\s/g, '').replace(/\(([^)]+)\)/, '-$1');
  const amount = parseFloat(cleaned);
  return Number.isNaN(amount) ? 0 : Math.abs(amount);
};

const normalizeDate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slashMatch = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return trimmed;
};

const parseCsvLine = (line: string) => {
  const regex = /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/g;
  return line.split(regex).map(cell => cell.replace(/^"|"$/g, '').trim());
};

const findHeaderIndex = (lines: string[]) => {
  for (let i = 0; i < Math.min(lines.length, 5); i += 1) {
    const cells = parseCsvLine(lines[i]).map(cell => cell.toLowerCase());
    const matches = [...DATE_HEADERS, ...DESC_HEADERS, ...DEBIT_HEADERS, ...CREDIT_HEADERS].filter(header =>
      cells.some(cell => cell.includes(header))
    );
    if (matches.length >= 2) {
      return { index: i, headers: cells };
    }
  }
  const first = parseCsvLine(lines[0]).map(cell => cell.toLowerCase());
  return { index: 0, headers: first };
};

const getHeaderIndex = (headers: string[], aliases: string[]) =>
  headers.findIndex((header) => aliases.some(alias => header.includes(alias)));

const detectCategory = (description: string, categories: string[]) => {
  const lower = description.toLowerCase();
  for (const category of categories) {
    const categoryLower = category.toLowerCase();
    const keywords = CATEGORY_KEYWORDS[category] || [];
    if (lower.includes(categoryLower)) {
      return category;
    }
    if (keywords.some(keyword => lower.includes(keyword))) {
      return category;
    }
  }
  return '';
};

const extractTextFromPdf = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as any[])
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    text += ` ${pageText}`;
  }
  return text.trim();
};

export const StatementImporter: React.FC<StatementImporterProps> = ({ state, addExpense, showToast }) => {
  const [importMethod, setImportMethod] = useState<ImportMethod>('pdf');
  const [transactions, setTransactions] = useState<ReviewTransaction[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const duplicateLookup = useMemo(() => {
    return new Set(state.expenses.map(exp => `${exp.date}-${exp.amount}`));
  }, [state.expenses]);

  const counts = useMemo(() => {
    const duplicates = transactions.filter(txn => txn.isDuplicate).length;
    return { total: transactions.length, duplicates };
  }, [transactions]);

  const enrichTransactions = async (parsed: ParsedTransaction[]) => {
    const categories = state.settings.customCategories;
    const fallbackCategory = categories.includes('Others') ? 'Others' : categories[0] || 'Others';
    const unmatched: { index: number; description: string }[] = [];

    const base = parsed.map((txn, index) => {
      const description = txn.description?.replace(/\s+/g, ' ').trim() || '';
      const suggested = detectCategory(description, categories);
      if (!suggested) {
        unmatched.push({ index, description });
      }
      const debitAmount = txn.debit || 0;
      return {
        id: crypto.randomUUID(),
        date: normalizeDate(txn.date),
        description,
        debit: debitAmount,
        credit: txn.credit || 0,
        suggestedCategory: suggested || undefined,
        category: suggested || fallbackCategory,
        person: 'Person1',
        import: debitAmount > 0,
        isDuplicate: duplicateLookup.has(`${normalizeDate(txn.date)}-${debitAmount}`)
      } as ReviewTransaction;
    });

    if (unmatched.length > 0) {
      const suggestions = await suggestTransactionCategories(
        unmatched.map(entry => entry.description),
        categories
      );
      unmatched.forEach((entry, idx) => {
        const suggestion = suggestions[idx];
        const category = suggestion && categories.includes(suggestion) ? suggestion : fallbackCategory;
        base[entry.index] = { ...base[entry.index], category, suggestedCategory: category };
      });
    }

    return base.filter(txn => txn.debit > 0);
  };

  const parseCsvTransactions = (text: string, method: ImportMethod) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];

    const { index, headers } = findHeaderIndex(lines);
    const dateIndex = getHeaderIndex(headers, DATE_HEADERS);
    const descIndex = getHeaderIndex(headers, DESC_HEADERS);
    const debitIndex = getHeaderIndex(headers, DEBIT_HEADERS);
    const creditIndex = getHeaderIndex(headers, CREDIT_HEADERS);
    const statusIndex = getHeaderIndex(headers, STATUS_HEADERS);

    if (dateIndex === -1 || descIndex === -1) return [];

    return lines.slice(index + 1).map((line) => {
      const cells = parseCsvLine(line);
      const status = statusIndex >= 0 ? (cells[statusIndex] || '').toLowerCase() : '';
      if (method === 'upi' && status && !status.includes('completed') && !status.includes('success')) {
        return null;
      }

      const debit = debitIndex >= 0 ? parseAmount(cells[debitIndex] || '') : 0;
      const credit = creditIndex >= 0 ? parseAmount(cells[creditIndex] || '') : 0;
      return {
        date: normalizeDate(cells[dateIndex] || ''),
        description: cells[descIndex] || '',
        debit,
        credit
      };
    }).filter((row): row is ParsedTransaction => Boolean(row));
  };

  const handleParsedTransactions = async (parsed: ParsedTransaction[]) => {
    if (!parsed.length) {
      showToast('No transactions found in the statement.', 'info');
      setTransactions([]);
      return;
    }
    const enriched = await enrichTransactions(parsed);
    if (!enriched.length) {
      showToast('No debit transactions found to import.', 'info');
      setTransactions([]);
      return;
    }
    setTransactions(enriched);
    showToast(`Loaded ${enriched.length} transactions`, 'success');
  };

  const handleFile = async (file: File) => {
    setIsParsing(true);
    try {
      if (importMethod === 'pdf') {
        const rawText = await extractTextFromPdf(file);
        const parsed = await parseStatementText(rawText, state.settings.customCategories);
        await handleParsedTransactions(parsed);
      } else {
        const text = await file.text();
        const parsed = parseCsvTransactions(text, importMethod);
        await handleParsedTransactions(parsed);
      }
    } catch (error: any) {
      console.error('Statement import error:', error);
      showToast(error.message || 'Failed to parse statement.', 'error');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleImportSelected = () => {
    const toImport = transactions.filter(txn => txn.import && !txn.isDuplicate);
    if (!toImport.length) {
      showToast('No transactions selected for import.', 'info');
      return;
    }

    toImport.forEach(txn => {
      addExpense({
        person: txn.person,
        date: txn.date,
        amount: txn.debit,
        category: txn.category || 'Others',
        paymentMode: importMethod === 'upi' ? 'UPI' : 'Netbanking',
        note: txn.description
      });
    });

    showToast(`Imported ${toImport.length} transactions`, 'success');
    setTransactions([]);
  };

  const updateTransaction = (id: string, updates: Partial<ReviewTransaction>) => {
    setTransactions(prev => prev.map(txn => (txn.id === id ? { ...txn, ...updates } : txn)));
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl p-4 shadow-sm border border-gray-200/60 dark:border-gray-800/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-text">Statement Importer</h2>
            <p className="text-sm text-text-light">Import PDF or CSV statements from Indian banks and UPI apps.</p>
          </div>
          <div className="flex gap-2">
            {(['pdf', 'csv', 'upi'] as ImportMethod[]).map(method => (
              <button
                key={method}
                onClick={() => setImportMethod(method)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${importMethod === method ? 'bg-primary text-white border-primary' : 'border-gray-200/60 dark:border-gray-800/60 text-text-light'}`}
              >
                {method === 'pdf' ? 'PDF' : method === 'csv' ? 'CSV' : 'UPI CSV'}
              </button>
            ))}
          </div>
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="mt-4 border-2 border-dashed border-primary/40 rounded-xl p-6 text-center bg-background/40"
        >
          <p className="text-sm text-text-light">Drag & drop your {importMethod.toUpperCase()} statement here</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
            disabled={isParsing}
          >
            {isParsing ? 'Processing...' : 'Select File'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={importMethod === 'pdf' ? '.pdf' : '.csv'}
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="mt-2 text-xs text-text-light">Supported: HDFC, ICICI, SBI, Axis, Kotak, PhonePe, GPay</p>
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="bg-surface rounded-2xl p-4 shadow-sm border border-gray-200/60 dark:border-gray-800/60 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-light">
              Found {counts.total} transactions, {counts.duplicates} duplicates detected
            </p>
            <button
              onClick={handleImportSelected}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
              disabled={transactions.filter(txn => txn.import && !txn.isDuplicate).length === 0}
            >
              Import Selected
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-text-light uppercase border-b border-gray-200/60 dark:border-gray-800/60">
                <tr>
                  <th className="py-2 text-left">Import</th>
                  <th className="py-2 text-left">Date</th>
                  <th className="py-2 text-left">Description</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2 text-left">Category</th>
                  <th className="py-2 text-left">Person</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/60 dark:divide-gray-800/60">
                {transactions.map((txn) => {
                  const amount = txn.debit > 0 ? txn.debit : txn.credit;
                  return (
                    <tr key={txn.id} className="align-top">
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={txn.import}
                          disabled={txn.isDuplicate}
                          onChange={(e) => updateTransaction(txn.id, { import: e.target.checked })}
                          className="h-4 w-4 text-primary border-gray-300 dark:border-gray-700 rounded"
                        />
                        {txn.isDuplicate && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5">
                            Already imported
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-text-light whitespace-nowrap">{txn.date}</td>
                      <td className="py-3 max-w-xs">
                        <p className="text-text font-medium">{txn.description || 'N/A'}</p>
                      </td>
                      <td className={`py-3 text-right font-semibold ${txn.debit > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        ₹{amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3">
                        <select
                          value={txn.category}
                          onChange={(e) => updateTransaction(txn.id, { category: e.target.value })}
                          className="w-full rounded-lg border border-gray-200/60 dark:border-gray-800/60 bg-background px-2 py-1 text-xs"
                        >
                          {state.settings.customCategories.map((category) => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3">
                        <select
                          value={txn.person}
                          onChange={(e) => updateTransaction(txn.id, { person: e.target.value as ReviewTransaction['person'] })}
                          className="w-full rounded-lg border border-gray-200/60 dark:border-gray-800/60 bg-background px-2 py-1 text-xs"
                        >
                          <option value="Person1">{state.settings.person1Name}</option>
                          <option value="Person2">{state.settings.person2Name}</option>
                          <option value="Both">Both</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
