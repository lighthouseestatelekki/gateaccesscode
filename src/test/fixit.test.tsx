import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ rows: [] as unknown[], rpc: vi.fn() }));
vi.mock("@/lib/useResident", () => ({ useResident: () => ({ role: "resident", status: "active", must_change_pin: false, full_name: "Aisha Bello", house_number: "14", house_unit: "main" }) }));
vi.mock("@/lib/useManager", () => ({ useManager: () => ({ id: "em", role: "estate_manager", status: "active", full_name: "EM" }) }));
vi.mock("@/lib/useMe", () => ({ useMe: () => ({ id: "u1", role: "resident", status: "active" }) }));
vi.mock("@/lib/useInbox", () => ({ useInbox: () => ({ unread: 0, items: [], markAllRead() {} }) }));
vi.mock("@/lib/supabase", () => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "order", "eq", "neq"]) chain[k] = () => chain;
  chain["limit"] = () => Promise.resolve({ data: h.rows, error: null });
  return {
    supabase: {
      from: () => chain,
      rpc: h.rpc,
      storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }), upload: async () => ({ error: null }) }) },
      auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    },
  };
});

import FixitPage from "@/pages/fixit";
import ManagerFixit from "@/pages/manager-fixit";

const row = { id: "f1", ref: 7, raised_by: "u1", full_name: "Aisha Bello", house_number: "14", house_unit: "main", category: "streetlight", description: "Light is off", location: "Near House 14", photo_path: null, status: "open", manager_note: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

beforeEach(() => {
  h.rows = [];
  h.rpc.mockReset();
});

describe("Fix-It", () => {
  it("resident reports a problem with sensible defaults", async () => {
    h.rpc.mockResolvedValue({ data: { ...row, ref: 8 }, error: null });
    render(<MemoryRouter><FixitPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Report a problem/ }));
    expect(screen.getByRole("radio", { name: /Streetlight/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Where?")).toHaveValue("Near House 14");
    fireEvent.click(screen.getByRole("radio", { name: /Drainage/ }));
    fireEvent.change(screen.getByLabelText("What's wrong?"), { target: { value: "Gutter is blocked" } });
    fireEvent.click(screen.getByRole("button", { name: "Send to Estate Manager" }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("report_fixit", { p_category: "drainage", p_description: "Gutter is blocked", p_location: "Near House 14", p_photo_path: null }));
    expect(await screen.findByText(/Request #8 was sent/)).toBeInTheDocument();
  });

  it("asks for a description before sending", async () => {
    render(<MemoryRouter><FixitPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Report a problem/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send to Estate Manager" }));
    expect(screen.getByRole("alert")).toHaveTextContent("describe the problem");
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("Estate Manager starts work with a note for the resident", async () => {
    h.rows = [row];
    h.rpc.mockResolvedValue({ data: row, error: null });
    render(<MemoryRouter><ManagerFixit /></MemoryRouter>);
    expect(await screen.findByText("Light is off")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Note to the resident for request 7"), { target: { value: "Electrician on Monday" } });
    fireEvent.click(screen.getByRole("button", { name: "Start work" }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("set_fixit_status", { p_id: "f1", p_status: "in_progress", p_note: "Electrician on Monday" }));
  });
});
