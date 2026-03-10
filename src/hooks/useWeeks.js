import { useEffect, useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../utils/supabaseClient";

/**
 * Custom hook that manages the weekly timeline state and editing forms.
 *
 * @param {string|null} teamId  - The id of the currently active team
 * @param {string|null} userId  - Current authenticated user's id
 * @param {object|null} myTeam  - Full team object (for name, links, etc.)
 */
export function useWeeks(teamId, userId, myTeam) {
  const [weeks, setWeeks] = useState([]);
  const [selectedWeekState, setSelectedWeekState] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [savingWeek, setSavingWeek] = useState(false);

  // ---------- data fetching ----------

  const loadWeeks = useCallback(
    async (tid) => {
      const targetTeamId = tid || teamId;
      if (!targetTeamId) return;

      const { data, error } = await supabase
        .from("team_weeks")
        .select(
          `
        id,
        team_id,
        week_number,
        weekly_reports (
          id,
          comments,
          team_leader_week
        )
      `
        )
        .eq("team_id", targetTeamId)
        .order("week_number");

      if (error) {
        console.error("Error loading weeks:", error);
        return;
      }

      const mapped =
        data?.map((w) => ({
          id: w.id,
          team_id: w.team_id,
          week_number: w.week_number,
          report: w.weekly_reports?.[0] || null,
        })) || [];

      setWeeks(mapped);

      // Re-select the same week after reload when possible,
      // but do not force a default (let the caller decide).
      setSelectedWeekState((prev) => {
        if (!prev) return null;
        const refreshed = mapped.find((w) => w.id === prev.id);
        return refreshed || null;
      });
    },
    [teamId]
  );

  // ---------- week selection ----------

  const setSelectedWeek = useCallback((week) => {
    setSelectedWeekState(week);
  }, []);

  // Sync editing state whenever selectedWeek changes
  useEffect(() => {
    if (!selectedWeekState) return;
    const report = selectedWeekState.report;
    setEditingReport(
      report
        ? {
            id: report.id,
            comments: report.comments ?? "",
            team_leader_week: report.team_leader_week ?? "",
          }
        : {
            id: null,
            comments: "",
            team_leader_week: "",
          }
    );
  }, [selectedWeekState]);

  // ---------- save ----------

  const saveWeekDetails = useCallback(async () => {
    if (!selectedWeekState || !myTeam) return;
    setSavingWeek(true);

    try {
      if (editingReport) {
        const upsertPayload = {
          team_id: myTeam.id,
          week_id: selectedWeekState.id,
          submitted_by: userId,
          comments: editingReport.comments || null,
          team_leader_week: editingReport.team_leader_week || null,
        };

        const { error: rError } = await supabase
          .from("weekly_reports")
          .upsert(upsertPayload, { onConflict: "team_id,week_id" });

        if (rError) {
          console.error("Failed to save report:", rError);
          return { error: rError };
        }
      }

      await loadWeeks(myTeam.id);
      return { error: null };
    } finally {
      setSavingWeek(false);
    }
  }, [selectedWeekState, myTeam, userId, editingReport, loadWeeks]);

  // ---------- week PDF generation (single + blob for ZIP) ----------

  const generateWeekPdf = useCallback(
    async (week, { asBlob = false } = {}) => {
      if (!myTeam || !week) return null;

      const { report } = week;

      // ----- Load per-week + to-date data for this team -----
      const teamCode = myTeam.code || "";
      const match = teamCode.match(/T(\d+)/i);
      const teamIndex = match ? parseInt(match[1], 10) : null;

      let roster = [];
      let attendanceMap = {};
      let effortMap = {};
      let contribMap = {};
      let teamRating = null;

      // To-date analytics
      let effortAll = [];
      let attendanceAll = [];

      try {
        if (teamIndex != null) {
          const [
            { data: rosterData },
            { data: attendanceData },
            { data: attendanceAllData },
          ] = await Promise.all([
            supabase
              .from("student_roster")
              .select("*")
              .eq("team_index", teamIndex)
              .order("last_name"),
            supabase
              .from("attendance_records")
              .select("student_netid, status")
              .eq("team_index", teamIndex)
              .eq("week_number", week.week_number),
            supabase
              .from("attendance_records")
              .select("student_netid, week_number, status")
              .eq("team_index", teamIndex)
              .lte("week_number", week.week_number),
          ]);

          roster = rosterData || [];
          attendanceMap = {};
          (attendanceData || []).forEach((r) => {
            attendanceMap[r.student_netid] = r.status;
          });
          attendanceAll = attendanceAllData || [];
        }

        if (myTeam.id && week.week_number != null) {
          const [{ data: effortData }, { data: ratingData }, { data: effortAllData }] =
            await Promise.all([
              supabase
                .from("student_effort_points")
                .select("student_netid, effort_points, contribution_points")
                .eq("team_id", myTeam.id)
                .eq("week_number", week.week_number),
              supabase
                .from("team_ratings")
                .select("rating")
                .eq("team_id", myTeam.id)
                .eq("week_number", week.week_number)
                .maybeSingle(),
              supabase
                .from("student_effort_points")
                .select("student_netid, week_number, effort_points, contribution_points")
                .eq("team_id", myTeam.id)
                .lte("week_number", week.week_number),
            ]);

          effortMap = {};
          contribMap = {};
          (effortData || []).forEach((row) => {
            effortMap[row.student_netid] = row.effort_points || 0;
            contribMap[row.student_netid] = row.contribution_points ?? 0;
          });

          teamRating = ratingData?.rating || null;
          effortAll = effortAllData || [];
        }
      } catch (e) {
        // If anything fails, we still try to generate a basic PDF.
        console.error("Failed to load week data for PDF:", e);
      }

      // ----- Compute per-week metrics -----
      const hoursValues = roster.map((s) => effortMap[s.netid] || 0).filter((v) => v > 0);
      const totalHours = hoursValues.reduce((sum, v) => sum + v, 0);
      const avgHours = hoursValues.length > 0 ? totalHours / hoursValues.length : 0;

      const attendanceStatuses = roster
        .map((s) => attendanceMap[s.netid])
        .filter((v) => v === "P" || v === "A" || v === "Excused");
      const presentCount = attendanceStatuses.filter((v) => v === "P").length;
      const attendanceRate =
        attendanceStatuses.length > 0 ? (presentCount / attendanceStatuses.length) * 100 : 0;

      // ----- Build to-date student analytics (up to this week) -----
      const effortByNetid = {};
      (effortAll || []).forEach((row) => {
        if (!effortByNetid[row.student_netid]) {
          effortByNetid[row.student_netid] = [];
        }
        if (row.effort_points && row.effort_points > 0) {
          effortByNetid[row.student_netid].push(row.effort_points);
        }
      });

      const attendanceByNetid = {};
      (attendanceAll || []).forEach((row) => {
        if (!attendanceByNetid[row.student_netid]) {
          attendanceByNetid[row.student_netid] = [];
        }
        if (row.status === "P" || row.status === "A" || row.status === "Excused") {
          attendanceByNetid[row.student_netid].push(row.status);
        }
      });

      const analyticsRows = roster.map((s) => {
        const hrsList = effortByNetid[s.netid] || [];
        const total = hrsList.reduce((sum, v) => sum + v, 0);
        const avg = hrsList.length > 0 ? total / hrsList.length : 0;

        const attList = attendanceByNetid[s.netid] || [];
        const presentCountTD = attList.filter((v) => v === "P").length;
        const attendanceRateTD =
          attList.length > 0 ? (presentCountTD / attList.length) * 100 : 0;

        return {
          netid: s.netid,
          name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.netid,
          totalHours: total,
          avgHours: avg,
          attendanceRate: attendanceRateTD,
          weeksReported: hrsList.length,
        };
      });

      // ----- Build PDF -----
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 14;
      let y = 16;

      const primaryColor = "#0f766e";
      const mutedColor = "#6b7280";

      // Header link: "Please visit this page [Link]"
      const teamCodeLower = (myTeam.code || "").toLowerCase();
      const teamPath = teamCodeLower || "";
      const url = teamPath
        ? `https://cs-4485-weekly-tracker.netlify.app/${teamPath}`
        : "https://cs-4485-weekly-tracker.netlify.app/";
      doc.setFontSize(10);
      doc.setTextColor(mutedColor);
      const headerPrefix = "Please visit this page ";
      doc.text(headerPrefix, marginX, y);
      const prefixWidth = doc.getTextWidth(headerPrefix);
      doc.setTextColor(primaryColor);
      doc.textWithLink("Link", marginX + prefixWidth, y, { url });
      y += 6;

      // Tno - Project title / team name
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      const teamLine = `${myTeam.code || "Team"} - ${
        myTeam.project_title || myTeam.name || "Project"
      }`;
      doc.text(teamLine, marginX, y);
      y += 6;

      // Project overview
      doc.setFontSize(10.5);
      doc.setTextColor(mutedColor);
      const overview = myTeam.project_overview || "";
      if (overview.trim()) {
        const ovLines = doc.splitTextToSize(overview, pageWidth - marginX * 2);
        doc.text(ovLines, marginX, y);
        y += ovLines.length * 4;
      } else {
        doc.text("No project overview yet.", marginX, y);
        y += 4;
      }
      y += 2;

      // Meeting link & time on one line: "(Meeting Link) [Link] - Time"
      doc.setFontSize(9.5);
      doc.setTextColor(mutedColor);
      const meetingLabel = "Meeting Link ";
      if (myTeam.meeting_link) {
        doc.text(meetingLabel, marginX, y);
        const labelWidth = doc.getTextWidth(meetingLabel);
        doc.setTextColor(primaryColor);
        doc.textWithLink("Link", marginX + labelWidth, y, { url: myTeam.meeting_link });
        doc.setTextColor(mutedColor);
        const timeText = myTeam.meeting_time ? `  -  ${myTeam.meeting_time}` : "";
        doc.text(timeText, marginX + labelWidth + doc.getTextWidth("Link"), y);
      } else if (myTeam.meeting_time) {
        doc.text(`Meeting Time: ${myTeam.meeting_time}`, marginX, y);
      } else {
        doc.text("Meeting details not set.", marginX, y);
      }
      y += 6;

      // Week heading
      doc.setDrawColor("#e5e7eb");
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 5;
      doc.setFontSize(11.5);
      doc.setTextColor(primaryColor);
      doc.text(`Week ${week.week_number}`, marginX, y);
      y += 4;

      // Team Links section: "(Label) [Link]"
      doc.setFontSize(10.5);
      doc.setTextColor(0, 0, 0);
      doc.text("Team Links", marginX, y);
      y += 4;
      doc.setFontSize(9);
      doc.setTextColor(mutedColor);

      const links = Array.isArray(myTeam.links) ? myTeam.links : [];
      if (links.length === 0) {
        doc.text("— No links added", marginX, y);
        y += 5;
      } else {
        links.forEach((link) => {
          if (y > 230) return;
          const label = link.label || "Team Link";
          const linkUrl = link.url || "";
          const prefix = `${label} `;
          doc.text(prefix, marginX, y);
          const px = doc.getTextWidth(prefix);
          doc.setTextColor(primaryColor);
          doc.textWithLink("Link", marginX + px, y, { url: linkUrl || url });
          doc.setTextColor(mutedColor);
          y += 4;
        });
      }

      y += 2;
      doc.setDrawColor("#e5e7eb");
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 6;

      // Comments
      doc.setFontSize(10.5);
      doc.setTextColor(0, 0, 0);
      doc.text("Comments", marginX, y);
      y += 4;
      doc.setFontSize(9);
      doc.setTextColor(mutedColor);
      const comments = report?.comments?.trim() || "—";
      const commentLines = doc.splitTextToSize(comments, pageWidth - marginX * 2);
      doc.text(commentLines, marginX, y);
      y += commentLines.length * 4 + 4;

      // Weekly snapshot: per-student hours / attendance / contribution
      doc.setDrawColor("#e5e7eb");
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 5;

      doc.setFontSize(10.5);
      doc.setTextColor(0, 0, 0);
      doc.text("Per-student Snapshot (this week)", marginX, y);
      y += 4;

      doc.setFontSize(8.5);
      doc.setTextColor(mutedColor);

      const colName = marginX;
      const colHrs = marginX + 70;
      const colAtt = marginX + 95;
      const colContrib = marginX + 120;

      doc.text("Student", colName, y);
      doc.text("Hours", colHrs, y);
      doc.text("Att", colAtt, y);
      doc.text("Contrib", colContrib, y);
      y += 4;

      doc.setDrawColor("#e5e7eb");
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4;

      doc.setFontSize(8.2);
      doc.setTextColor(0, 0, 0);

      roster.forEach((s) => {
        if (y > 230) return;
        const name = `${s.first_name || ""} ${s.last_name || ""}`.trim() || "";
        const hrsVal = effortMap[s.netid];
        const hrs = hrsVal != null && hrsVal > 0 ? `${hrsVal.toFixed(1)}h` : "—";
        const att = attendanceMap[s.netid] || "—";
        const contribVal = contribMap[s.netid];
        const contrib = contribVal != null && contribVal > 0 ? `${contribVal}/10` : "—";

        const nameLines = doc.splitTextToSize(name, 65);
        doc.text(nameLines, colName, y);
        doc.text(hrs, colHrs, y);
        doc.text(att === "Excused" ? "E" : att, colAtt, y);
        doc.text(contrib, colContrib, y);

        y += nameLines.length * 4;
      });

      y += 4;

      // Student analytics till this week
      doc.setDrawColor("#e5e7eb");
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 5;

      doc.setFontSize(10.5);
      doc.setTextColor(0, 0, 0);
      doc.text("Student Analytics (through this week)", marginX, y);
      y += 4;

      doc.setFontSize(8.5);
      doc.setTextColor(mutedColor);

      const colNameA = marginX;
      const colTotal = marginX + 70;
      const colAvg = marginX + 100;
      const colAttA = marginX + 130;

      doc.text("Student", colNameA, y);
      doc.text("Total Hrs", colTotal, y);
      doc.text("Avg Hrs", colAvg, y);
      doc.text("Att %", colAttA, y);
      y += 4;

      doc.setDrawColor("#e5e7eb");
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4;

      doc.setFontSize(8.2);
      doc.setTextColor(0, 0, 0);

      analyticsRows.forEach((row) => {
        if (y > 260) return;
        const name = row.name;
        const totalText = row.totalHours > 0 ? `${row.totalHours.toFixed(1)}h` : "—";
        const avgText = row.avgHours > 0 ? `${row.avgHours.toFixed(1)}h` : "—";
        const attText =
          row.attendanceRate > 0 ? `${row.attendanceRate.toFixed(0)}%` : "—";

        const nameLines = doc.splitTextToSize(name, 65);
        doc.text(nameLines, colNameA, y);
        doc.text(totalText, colTotal, y);
        doc.text(avgText, colAvg, y);
        doc.text(attText, colAttA, y);

        y += nameLines.length * 4;
      });

      y += 4;

      // Metrics footer
      doc.setDrawColor("#e5e7eb");
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 5;

      doc.setFontSize(9);
      doc.setTextColor(primaryColor);
      const metricsLine = [
        `Avg Hours (this week): ${avgHours > 0 ? `${avgHours.toFixed(1)}h` : "—"}`,
        `Attendance (this week): ${
          attendanceStatuses.length > 0 ? `${attendanceRate.toFixed(0)}%` : "—"
        }`,
        `Rating: ${teamRating || "—"}`,
      ].join("   •   ");
      const metricsLines = doc.splitTextToSize(metricsLine, pageWidth - marginX * 2);
      doc.text(metricsLines, marginX, y);

      const weekLabelNumber = String(week.week_number).padStart(2, "0");
      const filename = `Week ${weekLabelNumber}.pdf`;

      if (asBlob) {
        const blob = doc.output("blob");
        return { blob, filename };
      }

      doc.save(filename);
      return null;
    },
    [myTeam]
  );

  const handleDownloadWeek = useCallback(
    async (week) => {
      await generateWeekPdf(week, { asBlob: false });
    },
    [generateWeekPdf]
  );

  const buildWeekPdfBlob = useCallback(
    async (week) => generateWeekPdf(week, { asBlob: true }),
    [generateWeekPdf]
  );

  // ---------- auto-load when teamId changes ----------

  useEffect(() => {
    if (teamId) {
      loadWeeks(teamId);
    } else {
      setWeeks([]);
      setSelectedWeekState(null);
    }
  }, [teamId, loadWeeks]);

  return {
    weeks,
    selectedWeek: selectedWeekState,
    editingReport,
    savingWeek,
    setSelectedWeek,
    setEditingReport,
    saveWeekDetails,
    handleDownloadWeek,
    buildWeekPdfBlob,
    loadWeeks,
  };
}
