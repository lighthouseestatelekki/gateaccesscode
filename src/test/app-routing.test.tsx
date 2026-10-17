import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "@/App";

describe("App routing", () => {
  it("sends / to the resident login page instead of a blank screen", () => {
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/welcome back/i);
  });

  it("falls back to login for an unknown address", () => {
    render(<MemoryRouter initialEntries={["/no-such-page"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/welcome back/i);
  });
});
