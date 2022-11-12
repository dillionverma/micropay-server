import { Order, supabase } from "../services/supabase.service";

const tableName = "Orders";

/**
 * Find an order by its uuid
 * @param uuid uuid of the order
 * @returns the order
 */
export const findOrderByUUID = async (uuid: string): Promise<Order> => {
  const { data, error } = await supabase
    .from<Order>(tableName)
    .select("*")
    .eq("uuid", uuid)
    .single();

  if (error) throw error;

  return data;
};

/**
 * Update an order
 * @param uuid uuid of the order
 * @param order new order data
 * @returns
 */
export const updateOrder = async (
  uuid: string,
  order: Partial<Order>
): Promise<Order> => {
  const { data, error } = await supabase
    .from<Order>(tableName)
    .update(order)
    .eq("uuid", uuid)
    .single();

  if (error) throw error;

  return data;
};
