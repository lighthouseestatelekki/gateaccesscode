import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/useGuard", () => ({ useGuard: () => ({ role: "guard", status: "active", guard_number: "1", assigned_gate: 1 }) }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a) } }));

import { ShiftBar } from "@/components/lh/ShiftBar";
import GuardIncident from "@/pages/guard-incident";

beforeEach(() => h.rpc.mockReset());

describe("Guard shifts", () => {
  it("shows the last handover and clocks in", async () => {
    const handover = { note: "Gate light is faulty", at: new Date().toISOString(), guard_number: "3" };
    h.rpc.mockImplementation(async (fn: string) => ({ data: fn === "guard_clock_in" ? { on_duty: true, started_at: new Date().toISOString(), handover } : { on_duty: false, started_at: null, handover }, error: null }));
    render(<MemoryRouter><ShiftBar /></MemoryRouter>);
    expect(await screen.findByText(/Gate light is faulty/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Clock in/ }));
    expect(await screen.findByText(/On duty/)).toBeInTheDocument();
  });

  it("clocks out with a note for the next guard", async () => {
    h.rpc.mockImplementation(async (fn: string) => ({ data: fn === "guard_clock_out" ? { on_duty: false, started_at: null, handover: null } : { on_duty: true, started_at: new Date().toISOString(), handover: null }, error: null }));
    render(<MemoryRouter><ShiftBar /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Clock out" }));
    fireEvent.change(screen.getByLabelText(/Note for the next guard/), { target: { value: "All quiet" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Clock out" }).at(-1)!);
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("guard_clock_out", { p_note: "All quiet" }));
  });
});

describe("Incident reports", () => {
  it("sends the report with the house and unit", async () => {
    h.rpc.mockResolvedValue({ data: { ref: 7 }, error: null });
    render(<MemoryRouter><GuardIncident /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose what happened");
    fireEvent.click(screen.getByRole("radio", { name: "Suspicious person" }));
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "Man by the back fence" } });
    fireEvent.change(screen.getByPlaceholderText("House number"), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Duplex" }));
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByText("Report #7 sent")).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("report_incident", { p_category: "suspicious", p_description: "Man by the back fence", p_house: "14", p_unit: "main", p_photo: null });
  });
});
