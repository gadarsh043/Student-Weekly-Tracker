import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useMetrics } from "../hooks/useMetrics";
import { supabase } from "../utils/supabaseClient";
import PageLayout from "../components/layout/PageLayout";
import Toast from "../components/common/Toast";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { TOTAL_WEEKS, RATING_OPTIONS, RATING_COLORS, PIE_COLORS } from "../utils/constants";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from "recharts";

function Metrics() {
  const navigate = useNavigate();
  const { user, isAdmin, sessionChecked, loading: authLoading } = useAuth();
  const [message, setMessage] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [selectedTeamCode, setSelectedTeamCode] = useState(null);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(1);

  // Effort editing state (inline in table)
  const [effortEdits, setEffortEdits] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sessionChecked && !authLoading) {
      if (!user || !isAdmin) navigate("/", { replace: true });
      else loadTeams();
    }
  }, [sessionChecked, authLoading, user, isAdmin]);

  const loadTeams = async () => {
    const { data } = await supabase
      .from("teams")
      .select("id, name, code")
      .eq("is_active", true)
      .order("id");
    setTeams(data || []);
    if (data?.length > 0) {
      setSelectedTeamId(data[0].id);
      setSelectedTeamCode(data[0].code);
    }
    setTeamsLoading(false);
  };

  const handleTeamChange = (e) => {
    const id = e.target.value;
    setSelectedTeamId(id);
    const team = teams.find((t) => String(t.id) === String(id));
    setSelectedTeamCode(team?.code || null);
  };

  const metrics = useMetrics(selectedTeamId, selectedTeamCode);

  const handleEffortChange = async (netid, weekNum, value) => {
    const points = parseFloat(value) || 0;
    setEffortEdits((prev) => ({
      ...prev,
      [`${netid}-${weekNum}`]: points,
    }));

    await supabase.from("student_effort_points").upsert(
      {
        student_netid: netid,
        team_id: selectedTeamId,
        week_number: weekNum,
        effort_points: points,
        recorded_by: user.id,
      },
      { onConflict: "student_netid,team_id,week_number" }
    );
  };

  const handleRatingChange = async (weekNum, rating) => {
    setSaving(true);
    await supabase.from("team_ratings").upsert(
      {
        team_id: selectedTeamId,
        week_number: weekNum,
        rating,
        rated_by: user.id,
      },
      { onConflict: "team_id,week_number" }
    );
    await metrics.reload();
    setSaving(false);
  };

  if (!sessionChecked || authLoading || teamsLoading) return <LoadingSpinner />;
  if (!user || !isAdmin) return null;

  const currentRating = metrics.teamRatings[selectedWeek];

  // Attendance bar chart data
  const attendanceBarData = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
    const w = i + 1;
    let present = 0, absent = 0, excused = 0;
    metrics.students.forEach((s) => {
      const status = s.weeklyAttendance[i];
      if (status === "P") present++;
      else if (status === "A") absent++;
      else if (status === "Excused") excused++;
    });
    return { week: `W${w}`, Present: present, Absent: absent, Excused: excused };
  });

  return (
    <PageLayout>
    <div className="metrics-page">
      <header className="metrics-page__header">
        <div>
          <h1>Student Metrics</h1>
          <p className="metrics-page__sub">Track effort, attendance, satisfaction, and analytics per team</p>
        </div>
        <div className="metrics-page__controls">
          <select
            className="field-select metrics-page__team-select"
            value={selectedTeamId || ""}
            onChange={handleTeamChange}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {metrics.loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Stats Overview */}
          <div className="metrics-stats">
            <div className="metrics-stat-card">
              <span className="metrics-stat-card__value">{metrics.students.length}</span>
              <span className="metrics-stat-card__label">Students</span>
            </div>
            <div className="metrics-stat-card">
              <span className="metrics-stat-card__value" style={{ color: "var(--primary)" }}>
                {metrics.students.length > 0
                  ? (metrics.students.reduce((s, st) => s + st.avgHours, 0) / metrics.students.length).toFixed(1)
                  : "—"}
              </span>
              <span className="metrics-stat-card__label">Avg Hrs/Week</span>
            </div>
            <div className="metrics-stat-card">
              <span className="metrics-stat-card__value" style={{ color: "#22c55e" }}>
                {metrics.attendanceSummary.total > 0
                  ? `${((metrics.attendanceSummary.present / metrics.attendanceSummary.total) * 100).toFixed(0)}%`
                  : "—"}
              </span>
              <span className="metrics-stat-card__label">Attendance Rate</span>
            </div>
            <div className="metrics-stat-card">
              <span
                className="metrics-stat-card__value"
                style={{ color: currentRating ? RATING_COLORS[currentRating] : "var(--text-muted)" }}
              >
                {currentRating || "—"}
              </span>
              <span className="metrics-stat-card__label">Week {selectedWeek} Rating</span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="metrics-charts-row">
            {/* Weekly Trends Line Chart */}
            <div className="metrics-card">
              <h3 className="metrics-card__title">Weekly Trends</h3>
              {metrics.weeklyAverages.some((w) => w.avgHours > 0 || w.attendanceRate > 0) ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={metrics.weeklyAverages}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: "Hours", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, 100]} label={{ value: "Att %", angle: 90, position: "insideRight", style: { fontSize: 11 } }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="left" type="monotone" dataKey="avgHours" stroke="#0f766e" strokeWidth={2} name="Avg Hours" dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="attendanceRate" stroke="#22c55e" strokeWidth={2} name="Attendance %" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="metrics-empty">No data yet</p>
              )}
            </div>

            {/* Effort Distribution Pie Chart */}
            <div className="metrics-card">
              <h3 className="metrics-card__title">Hours Distribution</h3>
              {metrics.effortDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={metrics.effortDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }) => `${name} ${value}h`}
                      labelLine={{ strokeWidth: 1 }}
                      dataKey="value"
                    >
                      {metrics.effortDistribution.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}h`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="metrics-empty">No effort data yet</p>
              )}
            </div>
          </div>

          {/* Satisfaction Timeline */}
          <div className="metrics-card">
            <div className="metrics-card__header">
              <h3 className="metrics-card__title">Satisfaction Ratings</h3>
              <div className="metrics-week-nav">
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={selectedWeek <= 1}
                  onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
                >
                  Prev
                </button>
                <span className="metrics-week-nav__label">Week {selectedWeek}</span>
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={selectedWeek >= TOTAL_WEEKS}
                  onClick={() => setSelectedWeek((w) => Math.min(TOTAL_WEEKS, w + 1))}
                >
                  Next
                </button>
              </div>
            </div>
            <div className="metrics-rating-timeline">
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => {
                const r = metrics.teamRatings[w];
                return (
                  <div
                    key={w}
                    className={`metrics-rating-chip ${r ? `metrics-rating-chip--${r.toLowerCase()}` : "metrics-rating-chip--empty"} ${w === selectedWeek ? "metrics-rating-chip--selected" : ""}`}
                    onClick={() => setSelectedWeek(w)}
                  >
                    <span className="metrics-rating-chip__week">W{w}</span>
                    <span className="metrics-rating-chip__value">{r ? r.charAt(0) : "—"}</span>
                  </div>
                );
              })}
            </div>
            <div className="metrics-rating-buttons" style={{ marginTop: "var(--spacing)" }}>
              {RATING_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={`metrics-rating-btn metrics-rating-btn--${option.toLowerCase()} ${metrics.teamRatings[selectedWeek] === option ? "metrics-rating-btn--active" : ""}`}
                  onClick={() => handleRatingChange(selectedWeek, option)}
                  disabled={saving}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Attendance Bar Chart */}
          {attendanceBarData.some((d) => d.Present + d.Absent + d.Excused > 0) && (
            <div className="metrics-card">
              <h3 className="metrics-card__title">Attendance Overview</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attendanceBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Present" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Absent" stackId="a" fill="#ef4444" />
                  <Bar dataKey="Excused" stackId="a" fill="#eab308" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Effort Points Table */}
          <div className="metrics-card">
            <h3 className="metrics-card__title">
              Effort Points (Hours)
              <span className="metrics-card__hint">Click cells to enter hours</span>
            </h3>

            {metrics.students.length === 0 ? (
              <p className="metrics-empty">
                No students found. Import students via{" "}
                <Link to="/admin" style={{ color: "var(--primary)" }}>
                  Admin &gt; Import Students
                </Link>
              </p>
            ) : (
              <div className="metrics-table-wrapper">
                <table className="metrics-table">
                  <thead>
                    <tr>
                      <th className="metrics-table__sticky">Student</th>
                      {Array.from({ length: TOTAL_WEEKS }, (_, i) => (
                        <th key={i + 1}>W{i + 1}</th>
                      ))}
                      <th className="metrics-table__total">Total</th>
                      <th className="metrics-table__total">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.students.map((student) => (
                      <tr key={student.netid}>
                        <td className="metrics-table__sticky metrics-table__name">
                          <span>{student.first_name} {student.last_name}</span>
                          <span className="metrics-table__netid">{student.netid}</span>
                        </td>
                        {Array.from({ length: TOTAL_WEEKS }, (_, i) => {
                          const w = i + 1;
                          const editKey = `${student.netid}-${w}`;
                          const val = effortEdits[editKey] !== undefined ? effortEdits[editKey] : (student.efforts[w] || "");
                          return (
                            <td key={w} className="metrics-table__cell">
                              <input
                                className="metrics-table__input"
                                type="number"
                                min="0"
                                max="80"
                                step="0.5"
                                value={val}
                                onChange={(e) => handleEffortChange(student.netid, w, e.target.value)}
                                placeholder="—"
                              />
                            </td>
                          );
                        })}
                        <td className="metrics-table__total-cell">
                          {student.totalHours > 0 ? student.totalHours.toFixed(1) : "—"}
                        </td>
                        <td className="metrics-table__total-cell">
                          {student.avgHours > 0 ? student.avgHours.toFixed(1) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Student Analytics Table */}
          {metrics.students.length > 0 && (
            <div className="metrics-card">
              <h3 className="metrics-card__title">Student Analytics</h3>
              <div className="metrics-table-wrapper">
                <table className="metrics-table metrics-analytics-table">
                  <thead>
                    <tr>
                      <th className="metrics-table__sticky">Name</th>
                      <th>NetID</th>
                      <th>Total Hours</th>
                      <th>Avg Hours</th>
                      <th>Attendance</th>
                      <th>Weeks Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.students
                      .slice()
                      .sort((a, b) => b.totalHours - a.totalHours)
                      .map((s) => (
                        <tr key={s.netid}>
                          <td className="metrics-table__sticky metrics-table__name">
                            <span>{s.first_name} {s.last_name}</span>
                          </td>
                          <td style={{ textAlign: "center", fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>{s.netid}</td>
                          <td style={{ textAlign: "center", fontWeight: 600 }}>{s.totalHours > 0 ? `${s.totalHours.toFixed(1)}h` : "—"}</td>
                          <td style={{ textAlign: "center", fontWeight: 600, color: "var(--primary)" }}>{s.avgHours > 0 ? `${s.avgHours.toFixed(1)}h` : "—"}</td>
                          <td style={{ textAlign: "center", fontWeight: 600, color: s.attendanceRate >= 80 ? "#22c55e" : s.attendanceRate >= 50 ? "#eab308" : "#ef4444" }}>
                            {s.attendanceRate > 0 ? `${s.attendanceRate.toFixed(0)}%` : "—"}
                          </td>
                          <td style={{ textAlign: "center" }}>{s.weeksReported}/{TOTAL_WEEKS}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Toast message={message} onDismiss={() => setMessage(null)} />
    </div>
    </PageLayout>
  );
}

export default Metrics;
