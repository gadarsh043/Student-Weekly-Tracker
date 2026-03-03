export default function SubmissionActions({ week, onUpload, onView, onDelete, uploading }) {
  const hasFile = week?.report?.file_path;

  return (
    <div className="submission-actions">
      {hasFile && (
        <button className="btn-view-pdf" onClick={onView}>
          View Document
        </button>
      )}

      <button className="btn-add-pdf" onClick={onUpload} disabled={uploading}>
        {hasFile ? 'Replace Document' : 'Add Document'}
      </button>

      {hasFile && (
        <button className="btn-delete-pdf" onClick={onDelete} disabled={uploading}>
          Delete Document
        </button>
      )}

      {uploading && <span className="uploading-message">Uploading...</span>}
    </div>
  );
}
