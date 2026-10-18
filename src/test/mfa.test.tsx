import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  aal: { currentLevel: "aal1", nextLevel: "aal2" } as { currentLevel: string; nextLevel: string },
  factors: { totp: [{ id: "f1", status: "verified" }], all: [{ id: "f1", status: "verified" }] } as { totp: { id: string; status: string }[]; all: { id: string; status: string }[] },
  verify: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInWithPassword: async () => ({ data: { user: { id: "em" } }, error: null }),
      signOut: h.signOut,
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: h.aal }),
        listFactors: async () => ({ data: h.factors }),
        challengeAndVerify: h.verify,
        enroll: h.enroll,
        unenroll: h.unenroll,
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: "estate_manager", status: "active" } }) }) }) }),
  },
}));

import ManagerLogin from "@/pages/manager-login";

function open() {
  render(
    <MemoryRouter initialEntries={["/manager/login"]}>
      <Routes>
        <Route path="/manager/login" element={<ManagerLogin />} />
        <Route path="/manager/approvals" element={<p>APPROVALS</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
async function password() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "em@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}
const type = (d: string) => { for (const c of d) fireEvent.click(screen.getByRole("button", { name: c })); };

beforeEach(() => {
  h.verify.mockReset();
  h.enroll.mockReset();
  h.aal = { currentLevel: "aal1", nextLevel: "aal2" };
});

describe("Estate Manager two-step sign-in", () => {
  it("asks for the authenticator code after the password, then lets them in", async () => {
    h.verify.mockResolvedValue({ error: null });
    open();
    await password();
    expect(await screen.findByText("Enter your authenticator code")).toBeInTheDocument();
    type("123456");
    expect(await screen.findByText("APPROVALS")).toBeInTheDocument();
    expect(h.verify).toHaveBeenCalledWith({ factorId: "f1", code: "123456" });
  });

  it("a wrong code keeps them out", async () => {
    h.verify.mockResolvedValue({ error: { message: "Invalid TOTP code entered" } });
    open();
    await password();
    await screen.findByText("Enter your authenticator code");
    type("000000");
    expect(await screen.findByRole("alert")).toHaveTextContent("not right");
    expect(screen.queryByText("APPROVALS")).toBeNull();
  });

  it("first time: shows the QR code to set up the authenticator", async () => {
    h.aal = { currentLevel: "aal1", nextLevel: "aal1" };
    h.enroll.mockResolvedValue({ data: { id: "f2", totp: { qr_code: "data:image/svg+xml;utf8,<svg/>", secret: "ABCDEFGHIJKLMNOP" } }, error: null });
    h.verify.mockResolvedValue({ error: null });
    open();
    await password();
    expect(await screen.findByText("Protect this account")).toBeInTheDocument();
    expect(await screen.findByAltText("QR code for your authenticator app")).toBeInTheDocument();
    expect(screen.getByText("ABCD EFGH IJKL MNOP")).toBeInTheDocument();
    type("654321");
    await waitFor(() => expect(h.verify).toHaveBeenCalledWith({ factorId: "f2", code: "654321" }));
    expect(await screen.findByText("APPROVALS")).toBeInTheDocument();
  });
});
