import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ rpc: vi.fn(), rows: [] as unknown[] }));
vi.mock("@/lib/useResident", () => ({ useResident: () => ({ role: "resident", status: "active", must_change_pin: false, full_name: "Aisha Bello", house_number: "14", house_unit: "main" }) }));
vi.mock("@/lib/useMe", () => ({ useMe: () => ({ id: "a1", role: "resident", status: "active" }) }));
vi.mock("@/lib/useInbox", () => ({ useInbox: () => ({ unread: 0, items: [], markAllRead() {} }) }));
vi.mock("@/lib/photo", () => ({ photoToJpeg: async () => "data:image/jpeg;base64,FACE" }));
vi.mock("@/lib/supabase", () => {
  const q = { select: () => q, eq: () => q, order: async () => ({ data: h.rows, error: null }) };
  return { supabase: { rpc: (...a: unknown[]) => h.rpc(...a), from: () => q } };
});

import Join from "@/pages/join";
import Staff from "@/pages/staff";

const emp = (over: Record<string, unknown>) => ({
  id: "c1", code: "482910", holder_name: "Chinedu", days_of_week: null, start_time: null, end_time: null, days_of_month: null, employee_id: "e1",
  employees: { id: "e1", full_name: "Chinedu Okafor", phone: "0803", job_title: "Driver", approved_at: null, onboarding: "invited", invite_expires_at: null, review_note: null,
    photo: null, id_type: null, id_last4: null, kin_kind: null, kin_name: null, kin_phone: null, kin_relation: null, submitted_at: null, ...over },
});

beforeEach(() => h.rpc.mockReset());

describe("Staff fill in their own details from a link", () => {
  const openJoin = () => render(<MemoryRouter initialEntries={["/join/tok123"]}><Routes><Route path="/join/:token" element={<Join />} /></Routes></MemoryRouter>);

  it("checks every part, then sends it with consent", async () => {
    h.rpc.mockImplementation(async (fn: string) => fn === "staff_invite_info"
      ? { data: { status: "open", full_name: "Chinedu", job_title: "Driver", house: "14", unit: "main", note: null, phone: null }, error: null }
      : { data: { status: "submitted" }, error: null });
    const { container } = openJoin();
    expect(await screen.findByText(/Driver for House 14 · Duplex/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send my details" }));
    expect(screen.getByRole("alert")).toHaveTextContent("photo of your face");
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "f.jpg", { type: "image/jpeg" })] } });
    await screen.findByAltText("Your photo");
    fireEvent.change(screen.getByLabelText("Full name (as on your ID)"), { target: { value: "Chinedu Okafor" } });
    fireEvent.change(screen.getByLabelText("Your phone number"), { target: { value: "0803 111 2222" } });
    fireEvent.click(screen.getByRole("radio", { name: "NIN" }));
    fireEvent.change(screen.getByLabelText("Last 4 digits of the ID number"), { target: { value: "48-21" } });
    fireEvent.click(screen.getByRole("radio", { name: "Guarantor" }));
    fireEvent.change(screen.getByLabelText("Their full name"), { target: { value: "Mr Obi" } });
    fireEvent.change(screen.getByLabelText("Their phone"), { target: { value: "0805 222 3333" } });
    fireEvent.click(screen.getByRole("button", { name: "Send my details" }));
    expect(screen.getByRole("alert")).toHaveTextContent("tick the box");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Send my details" }));
    await screen.findByText(/Details sent/);
    expect(h.rpc).toHaveBeenLastCalledWith("staff_invite_submit", expect.objectContaining({
      p_token: "tok123", p_full_name: "Chinedu Okafor", p_id_type: "NIN", p_id_last4: "4821", p_kin_kind: "guarantor", p_photo: "data:image/jpeg;base64,FACE", p_consent: true,
    }));
  });

  it("explains a dead link", async () => {
    h.rpc.mockResolvedValue({ data: { status: "expired" }, error: null });
    openJoin();
    expect(await screen.findByText("This link has expired")).toBeInTheDocument();
  });
});

describe("Resident reviews staff", () => {
  it("adding staff gives a link to send, and the code is not shown until approved", async () => {
    h.rows = [emp({})];
    h.rpc.mockResolvedValue({ data: { invite: "tokABC" }, error: null });
    render(<MemoryRouter><Staff /></MemoryRouter>);
    expect(await screen.findByText("Not active yet")).toBeInTheDocument();
    expect(screen.queryByText("482 910")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Add staff/ }));
    fireEvent.change(screen.getAllByLabelText("Full name")[0]!, { target: { value: "Musa Ali" } });
    fireEvent.click(screen.getByRole("button", { name: "Add and get their link" }));
    expect(await screen.findByText("Send Musa their link")).toBeInTheDocument();
  });

  it("approves submitted details", async () => {
    h.rows = [emp({ onboarding: "submitted", photo: "data:image/jpeg;base64,FACE", id_type: "NIN", id_last4: "4821", kin_kind: "guarantor", kin_name: "Mr Obi", kin_phone: "0805" })];
    h.rpc.mockResolvedValue({ data: {}, error: null });
    render(<MemoryRouter><Staff /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Review their details/ }));
    expect(screen.getByText("NIN ending 4821")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Approve/ }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("review_staff", { p_employee_id: "e1", p_approve: true, p_note: null }));
  });

  it("sending back needs a reason", async () => {
    h.rows = [emp({ onboarding: "submitted" })];
    h.rpc.mockResolvedValue({ data: {}, error: null });
    render(<MemoryRouter><Staff /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Review their details/ }));
    fireEvent.click(screen.getByRole("button", { name: /send back/i }));
    fireEvent.click(screen.getByRole("button", { name: "Send back to fix" }));
    expect(screen.getByRole("alert")).toHaveTextContent("what they should fix");
    fireEvent.change(screen.getByLabelText("What should they fix?"), { target: { value: "Photo is blurry" } });
    fireEvent.click(screen.getByRole("button", { name: "Send back to fix" }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("review_staff", { p_employee_id: "e1", p_approve: false, p_note: "Photo is blurry" }));
  });
});
