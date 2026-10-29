import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VerifyPage from "@/pages/VerifyPage";
import type { CoreVerificationResult } from "@/types";

const listFamilies = vi.fn();
const verify = vi.fn();
const verifySporeId = vi.fn();
const lookupSpore = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    listFamilies: (...args: unknown[]) => listFamilies(...args),
    verify: (...args: unknown[]) => verify(...args),
    verifySporeId: (...args: unknown[]) => verifySporeId(...args),
    lookupSpore: (...args: unknown[]) => lookupSpore(...args),
  },
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => ({ address: null, restoring: false }),
}));

function unsupported(identifier: string): CoreVerificationResult {
  return {
    identifier,
    family: null,
    supported: false,
    routed: false,
    state: "unsupported",
    valid: false,
    reason: 'Unsupported credential family: "skillpass"',
    checkedAt: "2026-01-01T00:00:00.000Z",
    result: null,
    issuer: null,
  };
}

describe("VerifyPage - API family discovery", () => {
  beforeEach(() => {
    listFamilies.mockReset();
    verify.mockReset();
    verifySporeId.mockReset();
    lookupSpore.mockReset();
    verify.mockResolvedValue(unsupported("custom-credential"));
    lookupSpore.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a family returned by the API and routes to it", async () => {
    const user = userEvent.setup();
    listFamilies.mockResolvedValue([
      { family: "spore", description: "Spore credentials" },
      { family: "skillpass", description: "Skill-pass credentials" },
    ]);

    render(
      <MemoryRouter initialEntries={["/verify"]}>
        <VerifyPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("option", { name: "skillpass" }),
    ).toBeInTheDocument();
    // Spore is still the default when no family was requested.
    expect(screen.getByLabelText(/Credential family/i)).toHaveValue("spore");

    await user.selectOptions(
      screen.getByLabelText(/Credential family/i),
      "skillpass",
    );
    await user.type(
      screen.getByLabelText(/skillpass identifier/i),
      "custom-credential",
    );
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith({
        identifier: "custom-credential",
        family: "skillpass",
      });
    });
    // A family without a local rule must not be rejected client-side.
    expect(
      screen.queryByText(/not a skillpass identifier/i),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("Unsupported")).toBeInTheDocument();
  });

  it("falls back to the built-in families when discovery fails", async () => {
    listFamilies.mockRejectedValue(new Error("discovery offline"));

    render(
      <MemoryRouter initialEntries={["/verify"]}>
        <VerifyPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(listFamilies).toHaveBeenCalled();
    });
    expect(screen.getByRole("option", { name: "Spore" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Vellum claim (did:ckb)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "CKB-PoP" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Credential family/i)).toHaveValue("spore");
  });

  it("falls back when discovery returns no families", async () => {
    listFamilies.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/verify"]}>
        <VerifyPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(listFamilies).toHaveBeenCalled();
    });
    expect(screen.getByRole("option", { name: "Spore" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Credential family/i)).toHaveValue("spore");
  });

  it("restores a non-Spore deep link from the query string", async () => {
    listFamilies.mockResolvedValue([
      { family: "spore", description: "Spore credentials" },
      { family: "skillpass", description: "Skill-pass credentials" },
    ]);

    render(
      <MemoryRouter
        initialEntries={["/verify?id=custom-credential&family=skillpass"]}
      >
        <VerifyPage />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("custom-credential")).toBeInTheDocument();
    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith({
        identifier: "custom-credential",
        family: "skillpass",
      });
    });
  });
});
