import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GuardLogin from "@/pages/guard-login";
import Verify from "@/pages/guard-verify";
import GuardVerdictAccess from "@/pages/guard-verdict-access";

const { mockSignInWithPassword, mockSignOut, mockGetSession, mockSingle, mockRpc } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetSession: vi.fn(),
  mockSingle: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/useMe", () => ({ useMe: () => null }));

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
    rpc: mockRpc,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockSignOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
});

function enterPin(digits: string) {
  for (const d of digits) {
    fireEvent.click(screen.getByRole("button", { name: d }));
  }
}

describe("Guard login and verification", () => {
  it("shows 'Guard number or PIN is incorrect.' when guard sign-in has wrong PIN", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    render(
      <MemoryRouter initialEntries={["/guard/login"]}>
        <Routes>
          <Route path="/guard/login" element={<GuardLogin />} />
          <Route path="/guard/verify" element={<p>VERIFY PAGE</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Guard number"), { target: { value: "07" } });
    enterPin("123456");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Guard number or PIN is incorrect.");
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ kind: "guard", guard_number: "7", pin: "123456" });
  });

  it("verify with result 'access' navigates to /guard/verdict/access with the state", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "guard-1" } } },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: {
        role: "guard",
        status: "active",
        full_name: "Sule Danjuma",
        guard_number: 7,
        assigned_gate: 1,
      },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: {
        result: "access",
        direction: "in",
        reason: null,
        type: "guest",
        house: "14",
        unit: "main",
        holder: "Ibrahim Yusuf",
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/guard/verify"]}>
        <Routes>
          <Route path="/guard/verify" element={<Verify />} />
          <Route path="/guard/verdict/access" element={<GuardVerdictAccess />} />
          <Route path="/guard/login" element={<p>GUARD LOGIN</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Gate 1 · Guard 7")).toBeInTheDocument();
    enterPin("184302");

    expect(await screen.findByText("ACCESS")).toBeInTheDocument();
    expect(screen.getByText("IN")).toBeInTheDocument();
    expect(screen.getByText("Ibrahim Yusuf")).toBeInTheDocument();
    expect(screen.getByText("House 14 · Main house")).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(mockRpc).toHaveBeenCalledWith("verify_code", { p_code: "184302" });
  });

  it("the access page shows 'OUT' when direction is 'out'", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/guard/verdict/access",
            state: {
              result: "access",
              direction: "out",
              reason: null,
              type: "guest",
              house: "14",
              unit: "main",
              holder: "Ibrahim Yusuf",
            },
          },
        ]}
      >
        <Routes>
          <Route path="/guard/verdict/access" element={<GuardVerdictAccess />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("OUT")).toBeInTheDocument();
    expect(screen.getByText("Ibrahim Yusuf")).toBeInTheDocument();
    expect(screen.getByText("House 14 · Main house")).toBeInTheDocument();
  });
});
