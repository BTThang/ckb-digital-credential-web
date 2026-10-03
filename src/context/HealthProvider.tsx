import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api } from "@/services/api";
import type { HealthReport } from "@/types";

interface HealthState {
  health: HealthReport | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const HealthContext = createContext<HealthState | null>(null);

export function useHealth(): HealthState {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error("useHealth must be used inside <HealthProvider>");
  }
  return context;
}

const POLL_INTERVAL_MS = 30_000;

export function HealthProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setHealth(await api.health());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "API unreachable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  const value = useMemo<HealthState>(
    () => ({ health, loading, error, reload }),
    [health, loading, error, reload],
  );

  return (
    <HealthContext.Provider value={value}>{children}</HealthContext.Provider>
  );
}
