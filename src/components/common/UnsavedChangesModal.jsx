import Modal from "./Modal";

/**
 * Shown when React Router navigation is blocked by unsaved changes.
 * The `blocker` object comes from useBlocker (react-router-dom v6).
 */
export default function UnsavedChangesModal({ blocker }) {
  if (blocker.state !== "blocked") return null;

  return (
    <Modal
      isOpen
      onClose={() => blocker.reset()}
      title="Unsaved Changes"
      description="You have unsaved changes that will be lost if you leave this page."
    >
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
        <button className="btn btn--ghost" onClick={() => blocker.reset()}>
          Stay on Page
        </button>
        <button className="btn btn--danger" onClick={() => blocker.proceed()}>
          Discard & Leave
        </button>
      </div>
    </Modal>
  );
}
