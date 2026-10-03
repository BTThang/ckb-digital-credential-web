import { Route, Routes } from "react-router-dom";

import { AppLayout } from "@/layouts";
import CredentialDetailPage from "@/pages/CredentialDetailPage";
import CredentialsPage from "@/pages/CredentialsPage";
import HomePage from "@/pages/HomePage";
import IssuedCredentialsPage from "@/pages/IssuedCredentialsPage";
import IssuePage from "@/pages/IssuePage";
import MyCredentialsPage from "@/pages/MyCredentialsPage";
import NotFoundPage from "@/pages/NotFoundPage";
import ProfilePage from "@/pages/ProfilePage";
import TransactionsPage from "@/pages/TransactionsPage";
import VerifyPage from "@/pages/VerifyPage";
import RequireAuth from "@/routes/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        {/* Public: verifying a credential must never require an account. */}
        <Route path="credentials" element={<CredentialsPage />} />
        <Route path="credentials/:id" element={<CredentialDetailPage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="issue" element={<IssuePage />} />

        {/* Session-gated. */}
        <Route
          path="my"
          element={
            <RequireAuth>
              <MyCredentialsPage />
            </RequireAuth>
          }
        />
        <Route
          path="issued"
          element={
            <RequireAuth>
              <IssuedCredentialsPage />
            </RequireAuth>
          }
        />
        <Route
          path="profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
