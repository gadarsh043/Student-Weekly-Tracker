import TopNav from './TopNav';
import { useAuth } from '../../hooks/useAuth';

/**
 * Shared layout wrapper for non-Home pages (Admin, Metrics, Grades).
 * Provides the persistent TopNav with navigation links.
 */
export default function PageLayout({ children }) {
  const { user, profile, isAdmin, logout } = useAuth();

  return (
    <div className="app-shell">
      <TopNav
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        onLogout={logout}
        onEditProfile={() => {}}
      />
      <div className="app-shell__body">
        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}
