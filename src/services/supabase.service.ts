import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

export type Order = {
  uuid: string;
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
  email: string;
  model: string;
};

export type SessionRow = {
  id: string;
  created_at: Date;
  ip: string;
  session_id: string;
};

export const supabase = createClient(config.supabaseUrl, config.supabaseApiKey);
