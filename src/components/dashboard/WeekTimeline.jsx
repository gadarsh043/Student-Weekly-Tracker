export default function WeekTimeline({ weeks, selectedWeek, onSelectWeek, weekDates = [] }) {
  const statusClass = (status) => {
    switch (status) {
      case 'submitted':
        return 'timeline__button--submitted';
      case 'reviewed':
        return 'timeline__button--reviewed';
      case 'late':
        return 'timeline__button--late';
      default:
        return 'timeline__button--pending';
    }
  };

  const getWeekDate = (weekNumber) =>
    weekDates.find((d) => d.weekNumber === weekNumber);

  return (
    <div className="timeline">
      <div className="timeline__header">
        <h3 className="timeline__title">Weekly Timeline</h3>
        <div className="timeline__legend">
          <span className="timeline__legend-item">
            <span className="timeline__legend-dot timeline__legend-dot--submitted" />
            Submitted
          </span>
          <span className="timeline__legend-item">
            <span className="timeline__legend-dot timeline__legend-dot--reviewed" />
            Reviewed
          </span>
          <span className="timeline__legend-item">
            <span className="timeline__legend-dot timeline__legend-dot--late" />
            Late
          </span>
          <span className="timeline__legend-item">
            <span className="timeline__legend-dot timeline__legend-dot--pending" />
            Pending
          </span>
        </div>
      </div>

      <div className="timeline__row">
        <div className="timeline__nodes">
          {weeks.map((week) => {
            const isSelected =
              selectedWeek && selectedWeek.week_number === week.week_number;
            const dateInfo = getWeekDate(week.week_number);
            const isHoliday = dateInfo?.isHoliday;

            return (
              <div
                key={week.week_number}
                className={`timeline__node${isSelected ? ' timeline__node--selected' : ''}${isHoliday ? ' timeline__node--holiday' : ''}`}
                onClick={() => onSelectWeek(week)}
              >
                <div className={`timeline__button ${isHoliday ? 'timeline__button--holiday' : statusClass(week.report?.status)}`}>
                  {week.week_number}
                </div>
                <span className="timeline__label">
                  {isHoliday ? 'Break' : `Week ${week.week_number}`}
                </span>
                {dateInfo && (
                  <span className="timeline__date">{dateInfo.label}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
