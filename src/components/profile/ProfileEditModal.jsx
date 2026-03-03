import { useState, useEffect } from 'react';
import Modal from '../common/Modal';

export default function ProfileEditModal({ isOpen, onClose, profile, onSave }) {
  const [draft, setDraft] = useState({
    first_name: '',
    last_name: '',
    netid: '',
    student_id: '',
  });

  useEffect(() => {
    if (profile) {
      setDraft({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        netid: profile.netid ?? '',
        student_id: profile.student_id ?? '',
      });
    }
  }, [profile]);

  const handleChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(draft);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
      <div className="modal-form-grid">
        <div className="modal-form-group">
          <span className="field-label">First Name</span>
          <input
            className="field-input"
            type="text"
            value={draft.first_name}
            onChange={(e) => handleChange('first_name', e.target.value)}
          />
        </div>
        <div className="modal-form-group">
          <span className="field-label">Last Name</span>
          <input
            className="field-input"
            type="text"
            value={draft.last_name}
            onChange={(e) => handleChange('last_name', e.target.value)}
          />
        </div>
        <div className="modal-form-group">
          <span className="field-label">NetID</span>
          <input
            className="field-input"
            type="text"
            value={draft.netid}
            onChange={(e) => handleChange('netid', e.target.value)}
          />
        </div>
        <div className="modal-form-group">
          <span className="field-label">Student ID</span>
          <input
            className="field-input"
            type="text"
            value={draft.student_id}
            onChange={(e) => handleChange('student_id', e.target.value)}
          />
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" onClick={handleSave}>Save</button>
      </div>
    </Modal>
  );
}
