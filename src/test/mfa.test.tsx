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
  strong: false,
  keys: 0,
  mustChange: false,
  updateUser: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      updateUser: h.updateUser,
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
    rpc: async (name: string) => {
      h.rpc(name);
      return { data: name === "is_strong_session" ? h.strong : null, error: null };
    },
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === "passkeys"
            ? Promise.resolve({ count: h.keys })
            : { single: async () => ({ data: { role: "estate_manager", status: "active", must_change_pin: h.mustChange } }) },
      }),
    }),
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
  fireEvent.click(screen.getByRole("button", { name: "Sign in with password" }));
}
const type = (d: string) => { for (const c of d) fireEvent.click(screen.getByRole("button", { name: c })); };

beforeEach(() => {
  h.verify.mockReset();
  h.enroll.mockReset();
  h.aal = { currentLevel: "aal1", nextLevel: "aal2" };
  h.strong = false;
  h.keys = 0;
  h.mustChange = false;
  h.updateUser.mockReset();
  h.rpc.mockReset();
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

  it("signed in with a fingerprint: counts as two-step, straight in", async () => {
    h.strong = true;
    open();
    await password();
    expect(await screen.findByText("APPROVALS")).toBeInTheDocument();
  });

  it("has a fingerprint but no authenticator: asks for the fingerprint, not a set-up", async () => {
    h.aal = { currentLevel: "aal1", nextLevel: "aal1" };
    h.keys = 1;
    open();
    await password();
    expect(await screen.findByText("Confirm it's you")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm with fingerprint" })).toBeInTheDocument();
    expect(h.enroll).not.toHaveBeenCalled();
  });

  it("new Estate Manager with a temporary password chooses their own first", async () => {
    h.mustChange = true;
    h.updateUser.mockResolvedValue({ error: null });
    open();
    await password();
    expect(await screen.findByText("Choose your own password")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New password (at least 10 characters)"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Type it again"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at least 10");
    fireEvent.change(screen.getByLabelText("New password (at least 10 characters)"), { target: { value: "a-long-new-password" } });
    fireEvent.change(screen.getByLabelText("Type it again"), { target: { value: "a-long-new-password" } });
    h.mustChange = false;
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    await waitFor(() => expect(h.updateUser).toHaveBeenCalledWith({ password: "a-long-new-password" }));
    expect(h.rpc).toHaveBeenCalledWith("clear_must_change_pin");
  });
});
