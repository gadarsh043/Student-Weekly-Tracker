export default function SubmissionActions({ week, onUpload, onView, onDelete, uploading }) {
  const hasFile = week?.report?.file_path;

  return (
    <div className="submission-actions">
      {hasFile && (
        <button className="btn-view-pdf" onClick={onView}>
          View PDF
        </button>
      )}

      <button className="btn-add-pdf" onClick={onUpload} disabled={uploading}>
        {hasFile ? 'Replace PDF' : 'Add PDF'}
      </button>

      {hasFile && (
        <button className="btn-delete-pdf" onClick={onDelete} disabled={uploading}>
          Delete PDF
        </button>
      )}

      {uploading && <span className="uploading-message">Uploading...</span>}
    </div>
  );
}
