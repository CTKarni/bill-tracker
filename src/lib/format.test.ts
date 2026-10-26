import { describe, it, expect } from 'vitest';
import { formatINR, parseINRInput, paiseToInputString } from './format';

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
