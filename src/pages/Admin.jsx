import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSemesterConfig } from "../hooks/useSemesterConfig";
import { supabase } from "../utils/supabaseClient";
import PageLayout from "../components/layout/PageLayout";
import Toast from "../components/common/Toast";
import LoadingSpinner from "../components/common/LoadingSpinner";
import CsvImportPanel from "../components/admin/CsvImportPanel";

function Admin() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, sessionChecked, loading: authLoading } = useAuth();
  const [message, setMessage] = useState(null);
  const [teams, setTeams] = useState([]);
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [membersByTeam, setMembersByTeam] = useState({});
  const [allProfiles, setAllProfiles] = useState([]);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamCode, setNewTeamCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingMemberTeamId, setAddingMemberTeamId] = useState(null);
  const [rosterByTeam, setRosterByTeam] = useState({});
  const [addingRosterTeamId, setAddingRosterTeamId] = useState(null);
  const [newRosterFirst, setNewRosterFirst] = useState("");
  const [newRosterLast, setNewRosterLast] = useState("");
  const [newRosterNetid, setNewRosterNetid] = useState("");
  const [activeTab, setActiveTab] = useState("teams");

  // Semester config
  const semConfig = useSemesterConfig();
  const [editStartDate, setEditStartDate] = useState("");
  const [editHolidays, setEditHolidays] = useState([]);

  useEffect(() => {
    if (!semConfig.loading) {
      setEditStartDate(semConfig.startDate);
      setEditHolidays(semConfig.holidays);
    }
  }, [semConfig.loading, semConfig.startDate, semConfig.holidays]);

  useEffect(() => {
    if (sessionChecked && !authLoading) {
      if (!user || !isAdmin) navigate("/", { replace: true });
    }
  }, [sessionChecked, authLoading, user, isAdmin]);

  useEffect(() => {
    if (user && isAdmin) {
      loadTeams();
      loadAllProfiles();
    }
  }, [user, isAdmin]);

  const loadTeams = async () => {
    const { data } = await supabase.from("teams").select("*").order("id");
    setTeams(data || []);
  };

  const loadAllProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, first_name, last_name, email, netid, role")
      .order("email");
    setAllProfiles(data || []);
  };

  const loadMembers = async (teamId) => {
    const { data } = await supabase
      .from("team_memberships")
      .select(`user_id, role, joined_at, profiles (full_name, first_name, last_name, email, netid, role)`)
      .eq("team_id", teamId)
      .order("joined_at", { ascending: true });
    setMembersByTeam((prev) => ({
      ...prev,
      [teamId]: (data || []).map((row) => ({
        user_id: row.user_id,
        role: row.role,
        profile_role: row.profiles?.role ?? null,
        full_name:
          row.profiles?.full_name ||
          [row.profiles?.first_name, row.profiles?.last_name].filter(Boolean).join(" ") ||
          "",
        email: row.profiles?.email || "",
        netid: row.profiles?.netid || "",
      })),
    }));
  };

  const loadRoster = async (teamId) => {
    // Find team_index from team code (e.g. "T3" → 3)
    const team = teams.find((t) => t.id === teamId);
    if (!team?.code) {
      setRosterByTeam((prev) => ({ ...prev, [teamId]: [] }));
      return;
    }
    const match = team.code.match(/T(\d+)/i);
    if (!match) {
      setRosterByTeam((prev) => ({ ...prev, [teamId]: [] }));
      return;
    }
    const teamIndex = parseInt(match[1]);
    const { data } = await supabase
      .from("student_roster")
      .select("id, netid, first_name, last_name, team_index, matched_profile_id")
      .eq("team_index", teamIndex)
      .order("last_name");
    setRosterByTeam((prev) => ({ ...prev, [teamId]: data || [] }));
  };

  const handleMoveRosterStudent = async (studentId, currentTeamId, newTeamIndex) => {
    if (!newTeamIndex) return;
    const idx = parseInt(newTeamIndex);
    if (isNaN(idx)) return;
    const { error } = await supabase
      .from("student_roster")
      .update({ team_index: idx })
      .eq("id", studentId);
    if (error) {
      setMessage("Failed to move student: " + error.message);
    } else {
      setMessage("Student moved to T" + idx + ".");
      loadRoster(currentTeamId);
    }
  };

  const handleRemoveRosterStudent = async (studentId, teamId) => {
    if (!window.confirm("Remove this student from the roster entirely?")) return;
    const { error } = await supabase
      .from("student_roster")
      .delete()
      .eq("id", studentId);
    if (error) {
      setMessage("Failed to remove: " + error.message);
    } else {
      setMessage("Student removed from roster.");
      loadRoster(teamId);
    }
  };

  const handleAddRosterStudent = async (teamId) => {
    if (!newRosterFirst.trim() || !newRosterLast.trim() || !newRosterNetid.trim()) {
      setMessage("First name, last name, and NetID are required.");
      return;
    }
    const team = teams.find((t) => t.id === teamId);
    const match = team?.code?.match(/T(\d+)/i);
    if (!match) {
      setMessage("Team has no valid code (e.g. T1). Cannot determine team_index.");
      return;
    }
    const teamIndex = parseInt(match[1]);
    const { error } = await supabase
      .from("student_roster")
      .insert({
        first_name: newRosterFirst.trim(),
        last_name: newRosterLast.trim(),
        netid: newRosterNetid.trim().toLowerCase(),
        team_index: teamIndex,
      });
    if (error) {
      setMessage("Failed to add student: " + (error.message.includes("duplicate") ? "NetID already exists in roster." : error.message));
    } else {
      setMessage(`${newRosterFirst.trim()} ${newRosterLast.trim()} added to roster.`);
      setNewRosterFirst("");
      setNewRosterLast("");
      setNewRosterNetid("");
      setAddingRosterTeamId(null);
      loadRoster(teamId);
    }
  };

  useEffect(() => {
    if (expandedTeamId) {
      loadMembers(expandedTeamId);
      loadRoster(expandedTeamId);
    }
  }, [expandedTeamId, teams]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim() || saving) return;
    setSaving(true);
    setMessage(null);
    const { data: newTeam, error: teamErr } = await supabase
      .from("teams")
      .insert({ name: newTeamName.trim(), code: newTeamCode.trim() || null, is_active: true })
      .select("id")
      .single();
    if (teamErr) {
      setMessage(teamErr.message);
      setSaving(false);
      return;
    }
    const weekRows = Array.from({ length: semConfig.totalWeeks }, (_, i) => ({
      team_id: newTeam.id,
      week_number: i + 1,
    }));
    await supabase.from("team_weeks").insert(weekRows);
    setMessage("Team created.");
    setNewTeamName("");
    setNewTeamCode("");
    await loadTeams();
    setSaving(false);
  };

  const startEditTeam = (team) => {
    setEditingTeam(team.id);
    setEditName(team.name || "");
    setEditCode(team.code || "");
    setEditActive(team.is_active !== false);
  };

  const handleSaveTeam = async () => {
    if (!editingTeam || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("teams")
      .update({ name: editName.trim() || null, code: editCode.trim() || null, is_active: editActive })
      .eq("id", editingTeam);
    if (error) setMessage(error.message);
    else {
      setMessage("Team updated.");
      setEditingTeam(null);
      await loadTeams();
    }
    setSaving(false);
  };

  const handleRemoveMember = async (teamId, userId) => {
    if (!window.confirm("Remove this member from the team?")) return;
    const { error } = await supabase
      .from("team_memberships")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId);
    if (error) setMessage(error.message);
    else {
      setMessage("Member removed.");
      loadMembers(teamId);
    }
  };

  const handleAddMember = async (teamId, userId) => {
    const { error } = await supabase
      .from("team_memberships")
      .insert({ team_id: teamId, user_id: userId, role: "member" });
    if (error) setMessage(error.message);
    else {
      setMessage("Member added.");
      setAddingMemberTeamId(null);
      loadMembers(teamId);
    }
  };

  const handleCsvImport = async (students) => {
    setMessage(null);
    setSaving(true);
    try {
      // Get existing teams by code (e.g. "T1", "T2", ...)
      const { data: existingTeams } = await supabase.from("teams").select("id, name, code");
      const teamMap = {};
      (existingTeams || []).forEach((t) => {
        if (t.code) {
          const match = t.code.match(/T(\d+)/i);
          if (match) teamMap[parseInt(match[1])] = t.id;
        }
      });

      // Create missing teams
      const uniqueTeamIndices = [...new Set(students.map((s) => s.teamIndex))].sort((a, b) => a - b);
      for (const idx of uniqueTeamIndices) {
        if (!teamMap[idx]) {
          const { data: newTeam } = await supabase
            .from("teams")
            .insert({ name: `Prof. Alagar - T${idx}`, code: `T${idx}`, is_active: true })
            .select("id")
            .single();
          if (newTeam) {
            teamMap[idx] = newTeam.id;
            const weekRows = Array.from({ length: 11 }, (_, i) => ({
              team_id: newTeam.id,
              week_number: i + 1,
            }));
            await supabase.from("team_weeks").insert(weekRows);
          }
        }
      }

      // Check existing students by netid — only insert new ones
      const { data: existingRoster } = await supabase
        .from("student_roster")
        .select("netid");
      const existingNetids = new Set((existingRoster || []).map((r) => r.netid));

      const newStudents = students.filter((s) => !existingNetids.has(s.netid));
      const skippedCount = students.length - newStudents.length;

      if (newStudents.length > 0) {
        const rosterRows = newStudents.map((s) => ({
          team_index: s.teamIndex,
          last_name: s.lastName,
          first_name: s.firstName,
          netid: s.netid,
          section_number: s.sectionNumber,
        }));

        const { error: rosterErr } = await supabase
          .from("student_roster")
          .insert(rosterRows);

        if (rosterErr) {
          setMessage("Roster import failed: " + rosterErr.message);
          setSaving(false);
          return;
        }
      }

      // Insert attendance records only for new students
      const attRows = [];
      for (const s of newStudents) {
        if (s.attendance.pitchDeck) {
          attRows.push({
            student_netid: s.netid,
            team_index: s.teamIndex,
            week_number: 0,
            status: s.attendance.pitchDeck,
          });
        }
        for (let w = 1; w <= 11; w++) {
          const val = s.attendance[`week${w}`];
          if (val) {
            attRows.push({
              student_netid: s.netid,
              team_index: s.teamIndex,
              week_number: w,
              status: val,
            });
          }
        }
      }

      if (attRows.length > 0) {
        await supabase
          .from("attendance_records")
          .upsert(attRows, { onConflict: "student_netid,week_number" });
      }

      const parts = [`Added ${newStudents.length} new students`];
      if (skippedCount > 0) parts.push(`${skippedCount} already existed (kept)`);
      parts.push(`across ${uniqueTeamIndices.length} teams`);
      setMessage(parts.join(", ") + ".");
      await loadTeams();
    } catch (err) {
      setMessage(err.message || "Import failed.");
    }
    setSaving(false);
  };

  if (!sessionChecked || authLoading) return <LoadingSpinner />;
  if (!user || !isAdmin) return null;

  const members = membersByTeam[expandedTeamId] || [];
  const memberIds = new Set(members.map((m) => m.user_id));
  const availableProfiles = allProfiles.filter((p) => !memberIds.has(p.id));

  return (
    <PageLayout>
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Admin Dashboard</h1>
      </header>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === "teams" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("teams")}
        >
          Teams & Members
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "import" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("import")}
        >
          Import Students
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "semester" ? "admin-tab--active" : ""}`}
          onClick={() => setActiveTab("semester")}
        >
          Semester Config
        </button>
      </div>

      {activeTab === "teams" && (
        <>
          <section className="card">
            <h2 className="card__title">Create Team</h2>
            <form onSubmit={handleCreateTeam} className="admin-form-row">
              <div className="admin-form-group">
                <span className="field-label">Team name</span>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Prof. Alagar - T1"
                  className="field-input"
                />
              </div>
              <div className="admin-form-group">
                <span className="field-label">Code (optional)</span>
                <input
                  type="text"
                  value={newTeamCode}
                  onChange={(e) => setNewTeamCode(e.target.value)}
                  placeholder="e.g. T1"
                  className="field-input"
                  style={{ minWidth: 80 }}
                />
              </div>
              <button type="submit" className="btn btn--primary" disabled={saving || !newTeamName.trim()}>
                {saving ? "Creating..." : "Create"}
              </button>
            </form>
          </section>

          <section className="card">
            <h2 className="card__title">Teams ({teams.length})</h2>
            <p className="card__sub">Click a team to manage members. Toggle active to hide from students.</p>
            <div className="admin-teams-list">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className={`admin-team-row ${!team.is_active ? "admin-team-row--inactive" : ""}`}
                >
                  <div
                    className="admin-team-row__main"
                    onClick={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
                  >
                    <div className="admin-team-row__info">
                      <span className="admin-team-row__name">{team.name}</span>
                      {team.code && <span className="admin-team-row__code">Code: {team.code}</span>}
                      {!team.is_active && <span className="admin-team-row__badge">Inactive</span>}
                    </div>
                    <div className="admin-team-row__actions" onClick={(e) => e.stopPropagation()}>
                      {editingTeam === team.id ? (
                        <>
                          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="field-input admin-team-row__edit-input" placeholder="Name" />
                          <input type="text" value={editCode} onChange={(e) => setEditCode(e.target.value)} className="field-input admin-team-row__edit-input--narrow" placeholder="Code" />
                          <label className="admin-team-row__edit-label">
                            <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} /> Active
                          </label>
                          <button type="button" onClick={handleSaveTeam} className="btn btn--primary btn--sm" disabled={saving}>Save</button>
                          <button type="button" onClick={() => setEditingTeam(null)} className="btn btn--secondary btn--sm">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => startEditTeam(team)}>Edit</button>
                          <span className="admin-members-toggle">
                            {expandedTeamId === team.id ? "▼" : "▶"} Members
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {expandedTeamId === team.id && (
                    <div className="admin-members-panel">
                      {/* Roster students (from CSV import) */}
                      <div className="admin-members-panel__header">
                        <strong className="admin-members-panel__title">Roster Students ({(rosterByTeam[team.id] || []).length})</strong>
                        {addingRosterTeamId !== team.id ? (
                          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAddingRosterTeamId(team.id)}>+ Add Student</button>
                        ) : (
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAddingRosterTeamId(null)}>Cancel</button>
                        )}
                      </div>
                      {addingRosterTeamId === team.id && (
                        <div className="admin-add-member-box">
                          <p className="admin-add-member-box__title">Add a student to the roster:</p>
                          <div className="admin-roster-add-form">
                            <input
                              type="text"
                              className="field-input"
                              placeholder="First Name"
                              value={newRosterFirst}
                              onChange={(e) => setNewRosterFirst(e.target.value)}
                            />
                            <input
                              type="text"
                              className="field-input"
                              placeholder="Last Name"
                              value={newRosterLast}
                              onChange={(e) => setNewRosterLast(e.target.value)}
                            />
                            <input
                              type="text"
                              className="field-input"
                              placeholder="NetID"
                              value={newRosterNetid}
                              onChange={(e) => setNewRosterNetid(e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              onClick={() => handleAddRosterStudent(team.id)}
                              disabled={!newRosterFirst.trim() || !newRosterLast.trim() || !newRosterNetid.trim()}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                      <ul className="admin-member-list">
                        {(rosterByTeam[team.id] || []).map((s) => (
                          <li key={s.id} className="admin-member-item">
                            <span>
                              {s.first_name} {s.last_name} — {s.netid}
                              {s.matched_profile_id && <span className="admin-roster-badge admin-roster-badge--linked"> (linked)</span>}
                              {!s.matched_profile_id && <span className="admin-roster-badge admin-roster-badge--unlinked"> (not signed up)</span>}
                            </span>
                            <span className="admin-member-item__actions">
                              <select
                                className="field-input admin-roster-move"
                                value=""
                                onChange={(e) => handleMoveRosterStudent(s.id, team.id, e.target.value)}
                              >
                                <option value="">Move to...</option>
                                {teams.filter((t) => t.id !== team.id).map((t) => (
                                  <option key={t.id} value={t.code?.match(/T(\d+)/i)?.[1] || ""}>
                                    {t.name || t.code}
                                  </option>
                                ))}
                              </select>
                              <button type="button" onClick={() => handleRemoveRosterStudent(s.id, team.id)} className="btn btn--danger btn--sm">Remove</button>
                            </span>
                          </li>
                        ))}
                        {(rosterByTeam[team.id] || []).length === 0 && <li className="admin-empty-state">No roster students for this team.</li>}
                      </ul>

                      {/* Signed-up members (from team_memberships) */}
                      <div className="admin-members-panel__header" style={{ marginTop: "var(--spacing)" }}>
                        <strong className="admin-members-panel__title">Signed-Up Members ({members.length})</strong>
                        {addingMemberTeamId !== team.id ? (
                          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAddingMemberTeamId(team.id)}>+ Add</button>
                        ) : (
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAddingMemberTeamId(null)}>Cancel</button>
                        )}
                      </div>
                      {addingMemberTeamId === team.id && (
                        <div className="admin-add-member-box">
                          <p className="admin-add-member-box__title">Select a user to add:</p>
                          <div className="admin-add-member-list">
                            {availableProfiles.length === 0 ? (
                              <p className="admin-empty-state">No users available.</p>
                            ) : (
                              availableProfiles.map((p) => (
                                <button key={p.id} type="button" onClick={() => handleAddMember(team.id, p.id)} className="admin-add-member-btn">
                                  {p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "No name"} — {p.email}
                                  {p.role === "admin" ? " (admin)" : ""}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                      <ul className="admin-member-list">
                        {members.map((m) => (
                          <li key={m.user_id} className="admin-member-item">
                            <span>{m.full_name || "(No name)"} — {m.email} {m.profile_role === "admin" ? " (admin)" : ""}</span>
                            {m.user_id !== user?.id && m.profile_role !== "admin" && (
                              <button type="button" onClick={() => handleRemoveMember(team.id, m.user_id)} className="btn btn--danger btn--sm">Remove</button>
                            )}
                          </li>
                        ))}
                        {members.length === 0 && <li className="admin-empty-state">No signed-up members yet.</li>}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
              {teams.length === 0 && <p className="admin-empty-state">No teams yet. Create one above.</p>}
            </div>
          </section>
        </>
      )}

      {activeTab === "import" && (
        <CsvImportPanel onImport={handleCsvImport} />
      )}

      {activeTab === "semester" && (
        <section className="card">
          <h2 className="card__title">Semester Configuration</h2>
          <p className="card__sub">Set the semester start date, add/remove weeks, and mark holiday weeks. All week dates auto-calculate from the start date.</p>

          <div className="admin-form-row" style={{ marginBottom: "var(--spacing)" }}>
            <div className="admin-form-group">
              <span className="field-label">Semester Start Date (Week 1)</span>
              <input
                type="date"
                className="field-input"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn--primary"
              disabled={semConfig.saving}
              onClick={async () => {
                const { error } = await semConfig.saveConfig(editStartDate, editHolidays, semConfig.totalWeeks);
                setMessage(error ? error.message : "Semester config saved.");
              }}
            >
              {semConfig.saving ? "Saving..." : "Save Config"}
            </button>
          </div>

          <div className="admin-form-row" style={{ marginBottom: "var(--spacing-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
              <span className="field-label" style={{ margin: 0 }}>Weeks: <strong>{semConfig.totalWeeks}</strong></span>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={semConfig.saving}
                onClick={async () => {
                  const { error, newTotal } = await semConfig.addWeek();
                  if (error) setMessage(error.message || "Failed to add week.");
                  else setMessage(`Week ${newTotal} added for all teams.`);
                }}
              >
                + Add Week
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                disabled={semConfig.saving || semConfig.totalWeeks <= 1}
                onClick={async () => {
                  if (!window.confirm(`Remove Week ${semConfig.totalWeeks}? This deletes that week's data for all teams.`)) return;
                  const { error } = await semConfig.removeWeek();
                  if (error) setMessage(typeof error === "string" ? error : error.message || "Failed to remove week.");
                  else setMessage(`Week ${semConfig.totalWeeks + 1} removed.`);
                }}
              >
                - Remove Week
              </button>
            </div>
          </div>

          <div className="semester-weeks-grid">
            {Array.from({ length: semConfig.totalWeeks }, (_, i) => {
              const w = i + 1;
              const isHoliday = editHolidays.includes(w);
              const weekDate = semConfig.weekDates.find((d) => d.weekNumber === w);
              return (
                <div
                  key={w}
                  className={`semester-week-card ${isHoliday ? "semester-week-card--holiday" : ""}`}
                  onClick={() => {
                    setEditHolidays((prev) =>
                      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w].sort((a, b) => a - b)
                    );
                  }}
                >
                  <span className="semester-week-card__number">Week {w}</span>
                  <span className="semester-week-card__date">
                    {weekDate ? weekDate.label : ""}
                  </span>
                  {isHoliday && <span className="semester-week-card__badge">Holiday</span>}
                </div>
              );
            })}
          </div>
          <p className="grades-weights__note" style={{ marginTop: "var(--spacing)" }}>
            Click a week to toggle it as a holiday (e.g. Spring Break). Holiday weeks are skipped in grading calculations.
          </p>
        </section>
      )}

      <Toast message={message} onDismiss={() => setMessage(null)} />
    </div>
    </PageLayout>
  );
}

export default Admin;
