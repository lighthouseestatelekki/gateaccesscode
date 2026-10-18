import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ pinAuth: vi.fn(), setSession: vi.fn(async () => ({ data: {}, error: null })) }));
vi.mock("@/lib/useMe", () => ({ useMe: () => ({ id: "u-aisha", role: "resident", status: "active", full_name: "Aisha Bello", phone: null, house_number: "14", house_unit: "main", guard_number: null }) }));
vi.mock("@/lib/staffAdmin", () => ({ pinAuth: h.pinAuth, deviceId: () => "dev-1" }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { setSession: h.setSession, signOut: vi.fn() } } }));

import { AppLock } from "@/components/lh/AppLock";
import { LOCK_AFTER_MS, shouldLock } from "@/lib/applock";

const token = (sub: string) => `x.${btoa(JSON.stringify({ sub }))}.y`;
const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppLock /></MemoryRouter>);
const type = (d: string) => { for (const c of d) fireEvent.click(screen.getByRole("button", { name: c })); };

beforeEach(() => {
  localStorage.clear();
  h.pinAuth.mockReset();
  h.setSession.mockClear();
});

describe("App lock", () => {
  it("stays open when the app was used recently", () => {
    localStorage.setItem("lh.active", String(Date.now() - 60_000));
    at("/home");
    expect(screen.queryByRole("dialog", { name: "App locked" })).toBeNull();
  });

  it("locks after hours unused, and unlocks with the resident's own PIN", async () => {
    localStorage.setItem("lh.active", String(Date.now() - LOCK_AFTER_MS - 1000));
    h.pinAuth.mockResolvedValue({ access_token: token("u-aisha"), refresh_token: "r" });
    at("/home");
    expect(screen.getByRole("dialog", { name: "App locked" })).toBeInTheDocument();
    expect(screen.getByText("Welcome back, Aisha")).toBeInTheDocument();
    type("482915");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "App locked" })).toBeNull());
    expect(h.pinAuth).toHaveBeenCalledWith(expect.objectContaining({ action: "login", house_number: "14", house_unit: "main", pin: "482915" }));
    expect(h.setSession).toHaveBeenCalled();
    expect(shouldLock()).toBe(false);
  });

  it("does not unlock with another household member's PIN", async () => {
    h.pinAuth.mockResolvedValue({ access_token: token("u-yusuf"), refresh_token: "r" });
    at("/codes");
    type("246810");
    expect(await screen.findByRole("alert")).toHaveTextContent("someone else");
    expect(h.setSession).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "App locked" })).toBeInTheDocument();
  });

  it("never covers the sign-in or staff screens", () => {
    at("/login");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
