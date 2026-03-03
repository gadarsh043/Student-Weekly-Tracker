import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../utils/supabaseClient";
import AttendanceTable from "../components/attendance/AttendanceTable";
import Toast from "../components/common/Toast";
import LoadingSpinner from "../components/common/LoadingSpinner";

function Attendance() {
  const navigate = useNavigate();
  const { user, isAdmin, sessionChecked, loading: authLoading } = useAuth();
  const [message, setMessage] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionChecked && !authLoading) {
      if (!user || !isAdmin) navigate("/", { replace: true });
      else loadData();
    }
  }, [sessionChecked, authLoading, user, isAdmin]);

  const loadData = async () => {
    setLoading(true);

    // Load teams for the dropdown
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name")
      .order("id");
    setTeams(teamsData || []);

    // Load full student roster with attendance
    const { data: roster } = await supabase
      .from("student_roster")
      .select("*")
      .order("team_index, last_name");

    const { data: attendance } = await supabase
      .from("attendance_records")
      .select("*")
      .order("student_netid, week_number");

    // Build attendance map: netid -> { week0: "P", week1: "A", ... }
    const attMap = {};
    (attendance || []).forEach((rec) => {
      if (!attMap[rec.student_netid]) attMap[rec.student_netid] = {};
      const key = rec.week_number === 0 ? "pitchDeck" : `week${rec.week_number}`;
      attMap[rec.student_netid][key] = rec.status;
    });

    const merged = (roster || []).map((s) => ({
      netid: s.netid,
      firstName: s.first_name,
      lastName: s.last_name,
      teamIndex: s.team_index,
      attendance: attMap[s.netid] || {},
    }));

    setStudents(merged);
    if (merged.length > 0 && !selectedTeamIndex) {
      setSelectedTeamIndex(merged[0].teamIndex);
    }
    setLoading(false);
  };

  const handleStatusChange = async (netid, weekKey, newStatus) => {
    const weekNumber = weekKey === "pitchDeck" ? 0 : parseInt(weekKey.replace("week", ""));
    const student = students.find((s) => s.netid === netid);
    if (!student) return;

    // Optimistic update
    setStudents((prev) =>
      prev.map((s) =>
        s.netid === netid
          ? { ...s, attendance: { ...s.attendance, [weekKey]: newStatus } }
          : s
      )
    );

    const { error } = await supabase.from("attendance_records").upsert(
      {
        student_netid: netid,
        team_index: student.teamIndex,
        week_number: weekNumber,
        status: newStatus,
      },
      { onConflict: "student_netid,week_number" }
    );

    if (error) {
      setMessage("Failed to save: " + error.message);
      loadData(); // revert
    }
  };

  if (!sessionChecked || authLoading || loading) return <LoadingSpinner />;
  if (!user || !isAdmin) return null;

  const uniqueTeamIndices = [...new Set(students.map((s) => s.teamIndex))].sort(
    (a, b) => a - b
  );
  const filteredStudents = selectedTeamIndex
    ? students.filter((s) => s.teamIndex === selectedTeamIndex)
    : students;

  // Summary stats
  const totalCells = filteredStudents.reduce((acc, s) => {
    return acc + Object.values(s.attendance).filter((v) => v).length;
  }, 0);
  const presentCount = filteredStudents.reduce((acc, s) => {
    return acc + Object.values(s.attendance).filter((v) => v === "P").length;
  }, 0);
  const absentCount = filteredStudents.reduce((acc, s) => {
    return (
      acc +
      Object.values(s.attendance).filter((v) => v === "A" || v?.startsWith("A "))
        .length
    );
  }, 0);

  return (
    <div className="admin-page attendance-page">
      <header className="attendance-page__header">
        <h1>Attendance Tracker</h1>
        <div className="attendance-page__controls">
          <select
            className="attendance-page__team-select"
            value={selectedTeamIndex || ""}
            onChange={(e) =>
              setSelectedTeamIndex(e.target.value ? parseInt(e.target.value) : null)
            }
          >
            <option value="">All Teams</option>
            {uniqueTeamIndices.map((idx) => (
              <option key={idx} value={idx}>
                Team {idx}
              </option>
            ))}
          </select>
          <Link to="/admin" className="btn btn--secondary btn--sm">
            Admin
          </Link>
          <Link to="/" className="btn btn--secondary btn--sm">
            Tracker
          </Link>
        </div>
      </header>

      {totalCells > 0 && (
        <div className="attendance-summary">
          <div className="attendance-stat">
            <span className="attendance-stat__value">{filteredStudents.length}</span>
            <span className="attendance-stat__label">Students</span>
          </div>
          <div className="attendance-stat">
            <span className="attendance-stat__value" style={{ color: "var(--success)" }}>
              {presentCount}
            </span>
            <span className="attendance-stat__label">Present</span>
          </div>
          <div className="attendance-stat">
            <span className="attendance-stat__value" style={{ color: "var(--danger)" }}>
              {absentCount}
            </span>
            <span className="attendance-stat__label">Absent</span>
          </div>
          <div className="attendance-stat">
            <span className="attendance-stat__value">
              {totalCells > 0 ? Math.round((presentCount / totalCells) * 100) : 0}%
            </span>
            <span className="attendance-stat__label">Rate</span>
          </div>
        </div>
      )}

      {filteredStudents.length === 0 ? (
        <div className="card">
          <p className="admin-empty-state">
            No student roster data found. Go to{" "}
            <Link to="/admin" style={{ color: "var(--primary)" }}>
              Admin &gt; Import Students
            </Link>{" "}
            to import from CSV.
          </p>
        </div>
      ) : (
        <div className="attendance-table-wrapper">
          <AttendanceTable
            students={filteredStudents}
            onStatusChange={handleStatusChange}
          />
        </div>
      )}

      <Toast message={message} onDismiss={() => setMessage(null)} />
    </div>
  );
}

export default Attendance;
