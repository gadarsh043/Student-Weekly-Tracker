const CYCLE = ['P', 'A', 'Excused', ''];

export default function AttendanceCell({ status, onChange }) {
  const handleClick = () => {
    const currentIndex = CYCLE.indexOf(status);
    const nextIndex = (currentIndex + 1) % CYCLE.length;
    onChange(CYCLE[nextIndex]);
  };

  const statusClass = () => {
    switch (status) {
      case 'P':
        return 'att-cell--present';
      case 'A':
        return 'att-cell--absent';
      case 'Excused':
        return 'att-cell--excused';
      default:
        return 'att-cell--empty';
    }
  };

  return (
    <div className={`att-cell ${statusClass()}`} onClick={handleClick}>
      {status}
    </div>
  );
}
