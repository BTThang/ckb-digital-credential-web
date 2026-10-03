import { useHealth } from "@/context/HealthProvider";

/**
 * Shows the network and chain tip, and degrades honestly: an unreachable node
 * is reported as "RPC degraded" rather than being hidden.
 */
export default function NetworkBadge() {
  const { health, loading, error } = useHealth();

  if (loading && !health) {
    return <span className="badge">Checking chain…</span>;
  }
  if (error || !health) {
    return <span className="badge badge-melted badge-dot">API offline</span>;
  }
  if (!health.chain.reachable) {
    return <span className="badge badge-pending badge-dot">RPC degraded</span>;
  }

  return (
    <span
      className="badge badge-verified badge-dot"
      title={`${health.chain.rpcUrl} · tip ${
        health.chain.tipBlockNumber ?? "unknown"
      }`}
    >
      {health.chain.network} · tip {health.chain.tipBlockNumber ?? "—"}
    </span>
  );
}
