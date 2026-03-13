import { _parseTransactionLines } from './utils/parseBankPDF.ts';

const lines = [
  'Statement of Account for 01-Jan-2024 to 31-Jan-2024',
  'Date Description Ref Debit Credit Balance',
  '05/01/2024 UPI/123456/RELIANCE 12345 500.00 0.00 5000.00',
  '10/01/2024 NEFT/CR/COMPANY/SALARY 54321 0.00 50000.00 55000.00'
];

console.log(JSON.stringify(_parseTransactionLines(lines), null, 2));
