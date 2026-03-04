export const TOTAL_WEEKS = 11;
export const TEAM_COUNT = 13;

export const ATTENDANCE_STATUSES = ['P', 'A', 'Excused', ''];

export const RATING_OPTIONS = ['Excellent', 'Good', 'Ok', 'Bad'];
export const RATING_COLORS = {
  Excellent: '#22c55e',
  Good: '#0f766e',
  Ok: '#eab308',
  Bad: '#ef4444',
};

export const PIE_COLORS = [
  '#0f766e', '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
  '#6366f1', '#14b8a6', '#e11d48',
];

export const ATTENDANCE_SHEET_ID = '1erVwrE5-Xrqdkd8tPjmgnB2CStqj7z4R_6VPvMLxsMU';
export const WEEKLY_STATUS_SHEET_ID = '1POociMcggEXrp8-drbfNWLOGBumnwMLpcl1jEGY3ksw';

/** Default semester start date — admin can override via semester_config table */
export const DEFAULT_SEMESTER_START = '2025-03-01';

/**
 * Compute week date ranges from a start date and holiday list.
 * Returns array of { weekNumber, startDate, endDate, isHoliday, label }.
 */
export function computeWeekDates(semesterStart, holidays = [], totalWeeks = TOTAL_WEEKS) {
  const start = new Date(semesterStart + 'T00:00:00');
  const result = [];
  let currentDate = new Date(start);

  for (let w = 1; w <= totalWeeks; w++) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const isHoliday = holidays.includes(w);

    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    result.push({
      weekNumber: w,
      startDate: weekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      isHoliday,
      label: isHoliday ? 'Holiday' : `${fmt(weekStart)}-${fmt(weekEnd)}`,
    });

    // Move to next Monday (7 days)
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return result;
}
