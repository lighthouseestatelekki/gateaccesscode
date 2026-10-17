import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement, type ComponentType, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import { Route } from "@/routes/register";

afterEach(() => { cleanup(); navigate.mockClear(); });

function openRegistration() {
  render(createElement(Route.options.component as ComponentType));
}

function openPinStep() {
  openRegistration();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

function enterPin(label: string, digits: string) {
  const group = within(screen.getByRole("group", { name: label }));
  for (const digit of digits) fireEvent.click(group.getByRole("button", { name: digit }));
}

describe("Registration rules", () => {
  it("shows one step at a time and retains details after going back", () => {
    openRegistration();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Aisha Bello" } });
    expect(screen.getByLabelText("Full name")).toBeVisible();
    expect(screen.getByLabelText("Relationship")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Full name")).not.toBeVisible();
    expect(screen.getByLabelText("Relationship")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Full name")).toHaveValue("Aisha Bello");
  });

  it("requires exactly six digits in both PIN entries before submission", () => {
    openPinStep();
    enterPin("Enter 6 digits", "246810");
    enterPin("Confirm your PIN", "24681");
    expect(screen.getByRole("button", { name: "Submit registration" })).toBeDisabled();
    enterPin("Confirm your PIN", "0");
    enterPin("Enter 6 digits", "9");
    const submit = screen.getByRole("button", { name: "Submit registration" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(navigate).toHaveBeenCalledWith({ to: "/pending" });
  });

  it("blocks differing PINs and permits submission after correction", () => {
    openPinStep();
    enterPin("Enter 6 digits", "246810");
    enterPin("Confirm your PIN", "246819");
    const submit = screen.getByRole("button", { name: "Submit registration" });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("group", { name: "Confirm your PIN" })).getByRole("button", { name: "Delete" }));
    enterPin("Confirm your PIN", "0");
    expect(submit).toBeEnabled();
  });
});