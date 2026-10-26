/**
 * Maximum supported amount: ₹100 Crores (100,00,00,000 Rupees) in paise.
 */
export const MAX_AMOUNT_PAISE = 100_00_00_000 * 100;

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
 * Validates and safely converts an amount input string into integer paise.
 * Rejects empty, 0, negative, NaN, Infinity, scientific notation (1e5),
 * more than 2 decimal places, and values exceeding MAX_AMOUNT_PAISE.
 */
export function validateAmount(
  input: string,
  options?: { maxPaise?: number; allowZero?: boolean }
): { valid: boolean; paise: number; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, paise: 0, error: 'Amount is required' };
  }

  // Remove currency symbol, commas, and whitespace
  const sanitized = input.replace(/[₹,\s]/g, '').trim();
  if (!sanitized) {
    return { valid: false, paise: 0, error: 'Amount is required' };
  }

  // Reject scientific notation (e.g. 1e5, 1E5)
  if (/[eE]/.test(sanitized)) {
    return { valid: false, paise: 0, error: 'Scientific notation is not allowed' };
  }

  // Reject negatives
  if (sanitized.startsWith('-')) {
    return { valid: false, paise: 0, error: 'Amount cannot be negative' };
  }

  // Check valid decimal format (max 2 decimals)
  if (!/^\d+(\.\d{1,2})?$/.test(sanitized)) {
    if (/^\d+\.\d{3,}$/.test(sanitized)) {
      return { valid: false, paise: 0, error: 'Maximum 2 decimal places allowed' };
    }
    return { valid: false, paise: 0, error: 'Please enter a valid positive number' };
  }

  const [wholeStr, fracStr = ''] = sanitized.split('.');
  const whole = parseInt(wholeStr, 10);
  const frac = parseInt((fracStr + '00').slice(0, 2), 10);

  if (isNaN(whole) || isNaN(frac) || !isFinite(whole) || !isFinite(frac)) {
    return { valid: false, paise: 0, error: 'Please enter a valid number' };
  }

  // Pure integer arithmetic: avoiding floating point operations
  const paise = whole * 100 + frac;

  if (paise === 0 && !options?.allowZero) {
    return { valid: false, paise: 0, error: 'Amount must be greater than ₹0' };
  }

  const maxPaise = options?.maxPaise ?? MAX_AMOUNT_PAISE;
  if (paise > maxPaise) {
    return {
      valid: false,
      paise: 0,
      error: `Amount exceeds maximum limit (${formatINR(maxPaise)})`,
    };
  }

  return { valid: true, paise };
}

/**
 * Parse an INR input string (e.g. "₹1,25,000.50", "125000.5", "500") into paise as an integer.
 * Always returns a clean non-negative integer paise. Returns 0 if invalid.
 */
export function parseINRInput(input: string): number {
  const result = validateAmount(input, { allowZero: true });
  return result.valid ? result.paise : 0;
}

/**
 * Convert paise into raw rupee decimal string for form inputs (e.g. 150000 -> "1500", 15050 -> "1500.50")
 */
export function paiseToInputString(paise: number): string {
  if (isNaN(paise) || paise === 0) return '';
  const rupees = Math.floor(Math.abs(paise) / 100);
  const remainder = Math.abs(paise) % 100;
  if (remainder === 0) {
    return (paise < 0 ? '-' : '') + rupees.toString();
  }
  const fracStr = String(remainder).padStart(2, '0');
  return `${paise < 0 ? '-' : ''}${rupees}.${fracStr}`;
}
