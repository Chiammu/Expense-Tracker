import React, { useState, useRef, useCallback } from 'react';
import { parseBankCSV, ParsedTransaction } from '../utils/parseBankCSV';
import { detectCategory } from '../utils/categoryDetect';
import { AppState, Expense } from '../types';

interface BankImportProps {
  state: AppState;
  addExpense: (expense: Omit<Expense, 'id' | 'updatedAt'>) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onClose?: () => void;
}

interface PreviewRow extends ParsedTransaction {
  selected: boolean;
  category: string;
  person: string;
}

export const BankImport: React.FC<BankImportProps> = ({ state, addExpense, showToast, onClose }) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setParsing(true);
    setFileName(file.name);

    try {
      let transactions: ParsedTransaction[] = [];

      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        const text = await file.text();
        transactions = parseBankCSV(text);
      } else if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
        // PDF parsing using pdfjs-dist
        try {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item: any) => item.str).join(',');
            fullText += pageText + '\n';
          }

          // Try parsing the extracted text as CSV-like rows
          transactions = parseBankCSV(fullText);
        } catch (pdfErr) {
          console.error('PDF parsing error:', pdfErr);
          showToast('Failed to parse PDF. Try exporting as CSV from your bank.', 'error');
          setParsing(false);
          return;
        }
      } else {
        showToast('Unsupported file type. Please upload a .csv or .pdf file.', 'error');
        setParsing(false);
        return;
      }

      if (transactions.length === 0) {
        showToast('No transactions found in this file. Check format or try a different export.', 'error');
        setParsing(false);
        return;
      }

      // Only keep debits, auto-detect categories
      const debits = transactions
        .filter(t => t.type === 'debit')
        .map(t => ({
          ...t,
          selected: true,
          category: detectCategory(t.description),
          person: 'Person1',
        }));

      if (debits.length === 0) {
        showToast('No debit transactions found. Only debits are imported as expenses.', 'info');
        setParsing(false);
        return;
      }

      setRows(debits);
      setStep('preview');
      showToast(`Found ${debits.length} debit transaction(s)`, 'success');
    } catch (err: any) {
      console.error('File processing error:', err);
      showToast(`Error processing file: ${err.message}`, 'error');
    } finally {
      setParsing(false);
    }
  }, [showToast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const toggleRow = (index: number) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r));
  };

  const toggleAll = () => {
    const allSelected = rows.every(r => r.selected);
    setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const updateCategory = (index: number, category: string) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, category } : r));
  };

  const updatePerson = (index: number, person: string) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, person } : r));
  };

  const handleImport = () => {
    const selected = rows.filter(r => r.selected);
    if (selected.length === 0) {
      showToast('No transactions selected for import', 'error');
      return;
    }

    selected.forEach(row => {
      addExpense({
        person: row.person,
        date: row.date,
        amount: row.amount,
        category: row.category,
        paymentMode: 'Netbanking',
        note: row.description,
      });
    });

    setImportCount(selected.length);
    setStep('done');
    showToast(`Successfully imported ${selected.length} expense(s)!`, 'success');
  };

  const resetImport = () => {
    setStep('upload');
    setRows([]);
    setFileName('');
    setImportCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectedCount = rows.filter(r => r.selected).length;
  const totalAmount = rows.filter(r => r.selected).reduce((s, r) => s + r.amount, 0);

  // ─── Upload ───────────────────────────────
  if (step === 'upload') {
    return (
      <div className="max-w-2xl mx-auto pb-24 px-4 sm:px-0">
        <div className="bg-surface dark:bg-[#1a1a1a] rounded-[32px] p-6 shadow-xl border border-gray-100 dark:border-white/5 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-text">
              <span className="mr-2">🏦</span>Bank Import
            </h2>
            {onClose && (
              <button onClick={onClose} className="text-text-light hover:text-text transition-colors text-xl">✕</button>
            )}
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-[24px] border-2 border-dashed p-12 text-center transition-all duration-300 ${
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-gray-200 dark:border-white/10 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-white/[0.02]'
            }`}
          >
            {parsing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-text-light font-medium">Parsing {fileName}...</p>
              </div>
            ) : (
              <>
                <div className="text-5xl mb-4">📄</div>
                <p className="text-lg font-bold text-text mb-1">Drop your bank statement here</p>
                <p className="text-sm text-text-light">or click to select a file</p>
                <p className="text-xs text-text-light/60 mt-4">
                  Supports CSV &amp; PDF · SBI, HDFC, ICICI, Axis formats
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.pdf"
            onChange={handleFileChange}
          />

          <div className="mt-6 p-4 bg-gray-50 dark:bg-white/[0.03] rounded-2xl">
            <p className="text-xs font-bold text-text-light uppercase tracking-wider mb-2">How it works</p>
            <div className="space-y-2 text-sm text-text-light">
              <p>📥 Upload → 👁️ Preview → ✏️ Edit categories → ✅ Import</p>
              <p className="text-xs">• Only <strong>debit</strong> entries are imported as expenses</p>
              <p className="text-xs">• Categories are auto-detected from transaction descriptions</p>
              <p className="text-xs">• All processing happens locally — your data never leaves your device</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Done ────────────────────────────────
  if (step === 'done') {
    return (
      <div className="max-w-2xl mx-auto pb-24 px-4 sm:px-0">
        <div className="bg-surface dark:bg-[#1a1a1a] rounded-[32px] p-8 shadow-xl border border-gray-100 dark:border-white/5 animate-scale-in text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-text mb-2">Import Complete!</h2>
          <p className="text-text-light mb-6">
            {importCount} expense{importCount !== 1 ? 's' : ''} added to your tracker.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={resetImport}
              className="px-6 py-3 rounded-xl font-bold text-text-light hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              Import More
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-primary to-pink-600 text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Preview ─────────────────────────────
  return (
    <div className="max-w-4xl mx-auto pb-24 px-4 sm:px-0">
      <div className="bg-surface dark:bg-[#1a1a1a] rounded-[32px] p-6 shadow-xl border border-gray-100 dark:border-white/5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-text">
              <span className="mr-2">👁️</span>Preview Transactions
            </h2>
            <p className="text-sm text-text-light">
              {fileName} · {rows.length} debit{rows.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <button onClick={resetImport} className="text-sm text-text-light hover:text-text transition-colors font-medium">
            ← Back
          </button>
        </div>

        {/* Summary pill */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="bg-primary/10 text-primary text-sm font-bold px-4 py-1.5 rounded-full">
            {selectedCount} selected
          </div>
          <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-bold px-4 py-1.5 rounded-full">
            ₹{totalAmount.toLocaleString('en-IN')}
          </div>
          <button onClick={toggleAll} className="text-xs text-secondary font-bold hover:underline ml-auto">
            {rows.every(r => r.selected) ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-light text-xs uppercase tracking-wider border-b border-gray-100 dark:border-white/5">
                <th className="py-3 px-2 text-left w-8">✓</th>
                <th className="py-3 px-2 text-left">Date</th>
                <th className="py-3 px-2 text-left">Description</th>
                <th className="py-3 px-2 text-right">Amount</th>
                <th className="py-3 px-2 text-left">Category</th>
                <th className="py-3 px-2 text-left">Who</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-gray-50 dark:border-white/[0.03] transition-colors ${
                    row.selected ? 'bg-transparent' : 'opacity-40'
                  }`}
                >
                  <td className="py-3 px-2">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={() => toggleRow(i)}
                      className="w-4 h-4 accent-primary rounded"
                    />
                  </td>
                  <td className="py-3 px-2 font-mono text-xs whitespace-nowrap text-text">{row.date}</td>
                  <td className="py-3 px-2 text-text max-w-[200px] truncate" title={row.description}>
                    {row.description}
                  </td>
                  <td className="py-3 px-2 text-right font-bold text-text whitespace-nowrap">
                    ₹{row.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-2">
                    <select
                      value={row.category}
                      onChange={e => updateCategory(i, e.target.value)}
                      className="bg-gray-50 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-text w-full max-w-[120px]"
                    >
                      {state.settings.customCategories.map(cat => (
                        <option key={cat} value={cat}>{state.settings.categoryIcons[cat] || ''} {cat}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-2">
                    <select
                      value={row.person}
                      onChange={e => updatePerson(i, e.target.value)}
                      className="bg-gray-50 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-text w-full max-w-[100px]"
                    >
                      <option value="Person1">{state.settings.person1Name}</option>
                      <option value="Person2">{state.settings.person2Name}</option>
                      <option value="Both">Both</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Import button */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-text-light">
            💡 Tip: You can change categories and the person before importing.
          </p>
          <button
            onClick={handleImport}
            disabled={selectedCount === 0}
            className="px-6 py-3 bg-gradient-to-r from-primary to-pink-600 text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Import {selectedCount} Expense{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
