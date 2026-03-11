import React, { useState, useCallback, useMemo } from 'react';
import { Expense, CreditCard, DEFAULT_CATEGORIES } from '../types';
import { parseBankCSV, ParsedTransaction as CSVTransaction } from '../utils/parseBankCSV';
import { parseBankPDF, ParsedTransaction as PDFTransaction } from '../utils/parseBankPDF';
import { detectCategory, cleanMerchantName, smartCategorize } from '../utils/categoryDetect';
import { CustomSelect } from './CustomSelect';
import { CustomDatePicker } from './CustomDatePicker';

export interface BankImportProps {
  existingExpenses: Expense[];
  onImport: (expenses: Expense[]) => void;
  person1Name: string;
  person2Name: string;
  creditCards?: CreditCard[];
  updateCreditCards?: (cards: CreditCard[]) => void;
}

interface PreviewRow {
  id: string;
  include: boolean;
  isDuplicate: boolean;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  category: string;
  person: string;
}

const BankImportUI: React.FC<BankImportProps> = ({
  existingExpenses,
  onImport,
  person1Name,
  person2Name,
  creditCards,
  updateCreditCards,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Advanced feature states
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [bulkCategory, setBulkCategory] = useState<string>('');

  // Manual Column Mapping States
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [rawCsvText, setRawCsvText] = useState('');
  const [csvColMap, setCsvColMap] = useState({ date: 0, desc: 1, amount: 2, credit: -1 });

  const categoryOptions = useMemo(
    () => DEFAULT_CATEGORIES.map(cat => ({ label: cat, value: cat })),
    []
  );
  const personOptions = useMemo(
    () => ([
      { label: person1Name, value: person1Name },
      { label: person2Name, value: person2Name }
    ]),
    [person1Name, person2Name]
  );

  const filteredRows = previewRows.filter(row => {
    if (startDate && row.date < startDate) return false;
    if (endDate && row.date > endDate) return false;
    return true;
  });

  const handleBulkCategoryApply = () => {
    if (!bulkCategory) return;
    setPreviewRows(prev => prev.map(row => {
      // Only apply to rows currently visible in the filter and selected
      if (row.include && filteredRows.find(fr => fr.id === row.id)) {
        return { ...row, category: bulkCategory };
      }
      return row;
    }));
    setBulkCategory('');
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File, password?: string) => {
    console.log("Processing file:", file.name, file.size, file.type);
    setIsLoading(true);
    setError(null);
    try {
      let parsedTransactions: (CSVTransaction | PDFTransaction)[] = [];

      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        setRawCsvText(text); // Store for potential manual mapping
        try {
          parsedTransactions = parseBankCSV(text);
        } catch (e: any) {
          if (e.message === 'NO_HEADERS_FOUND') {
            setShowColumnMapper(true);
            setPendingFile(file);
            setError('Could not automatically detect columns. Please map them manually.');
            return;
          }
          throw e;
        }
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        console.log("PDF ArrayBuffer ready, length:", arrayBuffer.byteLength);
        parsedTransactions = await parseBankPDF(arrayBuffer, password);
      } else {
        throw new Error("Unsupported file type. Please upload a .csv or .pdf file.");
      }

      console.log(`Parsed ${parsedTransactions.length} total transactions (${parsedTransactions.filter(t => t.type === 'debit').length} debits, ${parsedTransactions.filter(t => t.type === 'credit').length} credits)`);

      // Process all transactions (show credits and check them by default)
      const newRows: PreviewRow[] = parsedTransactions.map((t, index) => {
        const isDuplicate = existingExpenses.some(
          (e) => e.date === t.date && e.amount === t.amount
        );

        const cleanedDesc = cleanMerchantName(t.description);

        return {
          id: `row-${index}-${Date.now()}`,
          include: !isDuplicate, // Check everything by default (debits and credits)
          isDuplicate,
          date: t.date,
          description: cleanedDesc,
          amount: t.amount,
          category: smartCategorize(cleanedDesc, t.amount),
          person: person1Name,
        };
      });

      setPreviewRows(newRows);
    } catch (err: any) {
      console.error(err);
      if (err.name === 'PasswordException' || err.message?.toLowerCase().includes('password')) {
        setRequiresPassword(true);
        setPendingFile(file);
        setError('This PDF is password protected. Please enter the password.');
        return;
      }
      setError(err.message || 'Error parsing file.');
    } finally {
      setIsLoading(false);
      setIsDragging(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [existingExpenses, person1Name]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // reset input
    e.target.value = '';
  };

  const applyManualMapping = () => {
    setError(null);
    try {
      const parsedTransactions = parseBankCSV(rawCsvText, {
        dateCol: csvColMap.date,
        descCol: csvColMap.desc,
        amountCol: csvColMap.amount >= 0 ? csvColMap.amount : undefined,
        debitCol: csvColMap.amount >= 0 ? undefined : csvColMap.amount, // If they map debit/credit specifically, they would need separate dropdowns. For simplicity we assume a single amount column or they map the debit col here
      });
      // We process the exact same way as the success block in processFile
      const newRows: PreviewRow[] = parsedTransactions.map((t, index) => {
        const isDuplicate = existingExpenses.some((e) => e.date === t.date && e.amount === t.amount);
        const cleanedDesc = cleanMerchantName(t.description);
        return {
          id: `row-${index}-${Date.now()}`,
          include: !isDuplicate,
          isDuplicate,
          date: t.date,
          description: cleanedDesc,
          amount: t.amount,
          category: smartCategorize(cleanedDesc, t.amount),
          person: person1Name,
        };
      });
      setPreviewRows(newRows);
      setShowColumnMapper(false);
      setPendingFile(null);
    } catch (err: any) {
      setError("Failed to map columns: " + err.message);
    }
  };

  const handleRowChange = (id: string, field: keyof PreviewRow, value: any) => {
    setPreviewRows(prev => prev.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const handleImportSelected = () => {
    const selectedRows = filteredRows.filter(r => r.include);
    if (selectedRows.length === 0) return;

    // Check for internal duplicates (same date and amount within the selection)
    const seen = new Set<string>();
    let hasInternalDuplicate = false;
    let hasExistingDuplicate = false;

    for (const row of selectedRows) {
      if (row.isDuplicate) {
        hasExistingDuplicate = true;
      }
      const key = `${row.date}-${row.amount}`;
      if (seen.has(key)) {
        hasInternalDuplicate = true;
      }
      seen.add(key);
    }

    if (hasExistingDuplicate || hasInternalDuplicate) {
      let msg = "You have selected transactions that might be duplicates.\n";
      if (hasExistingDuplicate) msg += "- Some selected transactions already match existing expenses.\n";
      if (hasInternalDuplicate) msg += "- Some selected transactions have the same date and amount within this import.\n";
      msg += "\nAre you sure you want to import them anyway?";
      
      if (!window.confirm(msg)) {
        return; // User cancelled
      }
    }

    // --- Phase 4 Logs: Subscription Detection & Refund Matching ---
    const finalRowsToImport: PreviewRow[] = [];
    const skippedRows = new Set<string>();

    // 1. Refund Matching
    const refunds = selectedRows.filter(r => 
      r.amount > 0 && 
      (r.description.toLowerCase().includes('refund') || r.description.toLowerCase().includes('reversal')) &&
      r.category !== 'EMIs' // ignore EMI reversals just in case
    );

    for (const refund of refunds) {
      // Find a matching debit in the recent past (since these are all mixed in the import)
      // Note: In a real system you'd also check against `existingExpenses`, but matching within the import is safest for now
      const refundDate = new Date(refund.date).getTime();
      
      const matchingDebitIndex = selectedRows.findIndex(r => 
        r.id !== refund.id && 
        !skippedRows.has(r.id) &&
        r.amount === refund.amount && // exact same amount
        r.category !== 'Investments' && // debits only (in our system all non-investments are typically debits unless we strictly enforce it, but amount match is highly specific)
        (refundDate - new Date(r.date).getTime()) >= 0 && // debit happened BEFORE refund
        (refundDate - new Date(r.date).getTime()) <= 14 * 24 * 60 * 60 * 1000 // within 14 days
      );

      if (matchingDebitIndex !== -1) {
        const matchingDebit = selectedRows[matchingDebitIndex];
        if (window.confirm(`Found a Refund/Reversal of ₹${refund.amount} for "${refund.description}".\n\nIt matches a previous expense: "${matchingDebit.description}" on ${matchingDebit.date}.\n\nDo you want to IGNORE BOTH so they cancel out and don't skew your spending?`)) {
          skippedRows.add(refund.id);
          skippedRows.add(matchingDebit.id);
        }
      }
    }

    // 2. Subscription Detection
    // Group by amount and merchant similarity
    const amountGroups: Record<number, PreviewRow[]> = {};
    for (const row of selectedRows) {
      if (skippedRows.has(row.id)) continue;
      if (!amountGroups[row.amount]) amountGroups[row.amount] = [];
      amountGroups[row.amount].push(row);
    }

    let updatedCards = creditCards ? [...creditCards] : [];
    let cardsChanged = false;
    const ccKeywords = /cred\b|credit card|sbi card|hdfc card|icici card|axis card|card payment/i;

    for (const row of selectedRows) {
      if (skippedRows.has(row.id)) continue;

      let finalNote = row.description;

      // Check if it's a subscription (at least 2 identical amounts > 0, spaced roughly 15-35 days apart)
      const peers = amountGroups[row.amount];
      if (peers && peers.length >= 2 && row.amount > 0) {
        // Sort by date to check gaps
        const sortedPeers = [...peers].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // Simple check: are they roughly the same merchant?
        const isSameMerchant = peers.every(p => 
          p.description.substring(0, 5).toLowerCase() === row.description.substring(0, 5).toLowerCase()
        );
        
        if (isSameMerchant) {
           finalNote = `🔁 Subscription: ${finalNote}`;
        }
      }

      if (row.amount > 0 && (ccKeywords.test(row.description) || ((row.category === 'EMIs' || row.category === 'Bills') && /card/i.test(row.description)))) {
        if (updatedCards.length > 0) {
          if (updatedCards.length === 1) {
            const card = updatedCards[0];
            if (window.confirm(`Detected Credit Card payment of ₹${row.amount} for "${row.description}".\n\nDo you want to apply this payment to your registered Credit Card (${card.name}) and reduce its due amount?`)) {
              card.currentBalance = Math.max(0, card.currentBalance - row.amount);
              card.updatedAt = Date.now();
              cardsChanged = true;
            }
          } else {
            const cardNames = updatedCards.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
            const input = window.prompt(`Detected Credit Card payment of ₹${row.amount} for "${row.description}".\n\nYou have multiple Credit Cards. Enter the number of the card to apply this payment to, or leave blank to skip:\n${cardNames}`);
            if (input) {
              const idx = parseInt(input) - 1;
              if (!isNaN(idx) && updatedCards[idx]) {
                const card = updatedCards[idx];
                card.currentBalance = Math.max(0, card.currentBalance - row.amount);
                card.updatedAt = Date.now();
                cardsChanged = true;
              }
            }
          }
        } else {
          window.alert(`Detected a Credit Card payment for "${row.description}".\n\nTip: You can add and track Credit Cards in the Settings tab to automatically clear dues when you import Bank Statements!`);
        }
      }

      finalRowsToImport.push({
        ...row,
        description: finalNote
      });
    }

    if (cardsChanged && updateCreditCards) {
      updateCreditCards(updatedCards);
    }

    const newExpenses: Expense[] = finalRowsToImport.map(row => ({
      id: crypto.randomUUID(), 
      person: row.person,
      date: row.date,
      amount: row.amount,
      category: row.category,
      paymentMode: 'Bank',
      note: row.description,
      updatedAt: Date.now()
    }));

    onImport(newExpenses);
    setPreviewRows([]); // Clear after import
  };

  return (
    <div className="flex flex-col gap-6 w-full p-4 mb-24 max-w-4xl mx-auto">
      {/* Dropzone */}
      {!requiresPassword && !showColumnMapper && previewRows.length === 0 && (
        <div 
          className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors bg-white dark:bg-[#1a1a1a] shadow-sm
            ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}
            ${isLoading ? 'opacity-50 pointer-events-none' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            accept=".csv,.pdf" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
            title="Drop your bank statement here"
          />
          <div className="text-center pointer-events-none">
            <div className="text-5xl mb-4">🏦</div>
            <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
              Click or drag and drop your bank statement here
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Supports .csv and .pdf formats
            </p>
          </div>
        </div>
      )}

      {/* Password Prompt for PDF */}
      {requiresPassword && pendingFile && (
        <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col items-center gap-4 text-center">
          <div className="text-5xl">🔒</div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Password Protected PDF</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm max-w-sm">
            The file <strong className="break-all">{pendingFile.name}</strong> requires a password. 
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded-lg text-xs text-left w-full max-w-sm border border-blue-100 dark:border-blue-800/50">
            <p className="font-semibold mb-1">Common Bank Formats:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li><strong>HDFC:</strong> Customer ID</li>
              <li><strong>SBI:</strong> Account Number or Date of Birth (DDMMYYYY)</li>
              <li><strong>ICICI:</strong> First 4 letters of name (lowercase) + DOB (DDMMYYYY)</li>
            </ul>
          </div>
          <div className="flex w-full max-w-xs gap-2 mt-4">
            <input 
              type="password" 
              value={pdfPassword}
              onChange={(e) => setPdfPassword(e.target.value)}
              title="PDF Password"
              placeholder="Enter PDF password"
              className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#2a2a2a] text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              onKeyDown={(e) => { 
                if (e.key === 'Enter' && pendingFile && pdfPassword) { 
                  setRequiresPassword(false); 
                  processFile(pendingFile, pdfPassword); 
                } 
              }}
            />
            <button 
              onClick={() => { 
                if (pendingFile) { 
                  setRequiresPassword(false); 
                  processFile(pendingFile, pdfPassword); 
                } 
              }}
              disabled={!pdfPassword || isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              Unlock
            </button>
          </div>
          <button 
            onClick={() => { 
              setRequiresPassword(false); 
              setPendingFile(null); 
              setPdfPassword(''); 
              setError(null); 
            }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mt-2 underline"
          >
            Cancel and upload a different file
          </button>
        </div>
      )}

      {/* Manual Column Mapper */}
      {showColumnMapper && (
        <div className="bg-white dark:bg-[#1a1a1a] p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="text-5xl mb-4">⚙️</div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Manual Column Mapping</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm max-w-md mx-auto">
              We couldn't automatically detect the columns in <strong>{pendingFile?.name}</strong>. 
              Please specify which column number (0-indexed) corresponds to each field. Open your CSV in Excel/Numbers to check the column order.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg bg-gray-50 dark:bg-[#2a2a2a] p-4 rounded-lg border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col gap-1">
              <label htmlFor="dateColMap" className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Date Column Index *</label>
              <input 
                id="dateColMap"
                type="number" 
                title="Date Column Index"
                min="0"
                value={csvColMap.date}
                onChange={e => setCsvColMap(prev => ({...prev, date: parseInt(e.target.value) || 0}))}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#1a1a1a] text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="descColMap" className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Description Column Index *</label>
              <input 
                id="descColMap"
                type="number" 
                title="Description Column Index"
                min="0"
                value={csvColMap.desc}
                onChange={e => setCsvColMap(prev => ({...prev, desc: parseInt(e.target.value) || 0}))}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#1a1a1a] text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="amountColMap" className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Amount/Debit Column Index *</label>
              <input 
                id="amountColMap"
                type="number" 
                title="Amount Column Index"
                min="0"
                value={csvColMap.amount}
                onChange={e => setCsvColMap(prev => ({...prev, amount: parseInt(e.target.value) || 0}))}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#1a1a1a] text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">If your bank separates Debit and Credit into two columns, just put the Debit column index here. We only import expenses.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center mt-2">
            <button 
              onClick={() => { 
                setShowColumnMapper(false); 
                setPendingFile(null); 
                setRawCsvText(''); 
                setError(null); 
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
            >
              Cancel
            </button>
            <button 
              onClick={applyManualMapping}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              Apply Mapping
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Preview Table */}
      {previewRows.length > 0 && (
        <div className="flex flex-col gap-4 bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Preview Imported Transactions</h3>
            <div className="text-sm font-medium text-gray-500">
              {filteredRows.filter(r => r.include).length} of {filteredRows.length} selected
            </div>
          </div>

          {/* Action Bar (Filters & Bulk Actions) */}
          <div className="flex flex-wrap items-end gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-1">
              <CustomDatePicker
                label="From Date"
                value={startDate}
                onChange={setStartDate}
              />
            </div>
            <div className="flex flex-col gap-1">
              <CustomDatePicker
                label="To Date"
                value={endDate}
                onChange={setEndDate}
              />
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 self-center mb-1 drop-shadow-sm font-medium transition-colors"
                title="Clear Filters"
              >
                Clear
              </button>
            )}

            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 self-center mx-2 hidden sm:block"></div>

            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <CustomSelect
                    label="Bulk Edit Category"
                    value={bulkCategory}
                    onChange={setBulkCategory}
                    options={categoryOptions}
                    placeholder="Select Category"
                  />
                </div>
                <button
                  onClick={handleBulkCategoryApply}
                  disabled={!bulkCategory || filteredRows.filter(r => r.include).length === 0}
                  className="px-3 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded text-sm transition-colors disabled:opacity-50"
                  title="Apply to checked rows"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      checked={previewRows.filter(r => !r.isDuplicate).every(r => r.include)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPreviewRows(prev => prev.map(row => 
                          row.isDuplicate ? row : { ...row, include: checked }
                        ));
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Description</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Category</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Person</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {previewRows.map((row) => (
                  <tr 
                    key={row.id} 
                    className={`${row.isDuplicate ? 'bg-orange-50 dark:bg-orange-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                    title={row.isDuplicate ? 'Possible duplicate detected' : ''}
                  >
                    <td className="px-4 py-2 text-center">
                      <input 
                        type="checkbox" 
                        title="Include transaction"
                        checked={row.include}
                        onChange={(e) => handleRowChange(row.id, 'include', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                    </td>
                    <td className="px-4 py-2 min-w-[180px]">
                      <CustomDatePicker
                        value={row.date}
                        onChange={(val) => handleRowChange(row.id, 'date', val)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="truncate max-w-xs text-gray-800 dark:text-gray-200 font-medium" title={row.description}>
                        {row.description}
                      </div>
                      {row.isDuplicate && (
                        <span className="text-xs text-orange-600 dark:text-orange-400 font-bold bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded mt-1 inline-block">Duplicate</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-gray-800 dark:text-gray-200">
                      ₹{row.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2 min-w-[180px]">
                      <CustomSelect
                        value={row.category}
                        onChange={(val) => handleRowChange(row.id, 'category', val)}
                        options={categoryOptions}
                      />
                    </td>
                    <td className="px-4 py-2 min-w-[180px]">
                      <CustomSelect
                        value={row.person}
                        onChange={(val) => handleRowChange(row.id, 'person', val)}
                        options={personOptions}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-end mt-2">
            <button
              onClick={handleImportSelected}
              disabled={!filteredRows.some(r => r.include)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Import Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrapper Component to maintain compatibility with App.tsx
export const BankImport: any = (props: any) => {
  // If called from App.tsx, we adapt the props to our purely defined BankImportProps interface
  
  const existingExpenses = props.existingExpenses || props.state?.expenses || [];
  const p1Name = props.person1Name || props.state?.settings?.person1Name || 'Person 1';
  const p2Name = props.person2Name || props.state?.settings?.person2Name || 'Person 2';
  
  const handleImport = (expenses: Expense[]) => {
    if (props.onImport) {
      props.onImport(expenses);
    }
    
    // Fallback for App.tsx behavior
    if (props.addExpense) {
      expenses.forEach(e => props.addExpense(e));
      if (props.showToast) {
        props.showToast(`Imported ${expenses.length} expenses successfully!`, 'success');
      }
      if (props.onClose) {
        props.onClose();
      }
    }
  };

  const updateCC = (cards: CreditCard[]) => {
    if (props.state?.setState) {
      props.state.setState({ creditCards: cards });
    }
  };

  return (
    <BankImportUI 
      existingExpenses={existingExpenses} 
      onImport={handleImport} 
      person1Name={p1Name} 
      person2Name={p2Name} 
      creditCards={props.state?.creditCards}
      updateCreditCards={updateCC}
    />
  );
};

export default BankImport;
