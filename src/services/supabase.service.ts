import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

export type Order = {
  id: number;
  created_at: Date;
  invoice_id: string;
  invoice_request: string;
  generated: boolean;
  satoshis: number;
  results: string[];
  prompt: string;
  environment: string;
  refundInvoice: string;
  rating: number;
  feedback: string;
};

export const supabase = createClient(config.supabaseUrl, config.supabaseApiKey);
