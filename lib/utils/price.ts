/**
 * Calculate the discounted price from original price and discount percentage
 * @param price Original price
 * @param discount Discount percentage (e.g., 10 for 10%)
 * @returns Discounted price
 */
export function calculateDiscountedPrice(price: number, discount: number): number {
  if (!discount || discount <= 0) return price;
  return price * (1 - discount / 100);
}

/**
 * Get the effective selling price (with discount applied if available)
 * @param price Original price
 * @param discount Optional discount percentage
 * @returns Effective selling price
 */
export function getEffectivePrice(price: number, discount?: number): number {
  if (!discount || discount <= 0) return price;
  return calculateDiscountedPrice(price, discount);
}

