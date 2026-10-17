import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import Register from "@/pages/register";

afterEach(cleanup);

function open() {
  render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/pending" element={<p>PENDING PAGE</p>} />
        <Route path="/login" element={<p>LOGIN PAGE</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const next = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));
function openPinStep() { open(); next(); next(); }
function enterPin(label: string, digits: string) {
  const group = within(screen.getByRole("group", { name: label }));
  for (const d of digits) fireEvent.click(group.getByRole("button", { name: d }));
}
const submit = () => screen.getByRole("button", { name: "Submit registration" });

describe("Registration rules", () => {
  it("shows one step at a time and keeps details after going back", () => {
    open();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Aisha Bello" } });
    expect(screen.getByLabelText("Full name")).toBeVisible();
    expect(screen.getByLabelText("Relationship")).not.toBeVisible();
    next();
    expect(screen.getByLabelText("Full name")).not.toBeVisible();
    expect(screen.getByLabelText("Relationship")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Full name")).toHaveValue("Aisha Bello");
  });

  it("needs six digits in both PIN entries before submitting", () => {
    openPinStep();
    enterPin("Enter 6 digits", "246810");
    enterPin("Confirm your PIN", "24681");
    expect(submit()).toBeDisabled();
    enterPin("Confirm your PIN", "0");
    expect(submit()).toBeEnabled();
    fireEvent.click(submit());
    expect(screen.getByText("PENDING PAGE")).toBeInTheDocument();
  });

  it("blocks PINs that differ, and allows submit once corrected", () => {
    openPinStep();
    enterPin("Enter 6 digits", "246810");
    enterPin("Confirm your PIN", "246819");
    expect(submit()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("PINs do not match");
    fireEvent.click(within(screen.getByRole("group", { name: "Confirm your PIN" })).getByRole("button", { name: "Delete" }));
    enterPin("Confirm your PIN", "0");
    expect(submit()).toBeEnabled();
  });
});
