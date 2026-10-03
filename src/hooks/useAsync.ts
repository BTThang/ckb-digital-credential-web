import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (updater: T | ((current: T | null) => T | null)) => void;
}

/**
 * Runs an async loader whenever `deps` change and exposes the result.
 *
 * A stale response can never overwrite a newer one: every run gets a sequence
 * number and only the latest is allowed to commit. That matters here because
 * the pages refetch while a user is typing filters.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean } = {},
): AsyncState<T> {
  const enabled = options.enabled ?? true;
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);
  const sequence = useRef(0);

  // Callers pass an inline closure, so the loader identity changes on every
  // render. Keeping it in a ref lets the effect depend only on `deps` without
  // re-running on each render.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  // A single string key keeps the dependency array statically analysable; all
  // call sites pass primitives.
  const key = JSON.stringify(deps);

  useEffect(() => {
    if (!enabled) return;

    const run = ++sequence.current;
    setLoading(true);

    void loaderRef.current().then(
      (result) => {
        if (run !== sequence.current) return;
        setDataState(result);
        setError(null);
        setLoading(false);
      },
      (cause: unknown) => {
        if (run !== sequence.current) return;
        setError(
          cause instanceof Error ? cause.message : "Something went wrong",
        );
        setLoading(false);
      },
    );
  }, [key, nonce, enabled]);

  const setData = useCallback(
    (updater: T | ((current: T | null) => T | null)) => {
      setDataState((current) =>
        typeof updater === "function"
          ? (updater as (value: T | null) => T | null)(current)
          : updater,
      );
    },
    [],
  );

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, error, loading, reload, setData };
}
