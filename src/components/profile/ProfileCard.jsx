export default function ProfileCard({ profile, user, isAdmin, onEditProfile }) {
  const initial = profile?.first_name
    ? profile.first_name.charAt(0).toUpperCase()
    : '?';

  return (
    <div className="profile-bar">
      <div className="profile-bar__avatar">{initial}</div>

      <div className="profile-bar__info">
        <div className="profile-bar__name">
          {profile?.first_name} {profile?.last_name}
        </div>
        <div className="profile-bar__email">{user?.email}</div>
        <span className="topnav__badge">
          {isAdmin ? 'Admin' : 'Student'}
        </span>
      </div>

      <button onClick={onEditProfile}>Edit Profile</button>
    </div>
  );
}
