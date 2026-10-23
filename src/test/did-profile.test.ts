import { beforeEach, describe, expect, it, vi } from "vitest";

const fromString = vi.fn();
const listDidCkbsByLock = vi.fn();

vi.mock("@ckb-ccc/ccc", () => ({
  ccc: {
    Address: {
      fromString: (...args: unknown[]) => fromString(...args),
    },
    didCkb: {
      listDidCkbsByLock: (...args: unknown[]) => listDidCkbsByLock(...args),
    },
  },
}));

const getCkbClient = vi.fn();

vi.mock("@/services/ckb/client", () => ({
  getCkbClient: (...args: unknown[]) => getCkbClient(...args),
}));

import { fetchDidProfiles } from "@/services/ckb/did-profile";

const ADDRESS = "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqgd605wl3fn6n6r0q8mjn58ewe77unewxqs5kpmy";

function record(did: string, document: unknown) {
  return { did, data: { value: { document } } };
}

describe("fetchDidProfiles", () => {
  beforeEach(() => {
    fromString.mockReset();
    listDidCkbsByLock.mockReset();
    getCkbClient.mockReset();
    getCkbClient.mockReturnValue({ fake: "client" });
    fromString.mockResolvedValue({ script: { fake: "lock" } });
    listDidCkbsByLock.mockResolvedValue([]);
  });

  it("does nothing without an address", async () => {
    expect(await fetchDidProfiles("")).toEqual([]);
    expect(getCkbClient).not.toHaveBeenCalled();
  });

  it("looks the profile up by the lock of the address itself", async () => {
    await fetchDidProfiles(ADDRESS);

    expect(fromString).toHaveBeenCalledWith(ADDRESS, { fake: "client" });
    expect(listDidCkbsByLock).toHaveBeenCalledWith({
      client: { fake: "client" },
      lock: { fake: "lock" },
      limit: 10,
    });
  });

  it("maps the DID document into a profile", async () => {
    listDidCkbsByLock.mockResolvedValue([
      record("did:ckb:fn7u37m7vwerr4ojysgdwwp4mescjtrp", {
        name: "Vellum SDK Testnet fixture",
        bio: "A fixture used by the release tests.",
        alsoKnownAs: ["Alice", "  ", "alice@example.com"],
        services: {
          fixture: { type: "VellumFixture", endpoint: "sdk-release" },
        },
      }),
    ]);

    const profiles = await fetchDidProfiles(ADDRESS);

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toEqual({
      did: "did:ckb:fn7u37m7vwerr4ojysgdwwp4mescjtrp",
      name: "Vellum SDK Testnet fixture",
      bio: "A fixture used by the release tests.",
      alsoKnownAs: ["Alice", "alice@example.com"],
      services: [{ id: "fixture", type: "VellumFixture" }],
    });
  });

  it("keeps a profile that carries no usable fields", async () => {
    listDidCkbsByLock.mockResolvedValue([
      record("did:ckb:hlvxrdt3e7iwvuxdmbvejp6hc4yoo3no", {
        services: { fixture: { type: "VellumFixture" } },
      }),
    ]);

    const profiles = await fetchDidProfiles(ADDRESS);

    expect(profiles).toEqual([
      {
        did: "did:ckb:hlvxrdt3e7iwvuxdmbvejp6hc4yoo3no",
        name: null,
        bio: null,
        alsoKnownAs: [],
        services: [{ id: "fixture", type: "VellumFixture" }],
      },
    ]);
  });

  it("survives a document that is not an object", async () => {
    listDidCkbsByLock.mockResolvedValue([
      record("did:ckb:abc", "not a document"),
    ]);

    const profiles = await fetchDidProfiles(ADDRESS);

    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.name).toBeNull();
    expect(profiles[0]?.services).toEqual([]);
  });

  it("fails closed when the address does not resolve on this network", async () => {
    fromString.mockRejectedValue(new Error("Invalid address"));

    expect(await fetchDidProfiles(ADDRESS)).toEqual([]);
  });

  it("fails closed when the chain cannot be read", async () => {
    listDidCkbsByLock.mockRejectedValue(new Error("indexer down"));

    expect(await fetchDidProfiles(ADDRESS)).toEqual([]);
  });
});
