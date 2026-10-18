import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ people: [] as unknown[], pinAuth: vi.fn() }));
vi.mock("@/lib/useResident", () => ({ useResident: () => ({ role: "resident", status: "active", must_change_pin: false, full_name: "Aisha Bello", house_number: "14", house_unit: "main" }) }));
vi.mock("@/lib/useMe", () => ({ useMe: () => ({ id: "a1", role: "resident", status: "active" }) }));
vi.mock("@/lib/useInbox", () => ({ useInbox: () => ({ unread: 0, items: [], markAllRead() {} }) }));
vi.mock("@/lib/staffAdmin", () => ({ pinAuth: h.pinAuth }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: async () => ({ data: h.people, error: null }) } }));

import Household from "@/pages/household";

const aisha = { id: "a1", full_name: "Aisha Bello", relation: null, household_role: "primary", member_no: null, status: "active", phone: null, is_me: true };
const yusuf = { id: "a3", full_name: "Yusuf Bello", relation: "Spouse", household_role: "member", member_no: 1, status: "active", phone: null, is_me: false };

beforeEach(() => h.pinAuth.mockReset());

describe("Household members", () => {
  it("main resident adds a member and gets their first PIN", async () => {
    h.people = [aisha];
    h.pinAuth.mockResolvedValue({ temp_pin: "583920" });
    render(<MemoryRouter><Household /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Add a household member/ }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Yusuf Bello" } });
    fireEvent.click(screen.getByRole("radio", { name: "Sibling" }));
    fireEvent.click(screen.getByRole("button", { name: "Add and get their PIN" }));
    await waitFor(() => expect(h.pinAuth).toHaveBeenCalledWith({ action: "add_member", full_name: "Yusuf Bello", phone: "", email: "", relation: "Sibling" }));
    expect(await screen.findByText("583 920")).toBeInTheDocument();
  });

  it("main resident removes a member", async () => {
    h.people = [aisha, yusuf];
    h.pinAuth.mockResolvedValue({ ok: true });
    render(<MemoryRouter><Household /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Yusuf Bello" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
    await waitFor(() => expect(h.pinAuth).toHaveBeenCalledWith({ action: "remove_member", profile_id: "a3" }));
  });

  it("a member sees the household but cannot add or remove", async () => {
    h.people = [{ ...aisha, is_me: false }, { ...yusuf, is_me: true }];
    render(<MemoryRouter><Household /></MemoryRouter>);
    expect(await screen.findByText(/Aisha Bello is the main resident/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add a household member/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });
});
