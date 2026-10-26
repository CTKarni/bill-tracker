import { describe, it, expect } from 'vitest';
import { formatINR, parseINRInput, paiseToInputString, validateAmount } from './format';

describe('formatINR', () => {
  it('formats whole rupees correctly with Indian digit grouping', () => {
    expect(formatINR(100000)).toBe('₹1,000');
    expect(formatINR(12500000)).toBe('₹1,25,000');
    expect(formatINR(1000000000)).toBe('₹1,00,00,000');
  });

  it('formats fractional paise with 2 decimal places', () => {
    expect(formatINR(12500050)).toBe('₹1,25,000.50');
    expect(formatINR(99)).toBe('₹0.99');
    expect(formatINR(50)).toBe('₹0.50');
  });

  it('supports showZeroDecimals option', () => {
    expect(formatINR(50000, { showZeroDecimals: true })).toBe('₹500.00');
    expect(formatINR(0, { showZeroDecimals: true })).toBe('₹0.00');
    expect(formatINR(0, { showZeroDecimals: false })).toBe('₹0');
  });

  it('supports includeSymbol option', () => {
    expect(formatINR(12500050, { includeSymbol: false })).toBe('1,25,000.50');
  });

  it('formats negative amounts correctly', () => {
    expect(formatINR(-50000)).toBe('-₹500');
    expect(formatINR(-12500050)).toBe('-₹1,25,000.50');
  });

  it('handles 0 and NaN gracefully', () => {
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(NaN)).toBe('₹0');
  });
});

describe('parseINRInput', () => {
  it('parses plain numbers into paise', () => {
    expect(parseINRInput('500')).toBe(50000);
    expect(parseINRInput('125000')).toBe(12500000);
    expect(parseINRInput('0.5')).toBe(50);
    expect(parseINRInput('0.50')).toBe(50);
    expect(parseINRInput('45.75')).toBe(4575);
  });

  it('parses formatted Indian strings with currency symbols and commas', () => {
    expect(parseINRInput('₹1,25,000.50')).toBe(12500050);
    expect(parseINRInput('₹ 5,000')).toBe(500000);
    expect(parseINRInput('1,00,000')).toBe(10000000);
  });

  it('handles whitespace, empty, and invalid inputs gracefully', () => {
    expect(parseINRInput('')).toBe(0);
    expect(parseINRInput('   ')).toBe(0);
    expect(parseINRInput('abc')).toBe(0);
    expect(parseINRInput('₹ -')).toBe(0);
  });
});

describe('paiseToInputString', () => {
  it('converts paise to clean input value', () => {
    expect(paiseToInputString(50000)).toBe('500');
    expect(paiseToInputString(12500050)).toBe('125000.50');
    expect(paiseToInputString(0)).toBe('');
  });
});

describe('validateAmount', () => {
  it('accepts valid amounts', () => {
    expect(validateAmount('500')).toEqual({ valid: true, paise: 50000 });
    expect(validateAmount('1250.50')).toEqual({ valid: true, paise: 125050 });
    expect(validateAmount('₹1,25,000.50')).toEqual({ valid: true, paise: 12500050 });
  });

  it('rejects empty input', () => {
    expect(validateAmount('').valid).toBe(false);
    expect(validateAmount('   ').valid).toBe(false);
  });

  it('rejects zero when allowZero is false or default', () => {
    expect(validateAmount('0').valid).toBe(false);
    expect(validateAmount('0.00').valid).toBe(false);
    expect(validateAmount('0', { allowZero: true }).valid).toBe(true);
  });

  it('rejects negative numbers', () => {
    expect(validateAmount('-100').valid).toBe(false);
    expect(validateAmount('-0.50').valid).toBe(false);
  });

  it('rejects scientific notation (e.g. 1e5)', () => {
    expect(validateAmount('1e5').valid).toBe(false);
    expect(validateAmount('2.5e3').valid).toBe(false);
    expect(validateAmount('1E6').valid).toBe(false);
  });

  it('rejects more than 2 decimal places', () => {
    expect(validateAmount('10.999').valid).toBe(false);
    expect(validateAmount('0.123').valid).toBe(false);
  });

  it('rejects NaN, Infinity, and invalid characters', () => {
    expect(validateAmount('abc').valid).toBe(false);
    expect(validateAmount('Infinity').valid).toBe(false);
    expect(validateAmount('NaN').valid).toBe(false);
    expect(validateAmount('12.34.56').valid).toBe(false);
  });

  it('rejects extremely large values exceeding limit', () => {
    // 100 Crore is 100,00,00,000
    expect(validateAmount('1000000001').valid).toBe(false);
  });
});

