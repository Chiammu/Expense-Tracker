import { describe, it, expect, vi } from 'vitest';
import { _parseTransactionLines } from '../parseBankPDF';

// Mock pdfjs-dist and the worker import to avoid DOM errors in test environment
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

vi.mock('pdfjs-dist/build/pdf.worker?url', () => ({
  default: '',
}));

describe('parseBankPDF logic', () => {
  it('parses standard SBI transaction format (3 amounts)', () => {
    const lines = [
      'Statement of Account for 01-Jan-2024 to 31-Jan-2024',
      'Date Description Ref Debit Credit Balance',
      '05/01/2024 UPI/123456/RELIANCE 12345 500.00 0.00 5000.00',
      '10/01/2024 NEFT/CR/COMPANY/SALARY 54321 0.00 50000.00 55000.00'
    ];
    const result = _parseTransactionLines(lines);
    console.log("ACTUAL Parsed SBI:", result[0]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2024-01-05',
      amount: 500,
      description: 'UPI/123456/RELIANCE 12345',
      type: 'debit'
    });
    expect(result[1]).toEqual({
      date: '2024-01-10',
      amount: 50000,
      description: 'NEFT/CR/COMPANY/SALARY 54321',
      type: 'credit'
    });
  });

  it('parses HDFC simplified format', () => {
    const lines = [
      '15/01/24 DINING AT CAFE 1050.00 0.00 12000.00',
      '18/01/24 CASH DEPOSIT 0.00 5000.00 17000.00'
    ];
    const result = _parseTransactionLines(lines);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].type).toBe('debit');
    expect(result[1].type).toBe('credit');
  });

  it('parses Dr/Cr format', () => {
    const lines = [
      '20-Jan-2024 AMAZON REFUND 1499.00 Cr',
      '22-Jan-2024 ZOMATO ORDER 450.00 Dr'
    ];
    const result = _parseTransactionLines(lines);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2024-01-20',
      amount: 1499,
      description: 'AMAZON REFUND',
      type: 'credit'
    });
  });

  it('parses Kotak Mahindra Bank format with balance tracking and negative balances', () => {
    const lines = [
      '-   -   Opening Balance   -   -   -   46,049.34',
      '1   10 Dec 2025   ATM WITHDRAWAL 1,000.00   45,049.34',
      '2   11 Dec 2025   Sweep Trf From: 9198599274 15,000.00   60,049.34',
      '3   12 Dec 2025   LARGE DEBIT 2,00,000.00   -1,39,950.66',
      '4   13 Dec 2025   REFUND 1,000.00   -1,38,950.66'
    ];
    const result = _parseTransactionLines(lines);
    expect(result).toHaveLength(4);
    
    expect(result[0].type).toBe('debit');  // 45049 - 46049 = -1000
    expect(result[1].type).toBe('credit'); // 60049 - 45049 = +15000
    expect(result[2].type).toBe('debit');  // -139950 - 60049 = -200000
    expect(result[3].type).toBe('credit'); // -138950 - (-139950) = +1000
  });

  it('skips header and footer lines', () => {
    const lines = [
      'Opening Balance: 1000.00',
      'Total Debit: 500.00',
      'Closing Balance: 1500.00',
      'Generated on 01/02/2024',
      'Page 1'
    ];
    const result = _parseTransactionLines(lines);
    expect(result).toHaveLength(0);
  });
});
