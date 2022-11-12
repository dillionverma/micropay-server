export const SATOSHI_PER_BTC = 100000000;

// Micropay V1 Pricing for Dalle Generations

// Max number of units that can be purchased at once
export const MAX_UNITS = 20;

// Price per unit in sats
export const UNIT_PRICE_MAP: { [key: number]: number } = {
  1: 1000,
  2: 2000,
  3: 3000,
  4: 4000,
  5: 5000,
  6: 6000,
  7: 7000,
  8: 8000,
  9: 9000,
  10: 10000,
  11: 11000,
  12: 12000,
  13: 13000,
  14: 14000,
  15: 15000,
  16: 16000,
  17: 17000,
  18: 18000,
  19: 19000,
  20: 20000,
};

// Discount percent per unit
export const DISCOUNT_MAP: { [key: number]: number } = {
  1: 0,
  2: 0.02,
  3: 0.03,
  4: 0.04,
  5: 0.05,
  6: 0.06,
  7: 0.07,
  8: 0.08,
  9: 0.09,
  10: 0.1,
  11: 0.11,
  12: 0.12,
  13: 0.13,
  14: 0.14,
  15: 0.15,
  16: 0.16,
  17: 0.17,
  18: 0.18,
  19: 0.19,
  20: 0.2,
};
