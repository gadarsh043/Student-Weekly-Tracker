import { useEffect, useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../utils/supabaseClient";
import { renderWeekPdfToDoc } from "../utils/weekPdf";

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
      const weekLabelNumber = String(week.week_number).padStart(2, "0");
      const filename = `Week ${weekLabelNumber}.pdf`;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      await renderWeekPdfToDoc(doc, { team: myTeam, week });

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
