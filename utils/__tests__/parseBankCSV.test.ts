import { parseBankCSV } from '../parseBankCSV';

declare var describe: any;
declare var it: any;
declare var expect: any;

describe('parseBankCSV', () => {
  it('should parse SBI format (Date, Narration, Debit, Credit, Balance)', () => {
    const sbiCSV = `Txn Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
20-10-2023,TO TRANSFER-UPI/DR,1234,500.00,,1000.00
21-10-2023,BY TRANSFER-UPI/CR,5678,,1000.00,2000.00
22-10-2023,OPENING BALANCE,,,,1500.00`;
    
    const result = parseBankCSV(sbiCSV);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2023-10-20',
      description: 'TO TRANSFER-UPI/DR',
      amount: 500.00,
      type: 'debit'
    });
    expect(result[1]).toEqual({
      date: '2023-10-21',
      description: 'BY TRANSFER-UPI/CR',
      amount: 1000.00,
      type: 'credit'
    });
  });

  it('should parse HDFC format (Date, Narration, Value Date, Withdrawal Amount, Deposit Amount, Closing Balance)', () => {
    const hdfcCSV = `Date,Narration,Value Date,Withdrawal Amount,Deposit Amount,Closing Balance
15/01/23,ZOMATO,15/01/23,250.00,,5000.00
16/01/23,SALARY,16/01/23,,50000.00,55000.00`;
    
    const result = parseBankCSV(hdfcCSV);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2023-01-15',
      description: 'ZOMATO',
      amount: 250.00,
      type: 'debit'
    });
    expect(result[1]).toEqual({
      date: '2023-01-16',
      description: 'SALARY',
      amount: 50000.00,
      type: 'credit'
    });
  });

  it('should parse ICICI format (S No., Value Date, Transaction Date, Cheque Number, Transaction Remarks, Withdrawal Amount (INR ), Deposit Amount (INR ), Balance (INR ))', () => {
    const iciciCSV = `S No.,Value Date,Transaction Date,Cheque Number,Transaction Remarks,Withdrawal Amount (INR ),Deposit Amount (INR ),Balance (INR )
1,01/02/2023,01/02/2023,-,SWIGGY,300.0,,4700.0`;
    
    const result = parseBankCSV(iciciCSV);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: '2023-02-01',
      description: 'SWIGGY',
      amount: 300.00,
      type: 'debit'
    });
  });

  it('should parse Axis format (Tran Date,CHQNO,PARTICULARS,DR,CR,BAL,SOL)', () => {
    const axisCSV = `Tran Date,CHQNO,PARTICULARS,DR,CR,BAL,SOL
05-03-2023,-,Amazon Pay,899.00,,3801.00,123`;
    
    const result = parseBankCSV(axisCSV);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: '2023-03-05',
      description: 'Amazon Pay',
      amount: 899.00,
      type: 'debit'
    });
  });

  it('should handle Date format DD MMM YYYY', () => {
    const customCSV = `Date,Description,Debit,Credit
15 Jan 2023,Shopping,150,`;
    
    const result = parseBankCSV(customCSV);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2023-01-15');
  });

  it('should handle single Amount column with Dr/Cr type column', () => {
    const singleColCSV = `Date,Particulars,Amount,Type
10/05/2023,Netflix,199,Dr
11/05/2023,Refund,50,Cr`;
    
    const result = parseBankCSV(singleColCSV);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2023-05-10',
      description: 'Netflix',
      amount: 199,
      type: 'debit'
    });
    expect(result[1]).toEqual({
      date: '2023-05-11',
      description: 'Refund',
      amount: 50,
      type: 'credit'
    });
  });
});
