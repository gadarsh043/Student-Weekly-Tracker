import { RATING_OPTIONS } from '../../utils/constants';

export default function WeekDetailPanel({
  selectedWeek,
  editingReport,
  onReportChange,
  onSave,
  onDownloadWeek,
  saving,
  isAdmin,
  rosterStudents = [],
  attendance = {},
  effortPoints = {},
  teamRating,
  onAttendanceChange,
  onEffortChange,
  onRatingChange,
  contributionPoints = {},
  onContributionChange,
}) {
  if (!selectedWeek) return null;

  const presentCount = Object.values(attendance).filter((v) => v === 'P').length;
  const absentCount = Object.values(attendance).filter((v) => v === 'A').length;
  const excusedCount = Object.values(attendance).filter((v) => v === 'Excused').length;

  const effortValues = Object.values(effortPoints).filter((v) => v > 0);
  const avgEffort = effortValues.length > 0
    ? (effortValues.reduce((a, b) => a + b, 0) / effortValues.length).toFixed(1)
    : '—';

  return (
    <div className="week-panel">
      <div className="week-panel__header">
        <h3>Week {selectedWeek.week_number}</h3>
        <div className="week-panel__header-actions">
          {onDownloadWeek && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onDownloadWeek(selectedWeek)}
              title="Download this week's data as PDF"
            >
              Download
            </button>
          )}
        </div>
      </div>

      <div className="week-panel__content">
        {/* Team Leader & Comments */}
        <div className="week-panel__row">
          <div className="field-group">
            <span className="field-label">Team Leader This Week</span>
            {rosterStudents.length > 0 ? (
              <select
                className="field-select"
                value={editingReport?.team_leader_week ?? ''}
                onChange={(e) =>
                  onReportChange({ ...editingReport, team_leader_week: e.target.value })
                }
              >
                <option value="">Select leader...</option>
                {rosterStudents.map((s) => (
                  <option key={s.netid} value={`${s.first_name} ${s.last_name}`}>
                    {s.first_name} {s.last_name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="field-input"
                type="text"
                value={editingReport?.team_leader_week ?? ''}
                onChange={(e) =>
                  onReportChange({ ...editingReport, team_leader_week: e.target.value })
                }
                placeholder="Who is leading this week?"
              />
            )}
          </div>
          <div className="field-group">
            <span className="field-label">Comments</span>
            <textarea
              className="field-textarea"
              value={editingReport?.comments ?? ''}
              onChange={(e) =>
                onReportChange({ ...editingReport, comments: e.target.value })
              }
              rows={3}
              placeholder="Weekly comments..."
            />
          </div>
        </div>

        {/* Team Satisfaction Rating */}
        {onRatingChange && (
          <>
            <div className="week-panel__divider" />
            <div className="field-group">
              <span className="week-panel__section-title">Team Satisfaction</span>
              <div className="week-panel__rating-buttons">
                {RATING_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`week-panel__rating-btn week-panel__rating-btn--${option.toLowerCase()} ${teamRating === option ? 'week-panel__rating-btn--active' : ''}`}
                    onClick={() => onRatingChange(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Attendance Grid */}
        {rosterStudents.length > 0 && onAttendanceChange && (
          <>
            <div className="week-panel__divider" />
            <div className="field-group">
              <span className="week-panel__section-title">
                Attendance
                <span className="week-panel__attendance-summary">
                  {presentCount > 0 && <span className="week-panel__att-badge week-panel__att-badge--p">{presentCount} P</span>}
                  {absentCount > 0 && <span className="week-panel__att-badge week-panel__att-badge--a">{absentCount} A</span>}
                  {excusedCount > 0 && <span className="week-panel__att-badge week-panel__att-badge--e">{excusedCount} E</span>}
                </span>
              </span>
              <div className="week-panel__attendance-grid">
                <div className="week-panel__att-header">
                  <span className="week-panel__att-name-col">Student</span>
                  <span className="week-panel__att-status-col">P</span>
                  <span className="week-panel__att-status-col">A</span>
                  <span className="week-panel__att-status-col">E</span>
                </div>
                {rosterStudents.map((s) => {
                  const current = attendance[s.netid] || '';
                  return (
                    <div key={s.netid} className="week-panel__att-row">
                      <span className="week-panel__att-name">
                        {s.first_name} {s.last_name}
                      </span>
                      {['P', 'A', 'Excused'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`week-panel__att-cell week-panel__att-cell--${status.toLowerCase()} ${current === status ? 'week-panel__att-cell--active' : ''}`}
                          onClick={() => onAttendanceChange(s.netid, current === status ? '' : status)}
                        >
                          {status === 'Excused' ? 'E' : status}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Effort & Contribution Points */}
        {rosterStudents.length > 0 && onEffortChange && (
          <>
            <div className="week-panel__divider" />
            <div className="field-group">
              <span className="week-panel__section-title">
                Effort & Contribution
                <span className="week-panel__effort-avg">Avg: {avgEffort}h</span>
              </span>
              <div className="week-panel__effort-grid">
                <div className="week-panel__effort-header">
                  <span className="week-panel__effort-name">Student</span>
                  <span className="week-panel__effort-col-label">Hours</span>
                  <span className="week-panel__effort-col-label">Contribution (1-10)</span>
                </div>
                {rosterStudents.map((s) => (
                  <div key={s.netid} className="week-panel__effort-row">
                    <span className="week-panel__effort-name">
                      {s.first_name} {s.last_name}
                    </span>
                    <div className="week-panel__effort-inputs">
                      <input
                        type="number"
                        className="week-panel__effort-input"
                        min="0"
                        max="80"
                        step="0.5"
                        value={effortPoints[s.netid] || ''}
                        onChange={(e) => onEffortChange(s.netid, e.target.value)}
                        placeholder="0"
                      />
                      <span className="week-panel__effort-unit">hrs</span>
                    </div>
                    <div className="week-panel__effort-inputs">
                      <input
                        type="number"
                        className="week-panel__effort-input week-panel__effort-input--contrib"
                        min="0"
                        max="10"
                        step="1"
                        value={contributionPoints[s.netid] || ''}
                        onChange={(e) => onContributionChange?.(s.netid, e.target.value)}
                        placeholder="0"
                      />
                      <span className="week-panel__effort-unit">/10</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="week-panel__save">
        <button className="btn btn--primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Week'}
        </button>
      </div>
    </div>
  );
}
