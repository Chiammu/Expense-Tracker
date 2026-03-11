import React, { useState } from 'react';
import { CashWallet, CashTransaction } from '../types';
import { generateId } from '../utils/id';

interface CashWalletProps {
  wallet: CashWallet;
  person1Name: string;
  person2Name: string;
  onAddTransaction: (tx: CashTransaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const CashWalletComponent: React.FC<CashWalletProps> = ({
  wallet,
  person1Name,
  person2Name,
  onAddTransaction,
  onDeleteTransaction
}) => {
  const [activeForm, setActiveForm] = useState<'topup' | 'expense' | 'withdraw' | null>(null);
  
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formPerson, setFormPerson] = useState(person1Name);

  const handleOpenForm = (type: 'topup' | 'expense' | 'withdraw') => {
    setActiveForm(type);
    setFormAmount('');
    setFormNote('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormPerson(person1Name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeForm || !formAmount || !formNote || !formDate || !formPerson) return;

    const tx: CashTransaction = {
      id: generateId(),
      type: activeForm,
      amount: parseFloat(formAmount),
      note: formNote,
      date: formDate,
      person: formPerson,
      updatedAt: Date.now()
    };

    onAddTransaction(tx);
    setActiveForm(null);
  };

  // Sort transactions by date descending
  const sortedTransactions = [...(wallet.transactions || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.updatedAt - a.updatedAt
  );

  // Calculate running balance for display
  let currentBal = wallet.balance;
  const displayTransactions = sortedTransactions.map(tx => {
    const balToDisplay = currentBal;
    const change = tx.type === 'topup' ? tx.amount : -tx.amount;
    currentBal -= change; // work backward for the next older transaction
    return { ...tx, runningBalance: balToDisplay };
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const todaySpend = wallet.transactions
    .filter(tx => tx.date === todayStr && (tx.type === 'expense' || tx.type === 'withdraw'))
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Balance Card */}
      <div className="bg-[#0a0a0a] dark:bg-[#121212] rounded-[20px] p-5 border border-white/[0.08] shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-50 text-[10px] font-mono text-gray-500">CASH.WALLET</div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Current Cash Balance</p>
        <h3 className={`text-4xl font-mono font-medium tracking-tighter ${wallet.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          ₹ {wallet.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </h3>
        {todaySpend > 0 && (
          <div className="mt-2 inline-block bg-red-500/10 border border-red-500/20 rounded px-2 py-1 text-xs text-red-400">
            Today's Spend: ₹ {todaySpend.toLocaleString('en-IN')}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => handleOpenForm('topup')}
          className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-xl text-sm font-bold active:scale-95 transition-transform"
        >
          Add Cash
        </button>
        <button
          onClick={() => handleOpenForm('expense')}
          className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold active:scale-95 transition-transform"
        >
          Spend Cash
        </button>
        <button
          onClick={() => handleOpenForm('withdraw')}
          className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl text-sm font-bold active:scale-95 transition-transform"
        >
          Withdraw
        </button>
      </div>

      {/* Inline Form */}
      {activeForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3 animate-slide-up">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-sm uppercase tracking-wider text-gray-700 dark:text-gray-300">
              {activeForm === 'topup' ? 'Add Cash to Wallet' : activeForm === 'expense' ? 'Record Cash Expense' : 'Withdraw Cash'}
            </h4>
            <button type="button" onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase text-gray-500 mb-1">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
                className="w-full p-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-500 mb-1">Date</label>
              <input
                type="date"
                required
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                className="w-full p-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm appearance-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase text-gray-500 mb-1">Note / Description</label>
              <input
                type="text"
                required
                value={formNote}
                onChange={e => setFormNote(e.target.value)}
                className="w-full p-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                placeholder="e.g. ATM, Groceries..."
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase text-gray-500 mb-1">Person</label>
              <select
                value={formPerson}
                onChange={e => setFormPerson(e.target.value)}
                className="w-full p-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              >
                <option value={person1Name}>{person1Name}</option>
                <option value={person2Name}>{person2Name}</option>
              </select>
            </div>
          </div>
          <button type="submit" className="w-full mt-2 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm">
            Save Transaction
          </button>
        </form>
      )}

      {/* Transaction History */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Transaction History</h4>
        {displayTransactions.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed text-gray-400 text-sm">
            No cash transactions yet. Add cash to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {displayTransactions.map((tx) => (
              <div key={tx.id} className="group relative flex flex-col p-3 bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      tx.type === 'topup' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      tx.type === 'expense' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {tx.type}
                    </span>
                    <span className="text-xs text-gray-400">{tx.date}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 rounded">{tx.person}</span>
                  </div>
                  <button
                    onClick={() => onDeleteTransaction(tx.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors hidden group-hover:block absolute right-3 top-3"
                    title="Delete Transaction"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight pr-6">
                    {tx.note}
                  </span>
                  <div className="text-right">
                    <div className={`text-base font-bold font-mono ${tx.type === 'topup' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {tx.type === 'topup' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      Bal: ₹{tx.runningBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CashWalletComponent;
