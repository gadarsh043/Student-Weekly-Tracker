import { useState } from 'react';

export default function ProjectCard({
  team,
  projectTitle,
  projectOverview,
  projectLinks,
  meetingLink,
  meetingTime,
  isAdmin,
  onTitleChange,
  onOverviewChange,
  onLinksChange,
  onMeetingLinkChange,
  onMeetingTimeChange,
  onSave,
  saving,
  // Team documents
  teamDocuments = [],
  onDocUpload,
  onDocView,
  onDocDelete,
  uploadingDoc,
  onDownloadAll,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const links = projectLinks ?? [];

  const handleAddLink = () => {
    onLinksChange([...links, { label: '', url: '', hasAccess: false }]);
  };

  const handleRemoveLink = (index) => {
    onLinksChange(links.filter((_, i) => i !== index));
  };

  const handleLinkChange = (index, field, value) => {
    const updated = links.map((link, i) =>
      i === index ? { ...link, [field]: value } : link
    );
    onLinksChange(updated);
  };

  const toggleAccess = (index) => {
    const updated = links.map((link, i) =>
      i === index ? { ...link, hasAccess: !link.hasAccess } : link
    );
    onLinksChange(updated);
  };

  return (
    <div className="project-card">
      <div
        className="project-card__header"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <h2 className="project-card__title">
          {team?.name ?? 'Project'}
          {projectTitle && (
            <span className="project-card__subtitle"> &mdash; {projectTitle}</span>
          )}
        </h2>
        <div className="project-card__header-right">
          {onDownloadAll && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={(e) => {
                e.stopPropagation();
                onDownloadAll();
              }}
            >
              Bulk Download Till Last week
            </button>
          )}
          <span className="project-card__chevron">
            {isExpanded ? '\u25B2' : '\u25BC'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="project-card__body">
          {/* Students see read-only view; admins can edit */}
          {isAdmin ? (
            <>
              <div className="week-panel__row">
                <div className="field-group">
                  <span className="field-label">Project Title</span>
                  <input
                    className="field-input"
                    type="text"
                    value={projectTitle ?? ''}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder="Enter project title"
                  />
                </div>
                <div className="field-group">
                  <span className="field-label">Meeting Link</span>
                  <input
                    className="field-input"
                    type="url"
                    value={meetingLink ?? ''}
                    onChange={(e) => onMeetingLinkChange(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="field-group">
                <span className="field-label">Project Overview</span>
                <textarea
                  className="field-textarea"
                  value={projectOverview ?? ''}
                  onChange={(e) => onOverviewChange(e.target.value)}
                  rows={3}
                  placeholder="Brief project description..."
                />
              </div>

              <div className="week-panel__row">
                <div className="field-group">
                  <span className="field-label">Meeting Time</span>
                  <input
                    className="field-input"
                    type="text"
                    value={meetingTime ?? ''}
                    onChange={(e) => onMeetingTimeChange(e.target.value)}
                    placeholder="e.g. Wed 3:00 PM"
                  />
                </div>
                <div />
              </div>

              {/* Links editor */}
              <div className="field-group">
                <span className="field-label">Project Links</span>
                {links.map((link, idx) => (
                  <div key={idx} className="links-editor__row">
                    <button
                      type="button"
                      className={`links-editor__access ${link.hasAccess ? 'links-editor__access--yes' : ''}`}
                      onClick={() => toggleAccess(idx)}
                      title={link.hasAccess ? 'You have access' : 'No access — click to toggle'}
                    >
                      {link.hasAccess ? 'Access' : 'No Access'}
                    </button>
                    <input
                      className="field-input links-editor__label-input"
                      type="text"
                      placeholder="Label"
                      value={link.label}
                      onChange={(e) => handleLinkChange(idx, 'label', e.target.value)}
                    />
                    <input
                      className="field-input links-editor__url-input"
                      type="url"
                      placeholder="https://..."
                      value={link.url}
                      onChange={(e) => handleLinkChange(idx, 'url', e.target.value)}
                    />
                    {link.url && (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn--secondary btn--sm links-editor__open"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open
                      </a>
                    )}
                    <button
                      type="button"
                      className="links-editor__remove"
                      onClick={() => handleRemoveLink(idx)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="links-editor__add" onClick={handleAddLink}>
                  + Add Link
                </button>
              </div>

              <div className="project-card__actions">
                <button className="btn btn--primary" onClick={onSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Project'}
                </button>
              </div>
            </>
          ) : (
            /* Student read-only view */
            <div className="project-card__readonly">
              {projectOverview && (
                <div className="field-group">
                  <span className="field-label">Overview</span>
                  <p className="readonly-field">{projectOverview}</p>
                </div>
              )}
              <div className="week-panel__row">
                <div className="field-group">
                  <span className="field-label">Meeting Link</span>
                  <div className="readonly-field">
                    {meetingLink ? (
                      <a href={meetingLink} target="_blank" rel="noreferrer">{meetingLink}</a>
                    ) : '\u2014'}
                  </div>
                </div>
                <div className="field-group">
                  <span className="field-label">Meeting Time</span>
                  <div className="readonly-field">{meetingTime || '\u2014'}</div>
                </div>
              </div>
              {links.length > 0 && (
                <div className="field-group">
                  <span className="field-label">Project Links</span>
                  {links.map((link, idx) => (
                    <div key={idx} className="readonly-field readonly-field--link">
                      <span
                        className={`links-access-dot ${link.hasAccess ? 'links-access-dot--yes' : ''}`}
                        title={link.hasAccess ? 'Admin has access' : 'Admin does not have access'}
                      />
                      {link.label && <strong>{link.label}: </strong>}
                      {link.url ? (
                        <a href={link.url} target="_blank" rel="noreferrer">{link.url}</a>
                      ) : '\u2014'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Team Documents — visible to both admin and students */}
          <div className="project-card__docs">
            <div className="project-card__docs-header">
              <span className="field-label">Team Documents</span>
              {onDocUpload && (
                <button
                  type="button"
                  className="links-editor__add"
                  onClick={onDocUpload}
                  disabled={uploadingDoc}
                >
                  {uploadingDoc ? 'Uploading...' : '+ Add Document'}
                </button>
              )}
            </div>
            {teamDocuments.length === 0 ? (
              <p className="project-card__docs-empty">No documents uploaded yet.</p>
            ) : (
              <div className="project-card__docs-list">
                {teamDocuments.map((doc, idx) => (
                  <div key={idx} className="project-card__doc-row">
                    <div className="project-card__doc-info">
                      <span className="project-card__doc-label">{doc.label}</span>
                      <span className="project-card__doc-meta">
                        {doc.type?.toUpperCase()} &middot; {new Date(doc.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="project-card__doc-actions">
                      {onDocView && (
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => onDocView(doc)}
                        >
                          View
                        </button>
                      )}
                      {onDocDelete && (
                        <button
                          type="button"
                          className="links-editor__remove"
                          onClick={() => onDocDelete(doc)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
