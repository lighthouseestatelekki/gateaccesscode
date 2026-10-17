import { CloudRain, Droplets, Lightbulb, Route, ShieldAlert, Trash2, Wrench, Zap, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type FixitStatus = "open" | "in_progress" | "done";
export type Fixit = {
  id: string; ref: number; raised_by: string; full_name: string; house_number: string; house_unit: string;
  category: string; description: string; location: string | null; photo_path: string | null;
  status: FixitStatus; manager_note: string | null; created_at: string; updated_at: string;
};

export const CATEGORIES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "streetlight", label: "Streetlight", icon: Lightbulb },
  { key: "drainage", label: "Drainage", icon: CloudRain },
  { key: "water", label: "Water", icon: Droplets },
  { key: "power", label: "Power", icon: Zap },
  { key: "road", label: "Road", icon: Route },
  { key: "waste", label: "Waste", icon: Trash2 },
  { key: "security", label: "Security", icon: ShieldAlert },
  { key: "other", label: "Other", icon: Wrench },
];
export const categoryOf = (k: string) => CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[CATEGORIES.length - 1]!;

export const STATUS_LABEL: Record<FixitStatus, string> = { open: "Open", in_progress: "In progress", done: "Done" };
export const STATUS_CHIP: Record<FixitStatus, string> = {
  open: "bg-gold-light text-gold-text",
  in_progress: "bg-mint-light text-deep",
  done: "bg-muted text-text-2",
};

export const FIXIT_COLUMNS = "id,ref,raised_by,full_name,house_number,house_unit,category,description,location,photo_path,status,manager_note,created_at,updated_at";

/** Shrinks a phone photo to at most 1280px wide JPEG (~200-400 KB) before upload. */
export async function compressPhoto(file: File, max = 1280): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("That photo could not be read. Please try another."));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not prepare the photo."))), "image/jpeg", 0.82));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Uploads into the resident's own folder; returns the stored path. */
export async function uploadPhoto(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("fixit").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Short-lived links for private photos. */
export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from("fixit").createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
  return out;
}
