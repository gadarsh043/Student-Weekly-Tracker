export default function TeamMembersList({ members, rosterMembers }) {
  const signedUpNetids = new Set(
    (members || []).map((m) => m.netid).filter(Boolean)
  );

  // Roster students who haven't signed up yet
  const unclaimed = (rosterMembers || []).filter(
    (r) => !r.matched_profile_id && !signedUpNetids.has(r.netid)
  );

  const hasMembers = members?.length > 0;
  const hasUnclaimed = unclaimed.length > 0;

  if (!hasMembers && !hasUnclaimed) return null;

  return (
    <div className="members-section">
      <h3 className="members-section__title">
        Team Members
        {hasMembers && <span className="members-section__count">{members.length} signed up</span>}
        {hasUnclaimed && <span className="members-section__count">{unclaimed.length} unclaimed</span>}
      </h3>

      {hasMembers && (
        <div className="members-grid">
          {members.map((member) => (
            <div key={member.netid || member.user_id} className="member-card">
              <div className="member-card__status-dot member-card__status-dot--active" />
              <div className="member-card__name">
                {member.first_name || ''} {member.last_name || ''}
              </div>
              <div className="member-card__meta">
                {member.email && <span>{member.email}</span>}
                {member.netid && <span>NetID: {member.netid}</span>}
              </div>
              {member.role && (
                <span className="member-card__role">{member.role}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {hasUnclaimed && (
        <>
          <div className="members-section__divider">
            <span>Roster Students (unclaimed)</span>
          </div>
          <div className="members-grid">
            {unclaimed.map((student) => (
              <div key={student.netid} className="member-card member-card--unclaimed">
                <div className="member-card__status-dot member-card__status-dot--unclaimed" />
                <div className="member-card__name">
                  {student.first_name} {student.last_name}
                </div>
                <div className="member-card__meta">
                  <span>NetID: {student.netid}</span>
                </div>
                <span className="member-card__role member-card__role--unclaimed">
                  Unclaimed
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
