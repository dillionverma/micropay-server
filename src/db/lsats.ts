import { supabase } from "../services/supabase.service";

const tableName = "lsats";
export type LsatRow = {
  id: number;
  token: string;
  price: number;
  purchase_quantity: number;
  remaining_quantity: number;
};

export const findLsatByToken = async (
  token: string
): Promise<LsatRow | null> => {
  const { data, error } = await supabase
    .from<LsatRow>(tableName)
    .select("*")
    .eq("token", token)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return data;
};

export const insertLsat = async (
  token: string,
  price: number,
  purchase_quantity: number,
  remaining_quantity: number
): Promise<LsatRow> => {
  if (price < 1 || purchase_quantity < 1) {
    throw new Error("Invalid price or quantity");
  }

  const { data, error } = await supabase
    .from<LsatRow>(tableName)
    .insert({ token, price, purchase_quantity, remaining_quantity })
    .single();

  if (error) {
    throw error;
  }

  return data;
};
