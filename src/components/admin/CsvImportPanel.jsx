import { useState } from 'react';
import { parseAttendanceCSV } from '../../utils/csvParser';

export default function CsvImportPanel({ onImport }) {
  const [parsedData, setParsedData] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const data = parseAttendanceCSV(text);
      setParsedData(data);
      setPreviewMode(true);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (parsedData) {
      onImport(parsedData);
      setParsedData(null);
      setPreviewMode(false);
    }
  };

  const handleCancel = () => {
    setParsedData(null);
    setPreviewMode(false);
  };

  return (
    <div className="csv-import">
      <div className="csv-import__header">
        <h3>Import Attendance CSV</h3>
        <input type="file" accept=".csv" onChange={handleFileChange} />
      </div>

      {previewMode && parsedData && (
        <>
          <table className="csv-import__preview">
            <thead>
              <tr>
                <th>Team</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {parsedData.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.teamIndex}</td>
                  <td>
                    {row.firstName} {row.lastName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="csv-import__actions">
            <button onClick={handleImport}>Import</button>
            <button onClick={handleCancel}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
