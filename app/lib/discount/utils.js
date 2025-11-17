/**
 * Types de discount
 */
export const DiscountType = {
  PERCENTAGE: "PERCENTAGE",
  FIXED: "FIXED",
  FIXED_PRICE: "FIXED_PRICE",
};

/**
 * Calcule le prix discounté selon le type de discount
 */
export function calculateDiscountedPrice(basePrice, discountType, discountValue) {
  switch (discountType) {
    case DiscountType.PERCENTAGE:
      return Math.max(0, basePrice * (1 - discountValue / 100));
    
    case DiscountType.FIXED:
      return Math.max(0, basePrice - discountValue);
    
    case DiscountType.FIXED_PRICE:
      return discountValue;
    
    default:
      return basePrice;
  }
}

/**
 * Formate le prix pour l'affichage
 */
export function formatPrice(price) {
  return price.toFixed(2);
}

/**
 * Formate la valeur de discount pour l'affichage
 */
export function formatDiscountValue(discountType, discountValue) {
  switch (discountType) {
    case DiscountType.PERCENTAGE:
      return `${discountValue}%`;
    case DiscountType.FIXED:
    case DiscountType.FIXED_PRICE:
      return `${discountValue} DKK`;
    default:
      return String(discountValue);
  }
}

