export default function Sidebar({
  teams,
  selectedTeam,
  onSelectTeam,
  isAdmin,
  onJoinTeam,
  isOpen,
  onToggle,
}) {
  const handleTeamClick = (team) => {
    if (isAdmin) {
      onSelectTeam(team);
    } else {
      onJoinTeam(team);
    }
  };

  return (
    <aside className={`sidebar${isOpen ? '' : ' sidebar--collapsed'}`}>
      <div className="sidebar__header">
        <h2>Teams</h2>
        <button className="sidebar__toggle" onClick={onToggle}>
          {isOpen ? '\u2190' : '\u2192'}
        </button>
      </div>

      {isOpen && (
        <div className="sidebar__list">
          {teams.map((team) => {
            const isSelected = selectedTeam && selectedTeam.id === team.id;

            return (
              <div
                key={team.id}
                className={`sidebar__team${isSelected ? ' sidebar__team--selected' : ''}`}
                onClick={() => handleTeamClick(team)}
              >
                <span className="sidebar__team-name">{team.name}</span>
                {team.code && <span className="sidebar__team-code">{team.code}</span>}
              </div>
            );
          })}
          {teams.length === 0 && (
            <div className="sidebar__empty">No teams available</div>
          )}
        </div>
      )}
    </aside>
  );
}
