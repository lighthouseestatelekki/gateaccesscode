import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ rpc: vi.fn(), table: {} as Record<string, unknown> }));
vi.mock("@/lib/useResident", () => ({ useResident: () => ({ role: "resident", status: "active", must_change_pin: false, full_name: "Aisha Bello", house_number: "14", house_unit: "main" }) }));
vi.mock("@/lib/useMe", () => ({ useMe: () => ({ id: "a1", role: "resident", status: "active" }) }));
vi.mock("@/lib/useInbox", () => ({ useInbox: () => ({ unread: 0, items: [], markAllRead() {} }) }));
vi.mock("@/lib/supabase", () => {
  const q = (name: string) => {
    const self: Record<string, unknown> = {};
    const ret = () => self;
    Object.assign(self, { select: ret, eq: ret, in: ret, order: ret,
      limit: async () => ({ data: h.table[name] ?? [], error: null }),
      maybeSingle: async () => ({ data: h.table[name] ?? null, error: null }) });
    return self;
  };
  return { supabase: { rpc: (...a: unknown[]) => h.rpc(...a), from: (n: string) => q(n) } };
});

import Moving from "@/pages/moving";
import { PrivacyGate } from "@/components/lh/PrivacyGate";

beforeEach(() => { h.rpc.mockReset(); h.table = {}; });

describe("Moving out", () => {
  it("main resident asks to move out on a date", async () => {
    h.table = { move_outs: [], profiles: { household_role: "primary" } };
    h.rpc.mockResolvedValue({ data: {}, error: null });
    render(<MemoryRouter><Moving /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Tell the Estate Manager" }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("request_move_out", expect.objectContaining({ p_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), p_note: null })));
  });

  it("a household member is told to ask the main resident", async () => {
    h.table = { move_outs: [], profiles: { household_role: "member" } };
    render(<MemoryRouter><Moving /></MemoryRouter>);
    expect(await screen.findByText(/Only the main resident/)).toBeInTheDocument();
  });

  it("shows a pending request with a cancel button", async () => {
    h.table = { move_outs: [{ id: "m1", move_date: "2026-11-01", status: "requested", note: null }], profiles: { household_role: "primary" } };
    h.rpc.mockResolvedValue({ data: {}, error: null });
    render(<MemoryRouter><Moving /></MemoryRouter>);
    expect(await screen.findByText("Waiting for the Estate Manager")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel moving out" }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("cancel_move_out", { p_id: "m1" }));
  });
});

describe("Privacy notice", () => {
  it("asks once, then saves the agreement", async () => {
    h.table = { profiles: { privacy_version: null } };
    h.rpc.mockResolvedValue({ data: null, error: null });
    render(<MemoryRouter initialEntries={["/home"]}><PrivacyGate /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "I understand and agree" }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("accept_privacy", { p_version: 1 }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("does not ask people who already agreed", async () => {
    h.table = { profiles: { privacy_version: 1 } };
    render(<MemoryRouter initialEntries={["/home"]}><PrivacyGate /></MemoryRouter>);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
