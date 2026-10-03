import { Link } from "react-router-dom";

import { EmptyState } from "@/components/ui";

export default function NotFoundPage() {
  return (
    <EmptyState
      icon="404"
      title="Page not found"
      large
      action={
        <div className="row">
          <Link className="btn btn-primary" to="/">
            Go home
          </Link>
          <Link className="btn" to="/verify">
            Verify a credential
          </Link>
        </div>
      }
    >
      That route does not exist. If you followed a Spore link, the credential is
      still verifiable from the Verify page.
    </EmptyState>
  );
}
