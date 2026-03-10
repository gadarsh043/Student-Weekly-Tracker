import AttendanceCell from './AttendanceCell';

export default function AttendanceTable({ students, onStatusChange }) {
  if (!students || students.length === 0) return null;

  const weekColumns = [];
  for (let w = 1; w <= 11; w++) {
    weekColumns.push(`week${w}`);
  }

  return (
    <table className="attendance-table">
      <thead>
        <tr className="attendance-table__header">
          <th className="attendance-table__name">Name</th>
          <th>Pitch Deck</th>
          {weekColumns.map((_, i) => (
            <th key={i}>Week {i + 1}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.netid} className="attendance-table__row">
            <td className="attendance-table__name">
              {student.firstName} {student.lastName}
            </td>
            <td>
              <AttendanceCell
                status={student.attendance?.pitchDeck ?? ''}
                onChange={(newStatus) =>
                  onStatusChange(student.netid, 'pitchDeck', newStatus)
                }
              />
            </td>
            {weekColumns.map((weekKey, i) => (
              <td key={i}>
                <AttendanceCell
                  status={student.attendance?.[weekKey] ?? ''}
                  onChange={(newStatus) =>
                    onStatusChange(student.netid, weekKey, newStatus)
                  }
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
