import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../utils/supabaseClient";
import PageLayout from "../components/layout/PageLayout";
import Toast from "../components/common/Toast";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { TOTAL_WEEKS } from "../utils/constants";

const DEFAULT_WEIGHTS = { attendance: 30, hours: 30, contribution: 40 };

function letterGrade(score) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 86) return "A-";
  if (score >= 83) return "B+";
  if (score >= 80) return "B";
  if (score >= 76) return "B-";
  if (score >= 73) return "C+";
  if (score >= 70) return "C";
  if (score >= 66) return "C-";
  if (score >= 63) return "D+";
  if (score >= 60) return "D";
  if (score >= 56) return "D-";
  return "F";
}

function gradeColor(grade) {
  if (grade.startsWith("A")) return "#22c55e";
  if (grade.startsWith("B")) return "#0f766e";
  if (grade.startsWith("C")) return "#eab308";
  if (grade.startsWith("D")) return "#f97316";
  return "#ef4444";
}

function Grades() {
  const navigate = useNavigate();
  const { user, isAdmin, sessionChecked, loading: authLoading } = useAuth();
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allStudents, setAllStudents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [showWeights, setShowWeights] = useState(false);
  const [sortBy, setSortBy] = useState("team");
  const [sortDir, setSortDir] = useState("asc");
  const [filterTeam, setFilterTeam] = useState("");

  useEffect(() => {
    if (sessionChecked && !authLoading) {
      if (!user || !isAdmin) navigate("/", { replace: true });
      else loadData();
    }
  }, [sessionChecked, authLoading, user, isAdmin]);

  const loadData = async () => {
    setLoading(true);

    const [teamsRes, rosterRes, effortRes, attendanceRes] = await Promise.all([
      supabase.from("teams").select("id, name, code").eq("is_active", true).order("id"),
      supabase.from("student_roster").select("*").order("team_index, last_name"),
      supabase.from("student_effort_points").select("*"),
      supabase.from("attendance_records").select("*"),
    ]);

    setTeams(teamsRes.data || []);

    const roster = rosterRes.data || [];
    const efforts = effortRes.data || [];
    const attendanceRecs = attendanceRes.data || [];

    // Build maps
    const effortMap = {}; // netid -> {week: {effort, contrib}}
    efforts.forEach((e) => {
      if (!effortMap[e.student_netid]) effortMap[e.student_netid] = {};
      effortMap[e.student_netid][e.week_number] = {
        effort: e.effort_points || 0,
        contribution: e.contribution_points ?? 0,
      };
    });

    const attendanceMap = {}; // netid -> {week: status}
    attendanceRecs.forEach((a) => {
      if (!attendanceMap[a.student_netid]) attendanceMap[a.student_netid] = {};
      attendanceMap[a.student_netid][a.week_number] = a.status;
    });

    // Build team name lookup
    const teamNameMap = {};
    (teamsRes.data || []).forEach((t) => {
      const match = t.code?.match(/T(\d+)/i);
      if (match) teamNameMap[parseInt(match[1])] = t.name;
    });

    const students = roster.map((s) => {
      const studentEffort = effortMap[s.netid] || {};
      const studentAttendance = attendanceMap[s.netid] || {};

      // Hours
      const hoursValues = Object.values(studentEffort).map((v) => v.effort).filter((v) => v > 0);
      const totalHours = hoursValues.reduce((sum, v) => sum + v, 0);
      const avgHours = hoursValues.length > 0 ? totalHours / hoursValues.length : 0;

      // Contribution
      const contribValues = Object.values(studentEffort).map((v) => v.contribution).filter((v) => v > 0);
      const avgContribution = contribValues.length > 0
        ? contribValues.reduce((sum, v) => sum + v, 0) / contribValues.length
        : 0;

      // Attendance
      const attValues = Object.values(studentAttendance);
      const totalMarked = attValues.filter((v) => v === "P" || v === "A" || v === "Excused").length;
      const presentCount = attValues.filter((v) => v === "P" || v === "Excused").length;
      const attendanceRate = totalMarked > 0 ? (presentCount / totalMarked) * 100 : 0;

      return {
        netid: s.netid,
        first_name: s.first_name,
        last_name: s.last_name,
        name: `${s.first_name} ${s.last_name}`,
        team_index: s.team_index,
        team_name: teamNameMap[s.team_index] || `Team ${s.team_index}`,
        totalHours,
        avgHours,
        avgContribution,
        attendanceRate,
        weeksReported: hoursValues.length,
      };
    });

    setAllStudents(students);
    setLoading(false);
  };

  // Compute grades based on weights
  const gradedStudents = useMemo(() => {
    if (allStudents.length === 0) return [];

    // Find max values for normalization
    const maxHours = Math.max(...allStudents.map((s) => s.avgHours), 1);
    const maxContrib = 10; // Contribution is always 1-10 scale

    return allStudents.map((s) => {
      // Normalize each metric to 0-100
      const attScore = s.attendanceRate; // Already 0-100
      const hoursScore = (s.avgHours / maxHours) * 100;
      const contribScore = (s.avgContribution / maxContrib) * 100;

      // Weighted total
      const totalWeight = weights.attendance + weights.hours + weights.contribution;
      const rawScore = totalWeight > 0
        ? (attScore * weights.attendance + hoursScore * weights.hours + contribScore * weights.contribution) / totalWeight
        : 0;

      const grade = letterGrade(rawScore);

      return { ...s, rawScore, grade };
    });
  }, [allStudents, weights]);

  // Filter and sort
  const displayStudents = useMemo(() => {
    let list = gradedStudents;

    if (filterTeam) {
      list = list.filter((s) => s.team_index === parseInt(filterTeam));
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "grade":
          cmp = b.rawScore - a.rawScore;
          break;
        case "team":
          cmp = a.team_index - b.team_index || a.last_name.localeCompare(b.last_name);
          break;
        case "netid":
          cmp = a.netid.localeCompare(b.netid);
          break;
        default:
          cmp = 0;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return list;
  }, [gradedStudents, filterTeam, sortBy, sortDir]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const handleWeightChange = (key, value) => {
    const num = parseInt(value) || 0;
    setWeights((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, num)) }));
  };

  const sortArrow = (field) => {
    if (sortBy !== field) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  if (!sessionChecked || authLoading || loading) return <LoadingSpinner />;
  if (!user || !isAdmin) return null;

  const uniqueTeamIndices = [...new Set(allStudents.map((s) => s.team_index))].sort((a, b) => a - b);

  // Summary stats
  const avgGradeScore = gradedStudents.length > 0
    ? gradedStudents.reduce((s, st) => s + st.rawScore, 0) / gradedStudents.length
    : 0;

  return (
    <PageLayout>
      <div className="grades-page">
        <header className="grades-page__header">
          <div>
            <h1>Student Grades</h1>
            <p className="grades-page__sub">
              Auto-calculated from attendance, hours worked, and contribution scores
            </p>
          </div>
          <div className="grades-page__controls">
            <select
              className="field-select"
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <option value="">All Teams</option>
              {uniqueTeamIndices.map((idx) => (
                <option key={idx} value={idx}>Team {idx}</option>
              ))}
            </select>
            <button
              type="button"
              className={`btn ${showWeights ? "btn--primary" : "btn--secondary"} btn--sm`}
              onClick={() => setShowWeights((v) => !v)}
            >
              Weights
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grades-stats">
          <div className="grades-stat">
            <span className="grades-stat__value">{displayStudents.length}</span>
            <span className="grades-stat__label">Students</span>
          </div>
          <div className="grades-stat">
            <span className="grades-stat__value" style={{ color: gradeColor(letterGrade(avgGradeScore)) }}>
              {letterGrade(avgGradeScore)}
            </span>
            <span className="grades-stat__label">Avg Grade</span>
          </div>
          <div className="grades-stat">
            <span className="grades-stat__value" style={{ color: "var(--primary)" }}>
              {avgGradeScore.toFixed(0)}%
            </span>
            <span className="grades-stat__label">Avg Score</span>
          </div>
          <div className="grades-stat">
            <span className="grades-stat__value">{uniqueTeamIndices.length}</span>
            <span className="grades-stat__label">Teams</span>
          </div>
        </div>

        {/* Weight Controls */}
        {showWeights && (
          <div className="grades-weights card">
            <h3 className="card__title">Grade Weight Configuration</h3>
            <p className="card__sub">Adjust how much each metric contributes to the final grade. Values are relative weights.</p>
            <div className="grades-weights__grid">
              <div className="grades-weights__item">
                <label className="field-label">Attendance</label>
                <div className="grades-weights__input-row">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weights.attendance}
                    onChange={(e) => handleWeightChange("attendance", e.target.value)}
                    className="grades-weights__slider"
                  />
                  <span className="grades-weights__value">{weights.attendance}%</span>
                </div>
              </div>
              <div className="grades-weights__item">
                <label className="field-label">Hours Worked</label>
                <div className="grades-weights__input-row">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weights.hours}
                    onChange={(e) => handleWeightChange("hours", e.target.value)}
                    className="grades-weights__slider"
                  />
                  <span className="grades-weights__value">{weights.hours}%</span>
                </div>
              </div>
              <div className="grades-weights__item">
                <label className="field-label">Contribution</label>
                <div className="grades-weights__input-row">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weights.contribution}
                    onChange={(e) => handleWeightChange("contribution", e.target.value)}
                    className="grades-weights__slider"
                  />
                  <span className="grades-weights__value">{weights.contribution}%</span>
                </div>
              </div>
            </div>
            <p className="grades-weights__note">
              Total weight: {weights.attendance + weights.hours + weights.contribution}
              {" — "}Grade formula: (Attendance% × {weights.attendance} + Hours% × {weights.hours} + Contribution% × {weights.contribution}) / {weights.attendance + weights.hours + weights.contribution}
            </p>
          </div>
        )}

        {/* Grades Table */}
        {displayStudents.length === 0 ? (
          <div className="card">
            <p className="admin-empty-state">No students found. Import via Admin.</p>
          </div>
        ) : (
          <div className="grades-table-wrapper">
            <table className="grades-table">
              <thead>
                <tr>
                  <th className="grades-table__sortable" onClick={() => handleSort("name")}>
                    Name{sortArrow("name")}
                  </th>
                  <th />
                  <th className="grades-table__sortable" onClick={() => handleSort("team")}>
                    Team{sortArrow("team")}
                  </th>
                  <th>Attendance</th>
                  <th>Avg Hours</th>
                  <th>Contribution</th>
                  <th>Score</th>
                  <th className="grades-table__sortable" onClick={() => handleSort("grade")}>
                    Grade{sortArrow("grade")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayStudents.map((s) => (
                  <tr key={s.netid}>
                    <td className="grades-table__name">{s.first_name} {s.last_name}</td>
                    <td className="grades-table__netid" />
                    <td className="grades-table__team">T{s.team_index}</td>
                    <td style={{ color: s.attendanceRate >= 80 ? "#22c55e" : s.attendanceRate >= 50 ? "#eab308" : "#ef4444" }}>
                      {s.attendanceRate > 0 ? `${s.attendanceRate.toFixed(0)}%` : "—"}
                    </td>
                    <td>{s.avgHours > 0 ? `${s.avgHours.toFixed(1)}h` : "—"}</td>
                    <td>{s.avgContribution > 0 ? `${s.avgContribution.toFixed(1)}/10` : "—"}</td>
                    <td style={{ fontWeight: 600 }}>{s.rawScore > 0 ? `${s.rawScore.toFixed(0)}%` : "—"}</td>
                    <td>
                      <span
                        className="grades-table__grade-badge"
                        style={{ background: gradeColor(s.grade) + "18", color: gradeColor(s.grade) }}
                      >
                        {s.rawScore > 0 ? s.grade : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Toast message={message} onDismiss={() => setMessage(null)} />
      </div>
    </PageLayout>
  );
}

export default Grades;
