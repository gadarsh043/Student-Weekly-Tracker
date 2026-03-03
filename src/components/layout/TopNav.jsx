import { Link } from 'react-router-dom';

export default function TopNav({
  user,
  profile,
  isAdmin,
  onLogout,
  onEditProfile,
}) {
  const displayName =
    profile?.first_name ||
    profile?.full_name ||
    user?.email?.split('@')[0] ||
    'User';

  return (
    <nav className="topnav">
      <div className="topnav__left">
        <Link to="/" className="topnav__title">CS-4485 Weekly Tracker</Link>
      </div>

      <div className="topnav__center">
        <Link to="/" className="topnav__link">Tracker</Link>
        {isAdmin && <Link to="/metrics" className="topnav__link">Metrics</Link>}
        {isAdmin && <Link to="/grades" className="topnav__link">Grades</Link>}
        {isAdmin && <Link to="/admin" className="topnav__link">Admin</Link>}
      </div>

      <div className="topnav__right">
        <div className="topnav__user">
          <span className="topnav__user-name">{displayName}</span>
          <span className={`topnav__badge ${isAdmin ? 'topnav__badge--admin' : 'topnav__badge--student'}`}>
            {isAdmin ? 'Admin' : 'Student'}
          </span>
        </div>

        <button className="btn btn--ghost btn--sm" onClick={onEditProfile}>
          Profile
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
