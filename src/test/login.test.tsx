import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "@/pages/login";

const { mockSignInWithPassword, mockSignOut, mockGetSession, mockSingle } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetSession: vi.fn(),
  mockSingle: vi.fn(),
}));

vi.mock("@/lib/staffAdmin", () => ({
  pinSignIn: (...args: unknown[]) => mockSignInWithPassword(...args),
  pinAuth: vi.fn(),
  staffAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getSession: mockGetSession,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockSignOut.mockResolvedValue({ error: null });
  localStorage.setItem("lh.house", JSON.stringify({ number: "14", unit: "Main house" }));
});

afterEach(() => {
  localStorage.clear();
  cleanup();
});

function openLogin() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/pending" element={<p>PENDING PAGE</p>} />
        <Route path="/home" element={<p>HOME PAGE</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function enterPin(digits: string) {
  for (const d of digits) {
    fireEvent.click(screen.getByRole("button", { name: d }));
  }
}

describe("Resident login", () => {
  it("shows 'House number or PIN is incorrect.' for a wrong PIN", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    openLogin();
    enterPin("246810");

    expect(await screen.findByRole("alert")).toHaveTextContent("House number or PIN is incorrect.");
  });

  it("goes to /pending when resident status is pending", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: {
        role: "resident",
        status: "pending",
        must_change_pin: false,
        full_name: "Aisha Bello",
        house_number: "14",
        house_unit: "main",
      },
      error: null,
    });

    openLogin();
    enterPin("246810");

    expect(await screen.findByText("PENDING PAGE")).toBeInTheDocument();
  });

  it("goes to /home when resident status is active", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: {
        role: "resident",
        status: "active",
        must_change_pin: false,
        full_name: "Aisha Bello",
        house_number: "14",
        house_unit: "main",
      },
      error: null,
    });

    openLogin();
    enterPin("246810");

    expect(await screen.findByText("HOME PAGE")).toBeInTheDocument();
  });

  it("first time: house number, tap unit, then PIN signs in with the right unit", async () => {
    localStorage.clear();
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockSingle.mockResolvedValue({
      data: { role: "resident", status: "active", must_change_pin: false, full_name: "Aisha Bello", house_number: "31", house_unit: "boys" },
      error: null,
    });
    openLogin();
    expect(screen.queryByText("Guest chalet")).not.toBeInTheDocument();
    enterPin("31");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("radio").map((b) => b.textContent)).toEqual([
      "DuplexThe main house", "Ground FloorDownstairs flat", "First FloorUpstairs flat", "BQBoys' quarters",
    ]);
    fireEvent.click(screen.getByRole("radio", { name: /^BQ/ }));
    expect(await screen.findByText("Enter your PIN")).toBeInTheDocument();
    enterPin("246810");
    expect(await screen.findByText("HOME PAGE")).toBeInTheDocument();
    expect(mockSignInWithPassword).toHaveBeenCalledWith(expect.objectContaining({ house_number: "31", house_unit: "boys" }));
    expect(JSON.parse(localStorage.getItem("lh.house")!)).toEqual({ number: "31", unit: "BQ" });
  });

  it("still signs in a phone that remembered an old label like 'Main house'", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });
    openLogin();
    expect(screen.getByText("Duplex")).toBeInTheDocument();
    enterPin("246810");
    await screen.findByRole("alert");
    expect(mockSignInWithPassword).toHaveBeenCalledWith(expect.objectContaining({ house_unit: "main" }));
  });
});
