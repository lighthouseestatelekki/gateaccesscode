import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  supported: true,
  signIn: vi.fn(),
  register: vi.fn(),
  single: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/passkey", async (orig) => {
  const real = await orig<typeof import("@/lib/passkey")>();
  return {
    ...real,
    passkeySupported: async () => h.supported,
    signInWithPasskey: h.signIn,
    registerPasskey: h.register,
    myPasskeys: async () => [],
  };
});
vi.mock("@/lib/staffAdmin", () => ({ pinSignIn: vi.fn(), pinAuth: vi.fn(), staffAdmin: vi.fn(), deviceId: () => "d" }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u1" } } } }),
      signOut: h.signOut,
    },
    from: () => ({ select: () => ({ eq: () => ({ single: h.single }) }) }),
  },
}));

import Login from "@/pages/login";
import { FingerprintOffer } from "@/components/lh/Fingerprint";

function openLogin() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<p>HOME PAGE</p>} />
        <Route path="/change-pin" element={<p>CHANGE PIN</p>} />
        <Route path="/manager/approvals" element={<p>APPROVALS</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.supported = true;
  // First call: the "already signed in?" check on the login screen finds nobody active.
  h.single.mockResolvedValueOnce({ data: null, error: { message: "none" } });
  localStorage.setItem("lh.house", JSON.stringify({ number: "14", unit: "Duplex" }));
});
afterEach(() => {
  localStorage.clear();
  cleanup();
});

describe("Fingerprint sign-in (residents)", () => {
  it("fingerprint is the first choice once it is on for this phone, PIN stays as backup", async () => {
    localStorage.setItem("lh.passkey", "1");
    h.signIn.mockResolvedValue("resident");
    h.single.mockResolvedValueOnce({ data: { role: "resident", status: "active", must_change_pin: false, house_number: "14", house_unit: "main" }, error: null });
    openLogin();
    const btn = await screen.findByRole("button", { name: /Sign in with fingerprint/ });
    expect(screen.getByText("or enter your PIN")).toBeInTheDocument();
    expect(screen.getByText("Enter your PIN")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(await screen.findByText("HOME PAGE")).toBeInTheDocument();
  });

  it("a cancelled fingerprint shows a friendly message and keeps the PIN pad", async () => {
    localStorage.setItem("lh.passkey", "1");
    h.signIn.mockRejectedValue(new Error("The fingerprint check was cancelled. Try again, or use your PIN."));
    openLogin();
    fireEvent.click(await screen.findByRole("button", { name: /Sign in with fingerprint/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cancelled");
    expect(screen.getByText("Enter your PIN")).toBeInTheDocument();
  });

  it("phones that can't do fingerprints see no fingerprint option", async () => {
    h.supported = false;
    openLogin();
    await screen.findByText("Enter your PIN");
    expect(screen.queryByText(/Sign in with fingerprint/)).toBeNull();
  });

  it("the offer card turns it on, and can be dismissed for good", async () => {
    h.register.mockResolvedValue(undefined);
    const { unmount } = render(<FingerprintOffer />);
    fireEvent.click(await screen.findByRole("button", { name: "Turn on" }));
    expect(await screen.findByText(/Next time, sign in with your fingerprint/)).toBeInTheDocument();
    expect(h.register).toHaveBeenCalled();
    unmount();

    render(<FingerprintOffer />);
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Sign in with your fingerprint")).toBeNull();
    expect(localStorage.getItem("lh.passkeyOffer")).toBe("1");
  });
});
