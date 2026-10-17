import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Detail from "@/pages/manager-approval-detail";
import ChangePin from "@/pages/change-pin";

// A tiny fake of the Supabase query builder: every method returns the same chain,
// and awaiting it (or calling .single()) resolves with whatever the test queued.
const h = vi.hoisted(() => {
  const results: unknown[] = [];
  const calls: { method: string; args: unknown[] }[] = [];
  const next = () => Promise.resolve(results.shift() ?? { data: null, error: null });
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "update", "limit"]) {
    chain[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return chain;
    };
  }
  chain["single"] = () => next();
  chain["then"] = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => next().then(res, rej);
  return {
    results,
    calls,
    chain,
    getSession: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn(),
    rpc: vi.fn(),
  };
});

const { mockPinAuth } = vi.hoisted(() => ({ mockPinAuth: vi.fn() }));
vi.mock("@/lib/staffAdmin", () => ({ pinAuth: mockPinAuth, staffAdmin: mockPinAuth, pinSignIn: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: h.getSession, signOut: h.signOut, updateUser: h.updateUser },
    from: () => h.chain,
    rpc: h.rpc,
  },
}));

beforeEach(() => {
  h.results.length = 0;
  h.calls.length = 0;
  vi.clearAllMocks();
  h.getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
  h.signOut.mockResolvedValue({ error: null });
});
afterEach(cleanup);

const reg = {
  id: "r1", full_name: "Test Resident", phone: "0800", email: "t@e.com", house_number: "99", house_unit: "boys",
  status: "pending", created_at: new Date().toISOString(), nok_name: "Kin", nok_phone: "0801", nok_relationship: "Brother",
};

describe("Estate Manager approval", () => {
  it("approves a pending resident and confirms exactly one row changed", async () => {
    h.results.push(
      { data: { id: "u1", role: "estate_manager", status: "active", full_name: "EM" }, error: null }, // useManager
      { data: reg, error: null }, // load registration
      { data: [{ id: "r1" }], error: null }, // update
    );
    render(
      <MemoryRouter initialEntries={["/manager/approvals/r1"]}>
        <Routes>
          <Route path="/manager/approvals/:id" element={<Detail />} />
          <Route path="/manager/approvals" element={<p>LIST</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("LIST")).toBeInTheDocument();
    const upd = h.calls.find((c) => c.method === "update");
    expect(upd?.args[0]).toEqual({ status: "active" });
  });

  it("shows a message when nothing was actually changed", async () => {
    h.results.push(
      { data: { id: "u1", role: "estate_manager", status: "active", full_name: "EM" }, error: null },
      { data: reg, error: null },
      { data: [], error: null },
    );
    render(
      <MemoryRouter initialEntries={["/manager/approvals/r1"]}>
        <Routes><Route path="/manager/approvals/:id" element={<Detail />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nothing was changed");
  });
});

describe("Change PIN", () => {
  it("saves a new PIN, clears the flag and goes home", async () => {
    h.results.push({ data: { role: "resident", status: "active", must_change_pin: true, full_name: "T R", house_number: "99", house_unit: "boys" }, error: null });
    mockPinAuth.mockResolvedValue({ ok: true });
    render(
      <MemoryRouter initialEntries={["/change-pin"]}>
        <Routes>
          <Route path="/change-pin" element={<ChangePin />} />
          <Route path="/home" element={<p>HOME</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: "Save PIN" });
    for (const d of "482915") fireEvent.click(screen.getByRole("button", { name: d }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm 6 digits" })).toHaveClass("bg-mint-light"));
    for (const d of "482915") fireEvent.click(screen.getByRole("button", { name: d }));
    fireEvent.click(screen.getByRole("button", { name: "Save PIN" }));
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    expect(mockPinAuth).toHaveBeenCalledWith({ action: "change_pin", pin: "482915" });
  });

  it("refuses an easy PIN", async () => {
    h.results.push({ data: { role: "resident", status: "active", must_change_pin: true, full_name: "T R", house_number: "99", house_unit: "boys" }, error: null });
    render(
      <MemoryRouter initialEntries={["/change-pin"]}>
        <Routes><Route path="/change-pin" element={<ChangePin />} /></Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: "Save PIN" });
    for (const d of "111111") fireEvent.click(screen.getByRole("button", { name: d }));
    expect(await screen.findByRole("alert")).toHaveTextContent("too easy");
  });
});
