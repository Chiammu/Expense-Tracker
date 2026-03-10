import React, { useState, useCallback } from 'react';
import { Expense, DEFAULT_CATEGORIES } from '../types';
import { parseBankCSV, ParsedTransaction as CSVTransaction } from '../utils/parseBankCSV';
import { parseBankPDF, ParsedTransaction as PDFTransaction } from '../utils/parseBankPDF';
import { mapCategory } from '../utils/categoryMapper';

export interface BankImportProps {
  existingExpenses: Expense[];
  onImport: (expenses: Expense[]) => void;
  person1Name: string;
  person2Name: string;
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
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      let parsedTransactions: (CSVTransaction | PDFTransaction)[] = [];

      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        parsedTransactions = parseBankCSV(text);
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        parsedTransactions = await parseBankPDF(arrayBuffer);
      } else {
        throw new Error("Unsupported file type. Please upload a .csv or .pdf file.");
      }

      // Process and map categories, check duplicates
      const newRows: PreviewRow[] = parsedTransactions
        .filter(t => t.type === 'debit') // typically only import debits as expenses
        .map((t, index) => {
          const isDuplicate = existingExpenses.some(
            (e) => e.date === t.date && e.amount === t.amount
          );

          return {
            id: `row-${index}-${Date.now()}`,
            include: !isDuplicate,
            isDuplicate,
            date: t.date,
            description: t.description,
            amount: t.amount,
            category: mapCategory(t.description),
            person: person1Name,
          };
        });

      setPreviewRows(newRows);
    } catch (err: any) {
      console.error(err);
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

  const handleRowChange = (id: string, field: keyof PreviewRow, value: any) => {
    setPreviewRows(prev => prev.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const handleImportSelected = () => {
    const selectedRows = previewRows.filter(r => r.include);
    if (selectedRows.length === 0) return;

    const newExpenses: Expense[] = selectedRows.map(row => ({
      // @ts-ignore - The instruction explicitly asked to use crypto.randomUUID() for id
      id: crypto.randomUUID() as any as number, 
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
          <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
            Click or drag and drop your bank statement here
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Supports .csv and .pdf formats
          </p>
        </div>
      </div>

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
              {previewRows.filter(r => r.include).length} of {previewRows.length} selected
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
                        checked={row.include}
                        onChange={(e) => handleRowChange(row.id, 'include', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input 
                        type="date"
                        value={row.date}
                        onChange={(e) => handleRowChange(row.id, 'date', e.target.value)}
                        className="bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100"
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
                    <td className="px-4 py-2">
                      <select 
                        value={row.category}
                        onChange={(e) => handleRowChange(row.id, 'category', e.target.value)}
                        className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 min-w-[120px] focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100"
                      >
                        {DEFAULT_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select 
                        value={row.person}
                        onChange={(e) => handleRowChange(row.id, 'person', e.target.value)}
                        className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100"
                      >
                        <option value={person1Name}>{person1Name}</option>
                        <option value={person2Name}>{person2Name}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-end mt-2">
            <button
              onClick={handleImportSelected}
              disabled={!previewRows.some(r => r.include)}
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

  return (
    <BankImportUI 
      existingExpenses={existingExpenses} 
      onImport={handleImport} 
      person1Name={p1Name} 
      person2Name={p2Name} 
    />
  );
};

export default BankImport;
