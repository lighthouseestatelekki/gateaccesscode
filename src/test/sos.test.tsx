import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SosWatcher } from "@/components/lh/SosWatcher";

const h = vi.hoisted(() => ({ me: null as unknown, list: [] as unknown[], rpc: vi.fn() }));
vi.mock("@/lib/useMe", () => ({ useMe: () => h.me }));
vi.mock("@/lib/useSos", () => ({ useOpenSos: () => ({ list: h.list, reload: vi.fn() }), startAlarm: () => () => {} }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: h.rpc } }));

const alert = {
  id: "s1", raised_by: "r2", full_name: "Kabir Hassan", phone: "0809 555 0177", house_number: "31", house_unit: "ground",
  status: "active", created_at: new Date().toISOString(), acknowledged_by_name: null, acknowledged_at: null,
};

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ error: null });
});
afterEach(cleanup);

const show = () => render(<MemoryRouter><SosWatcher /></MemoryRouter>);

describe("SOS alerts", () => {
  it("shows guards a full-screen alert with house, name and phone, and acknowledges it", async () => {
    h.me = { id: "g7", role: "guard", status: "active" };
    h.list = [alert];
    show();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("House 31 · Ground Floor");
    expect(screen.getByText("Kabir Hassan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /0809 555 0177/ })).toHaveAttribute("href", "tel:0809 555 0177");
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    await vi.waitFor(() => expect(h.rpc).toHaveBeenCalledWith("acknowledge_sos", { p_id: "s1" }));
  });

  it("shows residents a banner without staff buttons", () => {
    h.me = { id: "r1", role: "resident", status: "active" };
    h.list = [alert];
    show();
    expect(screen.getByRole("alert")).toHaveTextContent("SOS · House 31");
    expect(screen.queryByRole("button", { name: "Resolved" })).toBeNull();
  });

  it("lets the Estate Manager mark an acknowledged SOS as a false alarm", async () => {
    h.me = { id: "em", role: "estate_manager", status: "active" };
    h.list = [{ ...alert, status: "acknowledged", acknowledged_by_name: "Guard 7" }];
    show();
    expect(screen.getByRole("alert")).toHaveTextContent("Guard 7 is responding");
    fireEvent.click(screen.getByRole("button", { name: "False alarm" }));
    await vi.waitFor(() => expect(h.rpc).toHaveBeenCalledWith("close_sos", { p_id: "s1", p_outcome: "false_alarm" }));
  });

  it("shows nothing when there is no open SOS", () => {
    h.me = { id: "r1", role: "resident", status: "active" };
    h.list = [];
    const { container } = show();
    expect(container).toBeEmptyDOMElement();
  });
});
