import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeExpiry, formatUntil } from "@/lib/expiry";
import CreateCode from "@/pages/create-code";
import CodeCreated from "@/pages/code-created";
import Home from "@/pages/home";

const { mockRpc, mockGetSession, mockSingle, mockSignOut, mockLimit } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
  mockSingle: vi.fn(),
  mockSignOut: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock("@/lib/useMe", () => ({ useMe: () => null }));
vi.mock("@/lib/useInbox", () => ({ useInbox: () => ({ items: [], unread: 0, reload: () => {}, markAllRead: () => {} }) }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signOut: mockSignOut,
    },
    from: vi.fn((table: string) => {
      if (table === "access_codes") {
        return {
          select: vi.fn(() => ({
            neq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: mockLimit,
              })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockSingle,
          })),
        })),
      };
    }),
    rpc: mockRpc,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: "user-1" } } },
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
  mockLimit.mockResolvedValue({ data: [], error: null });
  mockSignOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
});

describe("Expiry and formatting helpers (Lagos time UTC+01:00)", () => {
  it("computes Next 2 hours, Today, Tomorrow, This weekend, and Pick date and time", () => {
    // Friday 16 Oct 2026, 14:00 Lagos time (13:00 UTC)
    const now = new Date("2026-10-16T13:00:00.000Z");

    expect(computeExpiry("Next 2 hours", now).toISOString()).toBe("2026-10-16T15:00:00.000Z");
    // Today 23:59 Lagos = 22:59 UTC
    expect(computeExpiry("Today", now).toISOString()).toBe("2026-10-16T22:59:00.000Z");
    // Tomorrow 23:59 Lagos = 17 Oct 22:59 UTC
    expect(computeExpiry("Tomorrow", now).toISOString()).toBe("2026-10-17T22:59:00.000Z");
    // This weekend (coming Sunday 18 Oct 23:59 Lagos = 18 Oct 22:59 UTC)
    expect(computeExpiry("This weekend", now).toISOString()).toBe("2026-10-18T22:59:00.000Z");
    // Pick date and time in Lagos time
    expect(computeExpiry("Pick date and time", now, "2026-10-20T18:30").toISOString()).toBe(
      "2026-10-20T17:30:00.000Z",
    );
  });

  it("handles a case near midnight in Lagos time for computeExpiry and formatUntil", () => {
    // 2026-10-17T23:30:00Z is already Sunday 18 Oct 2026 00:30 in Lagos (UTC+1)
    const nearMidnightUtc = new Date("2026-10-17T23:30:00.000Z");

    // In Lagos, "Today" is already Sunday 18 Oct, so 23:59 Lagos is 2026-10-18T22:59:00.000Z
    const todayExpiry = computeExpiry("Today", nearMidnightUtc);
    expect(todayExpiry.toISOString()).toBe("2026-10-18T22:59:00.000Z");

    // Since it is Sunday in Lagos, "This weekend" is also today (Sunday 18 Oct 23:59 Lagos)
    expect(computeExpiry("This weekend", nearMidnightUtc).toISOString()).toBe(
      "2026-10-18T22:59:00.000Z",
    );

    // Same day in Lagos (18 Oct 18:00 Lagos = 17:00 UTC)
    expect(formatUntil(new Date("2026-10-18T17:00:00.000Z"), nearMidnightUtc)).toBe(
      "Until today, 6:00 PM",
    );

    // Next day in Lagos (19 Oct 23:59 Lagos = 22:59 UTC)
    expect(formatUntil(new Date("2026-10-19T22:59:00.000Z"), nearMidnightUtc)).toBe(
      "Until tomorrow, 11:59 PM",
    );

    // Otherwise (Sun 25 Oct 23:59 Lagos = 22:59 UTC)
    expect(formatUntil(new Date("2026-10-25T22:59:00.000Z"), nearMidnightUtc)).toBe(
      "Until Sun 25 Oct, 11:59 PM",
    );
  });
});

function openCreateCode() {
  render(
    <MemoryRouter initialEntries={["/create-code"]}>
      <Routes>
        <Route path="/create-code" element={<CreateCode />} />
        <Route path="/code-created" element={<CodeCreated />} />
        <Route path="/login" element={<p>LOGIN PAGE</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Create access code page", () => {
  it("calls rpc('create_guest_code') with trimmed name and ISO date, then navigates to /code-created", async () => {
    mockRpc.mockResolvedValue({
      data: {
        code: "184302",
        holder_name: "Ibrahim Yusuf",
        valid_to: "2026-10-17T22:59:00.000Z",
      },
      error: null,
    });

    openCreateCode();

    fireEvent.change(screen.getByLabelText("Visitor name"), {
      target: { value: "  Ibrahim Yusuf  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create code" }));

    expect(await screen.findByText("184 302")).toBeInTheDocument();
    expect(screen.getByText("Ibrahim Yusuf")).toBeInTheDocument();

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [fnName, args] = mockRpc.mock.calls[0]!;
    expect(fnName).toBe("create_guest_code");
    expect(args.p_holder_name).toBe("Ibrahim Yusuf");
    expect(() => new Date(args.p_valid_to).toISOString()).not.toThrow();
    expect(args.p_valid_to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("shows an error for an empty visitor name and does not call rpc", () => {
    openCreateCode();

    fireEvent.click(screen.getByRole("button", { name: "Create code" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please enter the visitor's name.");
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

function openHome() {
  render(
    <MemoryRouter initialEntries={["/home"]}>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/create-code" element={<CreateCode />} />
        <Route path="/login" element={<p>LOGIN PAGE</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Home access codes — Cancel, Extend, and Cancelled status", () => {
  it("Cancel calls rpc('cancel_my_code') with the code id", async () => {
    mockLimit.mockResolvedValue({
      data: [
        {
          id: "code-abc",
          code: "184302",
          holder_name: "Ibrahim Yusuf",
          valid_to: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          active: true,
          used_at: null,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: null });

    openHome();

    expect(await screen.findByText("184 302")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Cancel this code?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel code" }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("cancel_my_code", { p_code_id: "code-abc" });
    });
  });

  it("Extend with 'Tomorrow' calls rpc('extend_my_code') with the id and an ISO date", async () => {
    mockLimit.mockResolvedValue({
      data: [
        {
          id: "code-xyz",
          code: "184302",
          holder_name: "Ibrahim Yusuf",
          valid_to: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          active: true,
          used_at: null,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: null });

    openHome();

    expect(await screen.findByText("184 302")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Extend" }));
    fireEvent.click(screen.getByRole("button", { name: "Extend code" }));

    await waitFor(() => {
      expect(mockRpc.mock.calls.some((c) => c[0] === "extend_my_code")).toBe(true);
    });
    const [fnName, args] = mockRpc.mock.calls.find((c) => c[0] === "extend_my_code")!;
    expect(fnName).toBe("extend_my_code");
    expect(args.p_code_id).toBe("code-xyz");
    expect(args.p_valid_to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("a cancelled code shows 'Cancelled'", async () => {
    mockLimit.mockResolvedValue({
      data: [
        {
          id: "code-cancelled",
          code: "529117",
          holder_name: "Fatima Ade",
          valid_to: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          active: false,
          used_at: null,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    });

    openHome();

    expect(await screen.findByText("529 117")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create again" })).toBeInTheDocument();
  });
});

describe("Long Stay wording", () => {
  it("shows a date range for a stay that starts later, and 'Until' once it has started", async () => {
    const { formatValidity, lagosEndOf, lagosStartOf } = await import("@/lib/expiry");
    const now = new Date("2026-10-17T10:00:00Z"); // Sat 17 Oct, 11:00 AM Lagos
    expect(formatValidity({ type: "long_stay", valid_from: "2026-10-19T23:00:00Z", valid_to: "2026-10-25T22:59:00Z" }, now)).toBe("From Tue 20 Oct until Sun 25 Oct, 11:59 PM");
    expect(formatValidity({ type: "long_stay", valid_from: "2026-10-17T09:00:00Z", valid_to: "2026-10-18T22:59:00Z" }, now)).toBe("Until tomorrow, 11:59 PM");
    expect(lagosEndOf("2026-10-25").toISOString()).toBe("2026-10-25T22:59:00.000Z");
    expect(lagosStartOf("2026-10-17", now)).toEqual(now); // today starts now
    expect(lagosStartOf("2026-10-20", now).toISOString()).toBe("2026-10-19T23:00:00.000Z");
  });
});

describe("Gate message", () => {
  it("follows the estate's format, with host name but no phone number", async () => {
    const { gateMessage } = await import("@/lib/expiry");
    const m = gateMessage({ code: "543018", hostName: "Aisha Bello", houseNumber: "14", unitLabel: "Main house", whenLine: "Valid until: today, 7:21 PM" });
    expect(m.startsWith("Assalam Alaekum Waramotullahi Wabarakatu,\n\nWelcome to Lighthouse Estate Lekki.")).toBe(true);
    expect(m).toContain("🔑 Access code: 543 018");
    expect(m).toContain("🏠 Host: Aisha Bello, House 14 · Main house");
    expect(m).toContain("⏱️ Valid until: today, 7:21 PM");
    expect(m).toContain("Alcohol, indecent dressing and loud music are strictly prohibited.");
    expect(m).not.toMatch(/phone|\+234|080/i);
  });
});
