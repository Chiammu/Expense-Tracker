import React, { useState, useMemo } from 'react';
import { AppState, Expense } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { roastSpending } from '../services/geminiService';

interface SummariesProps {
  state: AppState;
  deleteExpense: (id: number) => void;
  editExpense: (expense: Expense) => void;
}

const COLORS = ['#e91e63', '#2196f3', '#ff9800', '#4caf50', '#9c27b0', '#00bcd4', '#795548', '#3f51b5', '#8bc34a', '#f44336'];
const PAYMENT_MODES = ['all', 'UPI', 'Card', 'Cash', 'Netbanking', 'Wallet', 'Other'];

export const Summaries: React.FC<SummariesProps> = ({ state, deleteExpense, editExpense }) => {
  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'charts' | 'calendar'>('charts');
  
  // Roast State
  const [roast, setRoast] = useState<string | null>(null);
  const [loadingRoast, setLoadingRoast] = useState(false);

  const handlePaymentFilterClick = (mode: string) => {
    setPaymentFilter(mode);
    if (mode !== 'all' && filterType !== 'all') {
      setFilterType('all');
    }
  };

  const handleRoast = async () => {
    setLoadingRoast(true);
    const result = await roastSpending(state);
    setRoast(result);
    setLoadingRoast(false);
  };

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return state.expenses.filter(exp => {
      // Search Term
      if (searchTerm && !exp.note.toLowerCase().includes(searchTerm.toLowerCase()) && !String(exp.amount).includes(searchTerm)) {
        return false;
      }
      
      // Payment Mode Filter
      if (paymentFilter !== 'all' && exp.paymentMode !== paymentFilter) {
        return false;
      }

      // Date Filter
      const expDate = new Date(exp.date);
      const expDateOnly = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());

      if (filterType === 'today') {
        return expDateOnly.getTime() === today.getTime();
      } else if (filterType === 'week') {
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
        const lastDay = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        return expDateOnly >= firstDay && expDateOnly <= lastDay;
      } else if (filterType === 'month') {
        return expDateOnly.getMonth() === today.getMonth() && expDateOnly.getFullYear() === today.getFullYear();
      }
      return true;
    });
  }, [state.expenses, filterType, paymentFilter, searchTerm]);

  const stats = useMemo(() => {
    let p1 = 0, p2 = 0, shared = 0;
    const catMap: Record<string, number> = {};

    filteredExpenses.forEach(e => {
      if (e.person === 'Person1') p1 += e.amount;
      else if (e.person === 'Person2') p2 += e.amount;
      else shared += e.amount;

      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });

    const total = p1 + p2 + shared;
    const p1Real = p1 + (shared / 