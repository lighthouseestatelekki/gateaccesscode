import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { QuickDelivery } from "@/components/lh/QuickDelivery";

function Created() {
  const s = useLocation().state as { holder_name: string; delivery: boolean };
  return <p>created {s.holder_name} {String(s.delivery)}</p>;
}

describe("Quick delivery pass", () => {
  beforeEach(() => rpc.mockReset());

  it("one tap makes a 30-minute code named Delivery and opens the share screen", async () => {
    rpc.mockResolvedValue({ data: { code: "123456", holder_name: "Delivery", valid_to: "x", valid_from: "y", type: "guest" }, error: null });
    const before = Date.now();
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<QuickDelivery />} />
          <Route path="/code-created" element={<Created />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /quick delivery pass/i }));
    await waitFor(() => expect(screen.getByText("created Delivery true")).toBeInTheDocument());
    const [fn, args] = rpc.mock.calls[0] as [string, { p_holder_name: string; p_valid_to: string }];
    expect(fn).toBe("create_guest_code");
    expect(args.p_holder_name).toBe("Delivery");
    const mins = (new Date(args.p_valid_to).getTime() - before) / 60_000;
    expect(mins).toBeGreaterThan(29.9);
    expect(mins).toBeLessThan(30.1);
  });

  it("shows the reason if it cannot be made", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Only active residents can create codes" } });
    render(<MemoryRouter><QuickDelivery variant="chip" /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only active residents");
  });
});
