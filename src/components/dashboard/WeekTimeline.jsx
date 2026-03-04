export default function WeekTimeline({ weeks, selectedWeek, onSelectWeek, weekDates = [] }) {
  const today = new Date().toISOString().split('T')[0];

  const getWeekDate = (weekNumber) =>
    weekDates.find((d) => d.weekNumber === weekNumber);

  const timeClass = (weekNumber) => {
    const dateInfo = getWeekDate(weekNumber);
    if (!dateInfo) return 'timeline__button--future';
    if (dateInfo.isHoliday) return 'timeline__button--holiday';
    if (dateInfo.endDate < today) return 'timeline__button--past';
    if (dateInfo.startDate <= today && today <= dateInfo.endDate) return 'timeline__button--current';
    return 'timeline__button--future';
  };

  return (
    <div className="timeline">
      <div className="timeline__header">
        <h3 className="timeline__title">Weekly Timeline</h3>
        <div className="timeline__legend">
          <span className="timeline__legend-item">
            <span className="timeline__legend-dot timeline__legend-dot--past" />
            Past
          </span>
          <span className="timeline__legend-item">
            <span className="timeline__legend-dot timeline__legend-dot--current" />
            Current
          </span>
          <span className="timeline__legend-item">
            <span className="timeline__legend-dot timeline__legend-dot--future" />
            Upcoming
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
                <div className={`timeline__button ${timeClass(week.week_number)}`}>
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
