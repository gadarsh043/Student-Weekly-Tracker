import SubmissionActions from './SubmissionActions';
import { RATING_OPTIONS, RATING_COLORS } from '../../utils/constants';

export default function WeekDetailPanel({
  selectedWeek,
  editingGoal,
  editingRequest,
  editingReport,
  onGoalChange,
  onRequestChange,
  onReportChange,
  onSave,
  onUpload,
  onViewPdf,
  onDeletePdf,
  onDownloadWeek,
  saving,
  uploading,
  isAdmin,
  // New props from useWeekPanel
  rosterStudents = [],
  attendance = {},
  effortPoints = {},
  teamRating,
  onAttendanceChange,
  onEffortChange,
  onRatingChange,
  // Contribution points
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
          <span className={`week-panel__status week-panel__status--${selectedWeek.report?.status || 'pending'}`}>
            {selectedWeek.report?.status || 'pending'}
          </span>
        </div>
      </div>

      <div className="week-panel__content">
        {/* Goals & Request */}
        <div className="week-panel__row">
          <div className="field-group">
            <span className="field-label">Goal</span>
            <textarea
              className="field-textarea"
              value={editingGoal ?? ''}
              onChange={(e) => onGoalChange(e.target.value)}
              rows={3}
              placeholder="What is the goal for this week?"
            />
          </div>
          <div className="field-group">
            <span className="field-label">Request</span>
            <textarea
              className="field-textarea"
              value={editingRequest ?? ''}
              onChange={(e) => onRequestChange(e.target.value)}
              rows={3}
              placeholder="Any requests or blockers?"
            />
          </div>
        </div>

        {isAdmin && (
          <div className="field-group" style={{ maxWidth: 240 }}>
            <span className="field-label">Status</span>
            <select
              className="field-select"
              value={editingReport?.status || 'pending'}
              onChange={(e) => onReportChange({ ...editingReport, status: e.target.value })}
            >
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="late">Late</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>
        )}

        {/* Report fields */}
        <div className="week-panel__divider" />

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
            <span className="field-label">Minutes of Meeting (MoM)</span>
            <textarea
              className="field-textarea"
              value={editingReport?.mom_meeting ?? ''}
              onChange={(e) =>
                onReportChange({ ...editingReport, mom_meeting: e.target.value })
              }
              rows={3}
              placeholder="Meeting notes..."
            />
          </div>
        </div>

        <div className="week-panel__row">
          <div className="field-group">
            <span className="field-label">Work Done</span>
            <textarea
              className="field-textarea"
              value={editingReport?.work_done ?? ''}
              onChange={(e) =>
                onReportChange({ ...editingReport, work_done: e.target.value })
              }
              rows={3}
              placeholder="Summary of work completed..."
            />
          </div>
          <div className="field-group">
            <span className="field-label">Weekly Report / Comments</span>
            <textarea
              className="field-textarea"
              value={editingReport?.comments ?? ''}
              onChange={(e) =>
                onReportChange({ ...editingReport, comments: e.target.value })
              }
              rows={3}
              placeholder="Additional comments..."
            />
          </div>
        </div>

        {/* Submission */}
        <div className="week-panel__divider" />

        <div className="field-group">
          <span className="field-label">Document Submission</span>
          <SubmissionActions
            week={selectedWeek}
            onUpload={onUpload}
            onView={onViewPdf}
            onDelete={onDeletePdf}
            uploading={uploading}
          />
          <div className="week-panel__file-status">
            {selectedWeek.report?.file_path ? (
              <span className="week-panel__file-name">
                Uploaded: {selectedWeek.report.file_path.split('/').pop()}
              </span>
            ) : (
              <span className="week-panel__no-file">No file uploaded yet</span>
            )}
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
