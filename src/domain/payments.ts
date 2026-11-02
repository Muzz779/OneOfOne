/**
 * Payment helpers shared by checkout, the order page and admin (CLAUDE.md §19).
 */

/** Payment.provider for bank transfers confirmed by the owner in admin. */
export const EFT_PROVIDER = "eft";

/**
 * The reference a customer types on a bank transfer. Short, letters + digits
 * only (bank apps reject symbols and cap reference length), unique per order,
 * and with no letter that reads like a digit (O/0, I/1): "#1042" → "PAY1042".
 */
export function eftReference(orderNumber: string): string {
  return `PAY${orderNumber.replace(/\D/g, "")}`;
}
