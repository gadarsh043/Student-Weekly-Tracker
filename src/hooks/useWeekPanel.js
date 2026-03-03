import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../utils/supabaseClient";

/**
 * Manages per-week attendance, effort points, contribution points,
 * team rating for the WeekDetailPanel. All writes use upsert.
 */
export function useWeekPanel(teamId, teamCode, weekNumber, userId) {
  const [rosterStudents, setRosterStudents] = useState([]);
  const [attendance, setAttendanceState] = useState({});
  const [effortPoints, setEffortPointsState] = useState({});
  const [contributionPoints, setContributionPointsState] = useState({});
  const [teamRating, setTeamRatingState] = useState(null);
  const [loading, setLoading] = useState(false);

  const debounceTimers = useRef({});

  const loadRoster = useCallback(async () => {
    if (!teamCode) { setRosterStudents([]); return; }
    const match = teamCode.match(/T(\d+)/i);
    if (!match) { setRosterStudents([]); return; }
    const teamIndex = parseInt(match[1]);
    const { data } = await supabase
      .from("student_roster")
      .select("*")
      .eq("team_index", teamIndex)
      .order("last_name");
    setRosterStudents(data || []);
  }, [teamCode]);

  const loadAttendance = useCallback(async () => {
    if (!teamCode || !weekNumber) { setAttendanceState({}); return; }
    const match = teamCode.match(/T(\d+)/i);
    if (!match) return;
    const teamIndex = parseInt(match[1]);
    const { data } = await supabase
      .from("attendance_records")
      .select("student_netid, status")
      .eq("team_index", teamIndex)
      .eq("week_number", weekNumber);
    const map = {};
    (data || []).forEach((r) => { map[r.student_netid] = r.status; });
    setAttendanceState(map);
  }, [teamCode, weekNumber]);

  const loadEffort = useCallback(async () => {
    if (!teamId || !weekNumber) { setEffortPointsState({}); setContributionPointsState({}); return; }
    const { data } = await supabase
      .from("student_effort_points")
      .select("student_netid, effort_points, contribution_points")
      .eq("team_id", teamId)
      .eq("week_number", weekNumber);
    const effortMap = {};
    const contribMap = {};
    (data || []).forEach((r) => {
      effortMap[r.student_netid] = r.effort_points;
      contribMap[r.student_netid] = r.contribution_points ?? 0;
    });
    setEffortPointsState(effortMap);
    setContributionPointsState(contribMap);
  }, [teamId, weekNumber]);

  const loadRating = useCallback(async () => {
    if (!teamId || !weekNumber) { setTeamRatingState(null); return; }
    const { data } = await supabase
      .from("team_ratings")
      .select("rating")
      .eq("team_id", teamId)
      .eq("week_number", weekNumber)
      .maybeSingle();
    setTeamRatingState(data?.rating || null);
  }, [teamId, weekNumber]);

  useEffect(() => {
    if (!teamId || !weekNumber) return;
    setLoading(true);
    Promise.all([loadRoster(), loadAttendance(), loadEffort(), loadRating()])
      .finally(() => setLoading(false));
  }, [teamId, teamCode, weekNumber, loadRoster, loadAttendance, loadEffort, loadRating]);

  const setAttendance = useCallback(
    async (netid, status) => {
      setAttendanceState((prev) => ({ ...prev, [netid]: status }));
      const match = teamCode?.match(/T(\d+)/i);
      if (!match) return;
      const teamIndex = parseInt(match[1]);
      await supabase.from("attendance_records").upsert(
        { student_netid: netid, team_index: teamIndex, week_number: weekNumber, status },
        { onConflict: "student_netid,week_number" }
      );
    },
    [teamCode, weekNumber]
  );

  const upsertEffortRow = useCallback(
    async (netid, effortVal, contribVal) => {
      await supabase.from("student_effort_points").upsert(
        {
          student_netid: netid,
          team_id: teamId,
          week_number: weekNumber,
          effort_points: effortVal,
          contribution_points: contribVal,
          recorded_by: userId,
        },
        { onConflict: "student_netid,team_id,week_number" }
      );
    },
    [teamId, weekNumber, userId]
  );

  const setEffortPoints = useCallback(
    (netid, points) => {
      const numPoints = parseFloat(points) || 0;
      setEffortPointsState((prev) => ({ ...prev, [netid]: numPoints }));
      const key = `effort-${netid}`;
      if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
      debounceTimers.current[key] = setTimeout(() => {
        const currentContrib = contributionPoints[netid] ?? 0;
        upsertEffortRow(netid, numPoints, currentContrib);
      }, 300);
    },
    [teamId, weekNumber, userId, contributionPoints, upsertEffortRow]
  );

  const setContributionPoints = useCallback(
    (netid, points) => {
      const numPoints = parseInt(points) || 0;
      setContributionPointsState((prev) => ({ ...prev, [netid]: numPoints }));
      const key = `contrib-${netid}`;
      if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
      debounceTimers.current[key] = setTimeout(() => {
        const currentEffort = effortPoints[netid] ?? 0;
        upsertEffortRow(netid, currentEffort, numPoints);
      }, 300);
    },
    [teamId, weekNumber, userId, effortPoints, upsertEffortRow]
  );

  const setTeamRating = useCallback(
    async (rating) => {
      setTeamRatingState(rating);
      await supabase.from("team_ratings").upsert(
        { team_id: teamId, week_number: weekNumber, rating, rated_by: userId },
        { onConflict: "team_id,week_number" }
      );
    },
    [teamId, weekNumber, userId]
  );

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  return {
    rosterStudents,
    attendance,
    effortPoints,
    contributionPoints,
    teamRating,
    loading,
    setAttendance,
    setEffortPoints,
    setContributionPoints,
    setTeamRating,
  };
}
