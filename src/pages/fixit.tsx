import { Link } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Plus, X } from "lucide-react";
import { BottomSheet, Button, Field, Hero, Screen, Sheet } from "@/components/lh/ui";
import { ResidentTabs } from "@/components/lh/nav";
import { FixitCard } from "@/components/lh/FixitCard";
import { CATEGORIES, compressPhoto, FIXIT_COLUMNS, photoUrls, uploadPhoto, type Fixit } from "@/lib/fixit";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import { useResident } from "@/lib/useResident";
import { cn } from "@/lib/utils";

export const title = "Fix-It";

/** Residents report estate problems and follow them to done. */
function FixitPage() {
  const profile = useResident();
  const me = useMe();
  const [list, setList] = useState<Fixit[] | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  const [cat, setCat] = useState("streetlight");
  const [desc, setDesc] = useState("");
  const [loc, setLoc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("fixit_requests").select(FIXIT_COLUMNS).order("created_at", { ascending: false }).limit(50);
    const rows = (data ?? []) as Fixit[];
    setList(rows);
    setPhotos(await photoUrls(rows.map((r) => r.photo_path).filter((p): p is string => !!p)));
  }, []);
  useEffect(() => {
    if (profile) load();
  }, [profile, load]);

  function startReport() {
    setCat("streetlight");
    setDesc("");
    setLoc(profile ? `Near House ${profile.house_number}` : "");
    setFile(null);
    setPreview("");
    setError("");
    setOpen(true);
  }

  async function submit() {
    if (desc.trim().length < 5) return setError("Please describe the problem in a few words.");
    if (!me) return;
    setBusy(true);
    setError("");
    try {
      const path = file ? await uploadPhoto(me.id, await compressPhoto(file)) : null;
      const { data, error: err } = await supabase.rpc("report_fixit", { p_category: cat, p_description: desc.trim(), p_location: loc.trim() || null, p_photo_path: path });
      if (err) throw new Error(err.message);
      setOpen(false);
      setDone(`Thank you. Request #${(data as Fixit).ref} was sent to the Estate Manager. You'll get an alert as it moves along.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (!profile) return null;
  const active = (list ?? []).filter((r) => r.status !== "done");
  const finished = (list ?? []).filter((r) => r.status === "done");

  return (
    <Screen>
      <Hero>
        <Link to="/more" aria-label="Back" className="-ml-2 flex size-11 items-center justify-center rounded-full"><ArrowLeft className="size-6" /></Link>
        <h1 className="mt-2 text-3xl font-semibold">Fix-It</h1>
        <p className="mt-1 text-deep-foreground/75">Report a problem in the estate. Follow it until it's fixed.</p>
      </Hero>
      <Sheet className="space-y-4 pb-6">
        <Button onClick={startReport}><Plus className="size-5" /> Report a problem</Button>
        {done && <p role="status" className="rounded-2xl bg-mint-lightest p-3 text-sm font-medium text-deep">{done}</p>}
        {list && list.length === 0 && (
          <div className="rounded-[22px] border-2 border-dashed border-border p-6 text-center">
            <p className="font-semibold">Nothing reported yet</p>
            <p className="mt-1 text-sm text-text-2">Streetlight out? Blocked drain? Tell the Estate Manager here.</p>
          </div>
        )}
        {active.length > 0 && <ul className="space-y-3">{active.map((r) => <FixitCard key={r.id} r={r} photo={r.photo_path ? photos[r.photo_path] : undefined} />)}</ul>}
        {finished.length > 0 && (
          <section>
            <h2 className="mb-2 mt-2 text-lg font-bold">Fixed</h2>
            <ul className="space-y-3">{finished.map((r) => <FixitCard key={r.id} r={r} photo={r.photo_path ? photos[r.photo_path] : undefined} />)}</ul>
          </section>
        )}
      </Sheet>
      <ResidentTabs />

      <BottomSheet open={open} onClose={() => !busy && setOpen(false)} title="Report a problem">
        <div className="space-y-4 pb-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-text-2">What is it about?</p>
            <div role="radiogroup" aria-label="What is it about?" className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                return (
                  <button key={c.key} type="button" role="radio" aria-checked={cat === c.key} onClick={() => setCat(c.key)} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] text-xs font-semibold", cat === c.key ? "border-primary bg-mint-light text-deep" : "border-border bg-card text-text-2")}>
                    <Icon className="size-5" />{c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-2">What's wrong?</span>
            <textarea value={desc} maxLength={1000} rows={3} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. The streetlight has been off for 3 nights" className="w-full rounded-2xl border-[1.5px] border-border bg-card px-4 py-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
          </label>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <Field label="Where?" value={loc} maxLength={200} onChange={(e) => setLoc(e.target.value)} />
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setPreview(f ? URL.createObjectURL(f) : "");
                }}
              />
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="Your photo" className="size-12 rounded-2xl object-cover" />
                  <button type="button" aria-label="Remove photo" onClick={() => { setFile(null); setPreview(""); if (fileRef.current) fileRef.current.value = ""; }} className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-deep text-white"><X className="size-3.5" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="flex h-12 items-center gap-2 rounded-2xl border-[1.5px] border-border bg-card px-4 text-sm font-semibold text-deep"><Camera className="size-5" /> Photo</button>
              )}
            </div>
          </div>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send to Estate Manager"}</Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}

export default FixitPage;
