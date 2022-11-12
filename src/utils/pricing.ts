import { DISCOUNT_MAP, UNIT_PRICE_MAP } from "../constants";

export const getPriceSats = (units: number) => {
  return UNIT_PRICE_MAP[units];
};

export const getDiscountSats = (units: number) => {
  return DISCOUNT_MAP[units] * getPriceSats(units);
};

export const getDiscountPercent = (units: number) => {
  return DISCOUNT_MAP[units] * 100;
};

export const getFinalPriceSats = (units: number) => {
  return getPriceSats(units) - getDiscountSats(units);
};
