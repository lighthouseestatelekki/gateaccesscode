import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: () => new Promise(() => {}), signOut: vi.fn(), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from: vi.fn(),
  },
}));

import { setCached } from "@/lib/profileCache";
import { useResident } from "@/lib/useResident";

function Name() {
  const p = useResident();
  return <p>{p ? p.full_name : "BLANK"}</p>;
}

describe("Moving between screens", () => {
  it("draws straight away for someone already signed in, while the server check is still running", () => {
    setCached("resident", { role: "resident", status: "active", must_change_pin: false, full_name: "Aisha Bello", house_number: "14", house_unit: "main" });
    render(<MemoryRouter><Name /></MemoryRouter>);
    expect(screen.getByText("Aisha Bello")).toBeInTheDocument();
  });
  it("still waits on the very first screen of a visit", () => {
    render(<MemoryRouter><Name /></MemoryRouter>);
    expect(screen.getByText("BLANK")).toBeInTheDocument();
  });
});
