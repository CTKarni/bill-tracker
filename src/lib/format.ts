/**
 * Format paise into INR currency string with Indian numbering system.
 * Example: 12500050 -> ₹1,25,000.50
 * Example: 500000 -> ₹5,000 (or ₹5,000.00 if showZeroDecimals: true)
 */
export function formatINR(
  paise: number,
  options?: {
    showZeroDecimals?: boolean;
    includeSymbol?: boolean;
  }
): string {
  if (isNaN(paise) || !isFinite(paise)) {
    paise = 0;
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const rupees = absPaise / 100;
  const hasPaise = absPaise % 100 !== 0;

  const showDecimals = options?.showZeroDecimals ?? hasPaise;
  const includeSymbol = options?.includeSymbol ?? true;

  // Format with en-IN locale
  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);

  const symbol = includeSymbol ? '₹' : '';
  const sign = isNegative ? '-' : '';

  return `${sign}${symbol}${formattedNumber}`;
}

/**
 * Parse an INR input string (e.g. "₹1,25,000.50", "125000.5", "500") into paise as an integer.
 * Always returns a clean integer >= 0 (or negative if explicitly input).
 */
export function parseINRInput(input: string): number {
  if (!input || typeof input !== 'string') {
    return 0;
  }

  // Remove currency symbol, commas, and whitespace
  const sanitized = input.replace(/[₹,\s]/g, '').trim();
  if (sanitized === '' || sanitized === '-' || sanitized === '.') {
    return 0;
  }

  const parsed = parseFloat(sanitized);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return 0;
  }

  // Convert to paise and round to nearest integer to avoid floating point inaccuracies
  return Math.round(parsed * 100);
}

/**
 * Convert paise into raw rupee decimal string for form inputs (e.g. 150000 -> "1500", 15050 -> "1500.50")
 */
export function paiseToInputString(paise: number): string {
  if (isNaN(paise) || paise === 0) return '';
  const rupees = paise / 100;
  return paise % 100 === 0 ? rupees.toString() : rupees.toFixed(2);
}
