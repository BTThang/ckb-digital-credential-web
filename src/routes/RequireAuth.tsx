import type { ReactNode } from "react";

import { Alert, Spinner } from "@/components/ui";
import { useAuth } from "@/context/AuthProvider";

/**
 * Gate for pages that need a session.
 *
 * It waits for the cookie check rather than refusing straight away, otherwise a
 * reload would bounce a signed-in user out for the few milliseconds it takes to
 * restore the session.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();

  if (initializing) return <Spinner label="Restoring your session…" />;

  if (!user) {
    return (
      <Alert kind="warning" title="Sign in required">
        Connect a wallet and sign in to open this page.
      </Alert>
    );
  }

  return <>{children}</>;
}
