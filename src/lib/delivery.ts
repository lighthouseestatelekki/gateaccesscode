import { supabase } from "@/lib/supabase";

// Quick Delivery pass: one tap, no typing. A one-visit code named "Delivery" that works
// for 30 minutes (one entry and one exit), for dispatch riders and food deliveries.

export const DELIVERY_NAME = "Delivery";
export const DELIVERY_MINUTES = 30;

export type CreatedCode = { code: string; holder_name: string; valid_to: string; valid_from: string; type: string; delivery?: boolean };

export async function createDeliveryPass(now = new Date()): Promise<CreatedCode> {
  const validTo = new Date(now.getTime() + DELIVERY_MINUTES * 60_000);
  const { data, error } = await supabase.rpc("create_guest_code", { p_holder_name: DELIVERY_NAME, p_valid_to: validTo.toISOString() });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as CreatedCode;
  return { code: row.code, holder_name: row.holder_name, valid_to: row.valid_to, valid_from: row.valid_from, type: row.type, delivery: true };
}
