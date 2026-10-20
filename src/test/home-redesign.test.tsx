import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: { entries: 9, staff_entries: 3, codes_created: 5, per_day: [{ day: "2026-10-14", n: 1 }, { day: "2026-10-15", n: 0 }, { day: "2026-10-16", n: 4 }] } })),
  },
}));
vi.mock("@/lib/push", () => ({ alertStatus: vi.fn(async () => "on"), enableAlerts: vi.fn() }));
vi.mock("@/lib/install", () => ({ isInstalled: () => true, promptInstall: vi.fn() }));

import { InsightsSnapshot } from "@/components/lh/InsightsSnapshot";
import { ExploreGrid } from "@/components/lh/ExploreGrid";
import { SetupCard } from "@/components/lh/SetupCard";
import { TodayCarousel } from "@/components/lh/TodayCarousel";

describe("Home redesign", () => {
  beforeEach(() => localStorage.clear());

  it("Insights snapshot shows three numbers and opens full insights", async () => {
    render(<MemoryRouter><InsightsSnapshot /></MemoryRouter>);
    expect(await screen.findByText("Visitors")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument(); // 9 entries - 3 staff
    expect(screen.getByRole("link", { name: /Open full insights/ })).toHaveAttribute("href", "/insights");
  });

  it("Explore grid links to the hidden features", () => {
    render(<MemoryRouter><ExploreGrid /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Fix-It" })).toHaveAttribute("href", "/fixit");
    expect(screen.getByRole("link", { name: "All features" })).toHaveAttribute("href", "/more");
  });

  it("setup card goes away for good once every step is done", async () => {
    const { container } = render(<MemoryRouter><SetupCard userId="u1" hasCodes /></MemoryRouter>);
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem("lh.setupDone")).toBe("1");
  });

  it("prayer times and hadith sit in one swipeable card", () => {
    render(<MemoryRouter><TodayCarousel /></MemoryRouter>);
    expect(screen.getByText("Next prayer")).toBeInTheDocument();
    expect(screen.getByText("Daily hadith")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Daily hadith" })).toBeInTheDocument();
  });
});
