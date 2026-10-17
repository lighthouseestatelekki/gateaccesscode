import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const title = "Health check";

/** Temporary page: proves the app can reach the Supabase database. Remove before launch. */
function Health() {
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    supabase.from("profiles").select("id").limit(1).then(({ data, error }) => {
      if (error) setState({ ok: false, text: `${error.message} (code: ${error.code})` });
      else setState({ ok: true, text: `Rows returned: ${data?.length ?? 0}` });
    });
  }, []);
  return (
    <div className="p-4">
      {!state && <p className="text-lg">Checking…</p>}
      {state?.ok && (
        <>
          <h1 className="text-2xl font-bold">Connected to Supabase. The database answered.</h1>
          <p className="mt-2 text-lg">{state.text}</p>
        </>
      )}
      {state && !state.ok && <p className="text-lg font-semibold text-red-600">{state.text}</p>}
    </div>
  );
}

export default Health;
