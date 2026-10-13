import { CURRENCY_MINOR_DIGITS, type CurrencyCode } from '../../types/finance.types';

/**
 * SP8A money helpers — integer minor units only. No floating-point arithmetic
 * is used for financial amounts anywhere in the ledger path.
 */

/** Convert a decimal major-unit amount (e.g. SP4 NUMERIC) to integer minor units. */
export function toMinorUnits(amountMajor: number, currency: CurrencyCode): number {
  if (!Number.isFinite(amountMajor) || amountMajor < 0) {
    throw new Error('Số tiền không hợp lệ (phải là số hữu hạn, không âm).');
  }
  const digits = CURRENCY_MINOR_DIGITS[currency];
  const minor = Math.round(amountMajor * 10 ** digits);
  if (!Number.isSafeInteger(minor)) {
    throw new Error('Số tiền vượt giới hạn số nguyên an toàn.');
  }
  // Round-trip check: rejects values with no exact minor-unit representation
  // (e.g. 10.5 VND has no meaning in dong; float dust like 19.9900000001).
  if (minor / 10 ** digits !== amountMajor) {
    throw new Error(`Số tiền ${amountMajor} không biểu diễn chính xác được ở đơn vị nhỏ nhất của ${currency}.`);
  }
  return minor;
}

/** Parse a user-entered decimal string strictly into minor units (no float parsing drift). */
export function parseMajorToMinor(input: string, currency: CurrencyCode): number {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error('Định dạng số tiền không hợp lệ.');
  }
  const digits = CURRENCY_MINOR_DIGITS[currency];
  const [intPart, fracPart = ''] = trimmed.split('.');
  // Zero-decimal currencies (VND/dong): any fractional input is rejected,
  // never silently truncated.
  if (digits === 0 && fracPart.length > 0 && Number(fracPart) !== 0) {
    throw new Error(`Số tiền ${currency} không có đơn vị thập phân — nhập số nguyên (đồng).`);
  }
  const padded = (fracPart + '0'.repeat(digits)).slice(0, digits);
  const minor = Number(intPart) * 10 ** digits + Number(padded || '0');
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    throw new Error('Số tiền không hợp lệ.');
  }
  return minor;
}

/** Format integer minor units for display using integer math (grouping + decimals). */
export function formatMinor(minor: number, currency: CurrencyCode): string {
  const digits = CURRENCY_MINOR_DIGITS[currency];
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const divisor = 10 ** digits;
  const majorPart = Math.floor(abs / divisor)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (digits === 0) return `${sign}${majorPart} ${currency}`;
  const frac = (abs % divisor).toString().padStart(digits, '0');
  return `${sign}${majorPart}.${frac} ${currency}`;
}

/** Sum minor units in a single currency; throws on mismatch or unsafe result. */
export function sumMinor(values: number[]): number {
  const total = values.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Tổng số tiền vượt giới hạn an toàn.');
  return total;
}

export function assertSameCurrency(currencies: CurrencyCode[]): CurrencyCode {
  const unique = [...new Set(currencies)];
  if (unique.length !== 1) {
    throw new Error(`Không được gộp nhiều loại tiền tệ khi chưa có chính sách chuyển đổi (thấy: ${unique.join(', ') || 'trống'}).`);
  }
  return unique[0];
}
