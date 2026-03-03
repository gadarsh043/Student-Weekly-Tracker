import { useEffect, useState, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";
import { TOTAL_WEEKS } from "../utils/constants";

/**
 * Aggregates all analytics data for the Metrics page:
 * per-student stats, weekly averages, attendance summaries, ratings, and contribution.
 */
export function useMetrics(teamId, teamCode) {
  const [students, setStudents] = useState([]);
  const [teamRatings, setTeamRatings] = useState({});
  const [weeklyAverages, setWeeklyAverages] = useState([]);
  const [effortDistribution, setEffortDistribution] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, absent: 0, excused: 0, total: 0 });
  const [ratingCounts, setRatingCounts] = useState({ Excellent: 0, Good: 0, Ok: 0, Bad: 0 });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!teamId || !teamCode) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const match = teamCode.match(/T(\d+)/i);
    const teamIndex = match ? parseInt(match[1]) : null;

    const [rosterRes, effortRes, attendanceRes, ratingsRes] = await Promise.all([
      teamIndex
        ? supabase.from("student_roster").select("*").eq("team_index", teamIndex).order("last_name")
        : { data: [] },
      supabase.from("student_effort_points").select("*").eq("team_id", teamId),
      teamIndex
        ? supabase.from("attendance_records").select("*").eq("team_index", teamIndex)
        : { data: [] },
      supabase.from("team_ratings").select("*").eq("team_id", teamId),
    ]);

    const roster = rosterRes.data || [];
    const efforts = effortRes.data || [];
    const attendanceRecords = attendanceRes.data || [];
    const ratings = ratingsRes.data || [];

    // Build effort + contribution maps: {netid: {week: {effort, contrib}}}
    const effortMap = {};
    const contribMap = {};
    efforts.forEach((e) => {
      if (!effortMap[e.student_netid]) effortMap[e.student_netid] = {};
      if (!contribMap[e.student_netid]) contribMap[e.student_netid] = {};
      effortMap[e.student_netid][e.week_number] = e.effort_points;
      contribMap[e.student_netid][e.week_number] = e.contribution_points ?? 0;
    });

    // Build attendance map
    const attendanceMap = {};
    attendanceRecords.forEach((a) => {
      if (!attendanceMap[a.student_netid]) attendanceMap[a.student_netid] = {};
      attendanceMap[a.student_netid][a.week_number] = a.status;
    });

    // Ratings
    const ratingsMap = {};
    const rCounts = { Excellent: 0, Good: 0, Ok: 0, Bad: 0 };
    ratings.forEach((r) => {
      ratingsMap[r.week_number] = r.rating;
      if (rCounts[r.rating] !== undefined) rCounts[r.rating]++;
    });
    setTeamRatings(ratingsMap);
    setRatingCounts(rCounts);

    // Per-student stats
    const studentStats = roster.map((s) => {
      const studentEffort = effortMap[s.netid] || {};
      const studentContrib = contribMap[s.netid] || {};
      const studentAttendance = attendanceMap[s.netid] || {};

      const effortValues = Object.values(studentEffort).filter((v) => v > 0);
      const totalHours = effortValues.reduce((sum, v) => sum + v, 0);
      const avgHours = effortValues.length > 0 ? totalHours / effortValues.length : 0;
      const weeksReported = effortValues.length;

      const contribValues = Object.values(studentContrib).filter((v) => v > 0);
      const avgContribution = contribValues.length > 0
        ? contribValues.reduce((sum, v) => sum + v, 0) / contribValues.length
        : 0;

      const attendanceValues = Object.values(studentAttendance);
      const presentCount = attendanceValues.filter((v) => v === "P").length;
      const totalAttendance = attendanceValues.filter((v) => v === "P" || v === "A" || v === "Excused").length;
      const attendanceRate = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

      const weeklyEffort = Array.from({ length: TOTAL_WEEKS }, (_, i) => studentEffort[i + 1] || 0);
      const weeklyAttendance = Array.from({ length: TOTAL_WEEKS }, (_, i) => studentAttendance[i + 1] || "");

      return {
        netid: s.netid,
        first_name: s.first_name,
        last_name: s.last_name,
        team_index: s.team_index,
        name: `${s.first_name} ${s.last_name}`,
        totalHours,
        avgHours,
        avgContribution,
        attendanceRate,
        weeksReported,
        weeklyEffort,
        weeklyAttendance,
        efforts: studentEffort,
        contributions: studentContrib,
      };
    });

    setStudents(studentStats);

    // Effort distribution
    setEffortDistribution(
      studentStats
        .filter((s) => s.totalHours > 0)
        .map((s) => ({ name: `${s.first_name} ${s.last_name?.charAt(0)}.`, value: parseFloat(s.totalHours.toFixed(1)) }))
    );

    // Attendance summary
    let present = 0, absent = 0, excused = 0;
    attendanceRecords.forEach((a) => {
      if (a.status === "P") present++;
      else if (a.status === "A") absent++;
      else if (a.status === "Excused") excused++;
    });
    setAttendanceSummary({ present, absent, excused, total: present + absent + excused });

    // Weekly averages
    const weekAvgs = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
      const w = i + 1;
      const weekEfforts = studentStats.map((s) => s.efforts[w] || 0).filter((v) => v > 0);
      const avgHrs = weekEfforts.length > 0 ? weekEfforts.reduce((a, b) => a + b, 0) / weekEfforts.length : 0;
      const weekAtts = studentStats.map((s) => s.weeklyAttendance[i]);
      const totalMarked = weekAtts.filter((v) => v === "P" || v === "A" || v === "Excused").length;
      const presentW = weekAtts.filter((v) => v === "P").length;
      const attRate = totalMarked > 0 ? (presentW / totalMarked) * 100 : 0;
      return { week: `W${w}`, avgHours: parseFloat(avgHrs.toFixed(1)), attendanceRate: parseFloat(attRate.toFixed(0)) };
    });
    setWeeklyAverages(weekAvgs);

    setLoading(false);
  }, [teamId, teamCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    students,
    teamRatings,
    weeklyAverages,
    effortDistribution,
    attendanceSummary,
    ratingCounts,
    loading,
    reload: loadData,
  };
}
