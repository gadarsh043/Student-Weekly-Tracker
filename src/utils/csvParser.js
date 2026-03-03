/**
 * Parse the CS-4485 attendance CSV into structured data.
 * CSV columns: #, Team Index, Last Name, First Name, Username, COMPANY, Title,
 *              Pitch Deck, Week 1, Week 2, ..., Week 11
 */
export function parseAttendanceCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim());
  const pitchDeckIdx = header.findIndex((h) => h === 'Pitch Deck');
  const week1Idx = header.findIndex((h) => h === 'Week 1');

  return lines
    .slice(1)
    .map((line) => {
      const cols = line.split(',');
      const attendance = {};

      if (pitchDeckIdx >= 0) {
        attendance.pitchDeck = cols[pitchDeckIdx]?.trim() || '';
      }
      for (let w = 1; w <= 11; w++) {
        const idx = week1Idx + (w - 1);
        attendance[`week${w}`] = cols[idx]?.trim() || '';
      }

      return {
        sectionNumber: parseInt(cols[0]) || null,
        teamIndex: parseInt(cols[1]) || null,
        lastName: cols[2]?.trim() || '',
        firstName: cols[3]?.trim() || '',
        netid: cols[4]?.trim() || '',
        company: cols[5]?.trim() || '',
        title: cols[6]?.trim() || '',
        attendance,
      };
    })
    .filter((row) => row.netid && row.teamIndex);
}

/**
 * Group parsed students by team index.
 * Returns: { 1: [student, ...], 2: [...], ... }
 */
export function groupByTeam(students) {
  return students.reduce((acc, student) => {
    const key = student.teamIndex;
    if (!acc[key]) acc[key] = [];
    acc[key].push(student);
    return acc;
  }, {});
}
