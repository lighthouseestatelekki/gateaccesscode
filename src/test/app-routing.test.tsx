import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ home: null as string | null }));
vi.mock("@/lib/entry", async (orig) => ({
  ...(await orig<typeof import("@/lib/entry")>()),
  homeForSession: async () => session.home,
}));

import App from "@/App";
import Welcome from "@/pages/welcome";
import { setStaffChoice } from "@/lib/entry";

function at(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<p>resident sign-in</p>} />
        <Route path="/home" element={<p>resident home</p>} />
        <Route path="/guard/login" element={<p>guard sign-in</p>} />
        <Route path="/guard/verify" element={<p>gate screen</p>} />
        <Route path="/manager/approvals" element={<p>manager approvals</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Front door", () => {
  beforeEach(() => {
    session.home = null;
    setStaffChoice(null);
  });

  it("shows the welcome cards when signed out, then Get started opens resident sign-in", async () => {
    at("/");
    expect(await screen.findByText(/invite visitors in seconds/i, undefined, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText(/quick, safe entry at the gate/i)).toBeInTheDocument();
    expect(screen.getByText(/help when you need it/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /staff sign-in/i })).toHaveAttribute("href", "/guard/login");
    fireEvent.click(screen.getByRole("link", { name: /get started/i }));
    expect(await screen.findByText("resident sign-in")).toBeInTheDocument();
  });

  it.each([
    ["/home", "resident home"],
    ["/guard/verify", "gate screen"],
    ["/manager/approvals", "manager approvals"],
  ])("sends a signed-in person straight to %s", async (home, text) => {
    session.home = home;
    at("/");
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("opens guard sign-in on the gate phone that last signed in as a guard", async () => {
    setStaffChoice("guard");
    at("/");
    expect(await screen.findByText("guard sign-in")).toBeInTheDocument();
  });

  it("falls back to the front door for an unknown address", async () => {
    render(<MemoryRouter initialEntries={["/no-such-page"]}><App /></MemoryRouter>);
    expect(await screen.findByText(/invite visitors in seconds/i, undefined, { timeout: 2000 })).toBeInTheDocument();
  });
});
