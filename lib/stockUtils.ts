/**
 * Stock calculation utilities for Ice Cream in KGs
 * Core conversion: 12 Single Scoops = 1 KG (1 single scoop = 1/12 KG = 0.08333 KG)
 */

export function getItemKgWeight(variantName?: string, explicitWeightInKg?: number): number {
  if (explicitWeightInKg !== undefined && explicitWeightInKg > 0) {
    return explicitWeightInKg;
  }

  const name = (variantName || "").toLowerCase().trim();

  // 12 single scoops = 1 KG
  if (name.includes("single") || name.includes("1 scoop") || name === "single scoop") {
    return 1 / 12; // ~0.08333 KG
  }

  // 6 double scoops = 1 KG (2 scoops per portion)
  if (name.includes("double") || name.includes("2 scoop") || name === "double scoop") {
    return 2 / 12; // ~0.16667 KG
  }

  // 4 triple scoops = 1 KG
  if (name.includes("triple") || name.includes("3 scoop")) {
    return 3 / 12; // 0.250 KG
  }

  // Standard volume packs
  if (name.includes("100ml") || name.includes("small (100ml)") || name === "small") {
    return 0.100;
  }

  if (name.includes("250ml") || name.includes("medium (250ml)") || name === "medium") {
    return 0.250;
  }

  if (name.includes("500ml") || name.includes("family pack") || name.includes("half kg")) {
    return 0.500;
  }

  if (
    name.includes("1000ml") ||
    name.includes("1kg") ||
    name.includes("1 kg") ||
    name.includes("1 litre") ||
    name.includes("1 liter") ||
    name.includes("party tub") ||
    name.includes("party pack")
  ) {
    return 1.000;
  }

  // Default unit portion: 1 unit = 1 KG
  return 1.0;
}

/**
 * Format KG stock nicely (e.g. 5 KG, 4.917 KG, 0.5 KG)
 */
export function formatKgStock(stockInKg: number): string {
  const num = Number(stockInKg) || 0;
  if (num % 1 === 0) {
    return `${num.toFixed(0)} KG`;
  }
  // Trim trailing zeros after 3 decimal places
  return `${parseFloat(num.toFixed(3))} KG`;
}

/**
 * Approximate scoops count for a given KG weight
 * (1 KG = 12 scoops)
 */
export function getApproximateScoops(stockInKg: number): number {
  return Math.max(0, Math.floor((Number(stockInKg) || 0) * 12));
}
