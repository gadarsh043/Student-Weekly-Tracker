import { useEffect, useState, useCallback } from "react";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { supabase } from "../utils/supabaseClient";

/**
 * Custom hook that manages the weekly timeline state, editing forms,
 * PDF uploads / downloads, and the "download all" ZIP export.
 *
 * @param {string|null} teamId  - The id of the currently active team
 * @param {string|null} userId  - Current authenticated user's id
 * @param {object|null} myTeam  - Full team object (for name, links, etc.)
 */
export function useWeeks(teamId, userId, myTeam) {
  const [weeks, setWeeks] = useState([]);
  const [selectedWeekState, setSelectedWeekState] = useState(null);
  const [editingGoal, setEditingGoal] = useState("");
  const [editingRequest, setEditingRequest] = useState("");
  const [editingReport, setEditingReport] = useState(null);
  const [savingWeek, setSavingWeek] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // ---------- data fetching ----------

  /**
   * Fetch team_weeks with nested weekly_reports for the given team.
   */
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
        goal,
        request,
        weekly_reports (
          id,
          status,
          file_path,
          comments,
          team_leader_week,
          mom_meeting,
          work_done,
          links
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
          goal: w.goal,
          request: w.request,
          report: w.weekly_reports?.[0] || null,
        })) || [];

      setWeeks(mapped);

      // Default to first week if nothing is selected yet
      if (mapped.length > 0 && !selectedWeekState) {
        const first = mapped[0];
        setSelectedWeekState(first);
        setEditingGoal(first.goal || "");
        setEditingRequest(first.request || "");
      }
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
    setEditingGoal(selectedWeekState.goal || "");
    setEditingRequest(selectedWeekState.request || "");

    const report = selectedWeekState.report;
    setEditingReport(
      report
        ? {
            id: report.id,
            status: report.status || "submitted",
            file_path: report.file_path || "",
            comments: report.comments ?? "",
            team_leader_week: report.team_leader_week ?? "",
            mom_meeting: report.mom_meeting ?? "",
            work_done: report.work_done ?? "",
          }
        : {
            id: null,
            status: "pending",
            file_path: "",
            comments: "",
            team_leader_week: "",
            mom_meeting: "",
            work_done: "",
          }
    );
  }, [selectedWeekState]);

  // ---------- save ----------

  /**
   * Save goal/request to team_weeks and report fields to weekly_reports
   * (insert or update depending on whether a report row already exists).
   */
  const saveWeekDetails = useCallback(async () => {
    if (!selectedWeekState || !myTeam) return;
    setSavingWeek(true);

    try {
      // Update team_weeks (goal + request)
      const twError = await supabase
        .from("team_weeks")
        .update({
          goal: editingGoal || null,
          request: editingRequest || null,
        })
        .eq("id", selectedWeekState.id)
        .then((r) => r.error);

      if (twError) {
        console.error("Failed to save goal/request:", twError);
        return { error: twError };
      }

      // Update or insert weekly_reports
      if (editingReport) {
        const payload = {
          status: editingReport.status || "submitted",
          comments: editingReport.comments || null,
          team_leader_week: editingReport.team_leader_week || null,
          mom_meeting: editingReport.mom_meeting || null,
          work_done: editingReport.work_done || null,
        };

        if (editingReport.id) {
          // Update existing report row
          const rError = await supabase
            .from("weekly_reports")
            .update(payload)
            .eq("id", editingReport.id)
            .then((r) => r.error);

          if (rError) {
            console.error("Failed to save report details:", rError);
            return { error: rError };
          }
        } else {
          // Insert new report row
          const { error: insertErr } = await supabase
            .from("weekly_reports")
            .insert({
              team_id: myTeam.id,
              week_id: selectedWeekState.id,
              submitted_by: userId,
              file_path: null,
              ...payload,
            });

          if (insertErr) {
            console.error("Failed to create report:", insertErr);
            return { error: insertErr };
          }
        }
      }

      // Reload weeks to reflect saved data
      await loadWeeks(myTeam.id);
      return { error: null };
    } finally {
      setSavingWeek(false);
    }
  }, [
    selectedWeekState,
    myTeam,
    userId,
    editingGoal,
    editingRequest,
    editingReport,
    loadWeeks,
  ]);

  // ---------- Document upload ----------

  /**
   * Opens a file picker, uploads a document to Supabase Storage `weekly-reports`
   * bucket, and updates or inserts the weekly_reports row.
   */
  const handleUploadClick = useCallback(
    async (week) => {
      if (!userId || !myTeam) return;

      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.ppt,.pptx,.txt,.doc,.docx";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        setUploading(true);

        try {
          const ext = file.name.split('.').pop() || 'pdf';
          const filePath = `team-${myTeam.id}/week-${week.week_number}/${userId}-${Date.now()}.${ext}`;
          const existingReport = week.report;
          const oldFilePath = existingReport?.file_path || null;

          // Remove old file if replacing
          if (oldFilePath) {
            await supabase.storage.from("weekly-reports").remove([oldFilePath]);
          }

          const { error: uploadError } = await supabase.storage
            .from("weekly-reports")
            .upload(filePath, file, {
              contentType: file.type || "application/octet-stream",
            });

          if (uploadError) throw uploadError;

          if (existingReport?.id) {
            const { error: updateError } = await supabase
              .from("weekly_reports")
              .update({
                file_path: filePath,
                submitted_by: userId,
                status: "submitted",
              })
              .eq("id", existingReport.id);
            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .from("weekly_reports")
              .insert({
                team_id: myTeam.id,
                week_id: week.id,
                submitted_by: userId,
                file_path: filePath,
                status: "submitted",
              });
            if (insertError) throw insertError;
          }

          await loadWeeks(myTeam.id);
          return { replaced: !!existingReport };
        } catch (err) {
          console.error("Upload failed:", err);
          return { error: err };
        } finally {
          setUploading(false);
        }
      };

      input.click();
    },
    [userId, myTeam, loadWeeks]
  );

  // ---------- Document delete ----------

  /**
   * Remove a document from Storage and clear the file_path on the report row.
   */
  const handleDeletePdfClick = useCallback(
    async (week) => {
      if (!week?.report?.file_path) return;

      const confirmed = window.confirm(
        "Delete this week's document from the server? You can upload a new one later."
      );
      if (!confirmed) return;

      setUploading(true);
      try {
        const { error: removeError } = await supabase.storage
          .from("weekly-reports")
          .remove([week.report.file_path]);
        if (removeError) throw removeError;

        const { error: updateError } = await supabase
          .from("weekly_reports")
          .update({ file_path: null })
          .eq("id", week.report.id);
        if (updateError) throw updateError;

        await loadWeeks(myTeam.id);
        return { error: null };
      } catch (err) {
        console.error("Delete failed:", err);
        return { error: err };
      } finally {
        setUploading(false);
      }
    },
    [myTeam, loadWeeks]
  );

  // ---------- PDF view ----------

  /**
   * Get a signed URL for the report PDF and open it in a new tab.
   */
  const handleViewReportClick = useCallback(async (week) => {
    if (!week.report) return;

    const { data, error } = await supabase
      .from("weekly_reports")
      .select("file_path")
      .eq("id", week.report.id)
      .maybeSingle();

    if (error || !data || !data.file_path) {
      if (!data?.file_path) {
        console.warn("No document uploaded for this week yet.");
      } else {
        console.error(error || "No data");
      }
      return;
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from("weekly-reports")
      .createSignedUrl(data.file_path, 60 * 10); // 10 minutes

    if (urlError || !urlData?.signedUrl) {
      console.error(urlError || "No signed URL");
      return;
    }

    window.open(urlData.signedUrl, "_blank");
  }, []);

  // ---------- download single week (PDF) ----------

  const handleDownloadWeek = useCallback(
    async (week) => {
      if (!myTeam || !week) return;
      const r = week.report;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let y = 18;
      doc.setFontSize(16);
      doc.text(`${myTeam.name || "Project"} — Week ${week.week_number}`, 14, y);
      y += 10;
      doc.setFontSize(11);
      doc.text("Goal", 14, y); y += 5;
      const goalLines = doc.splitTextToSize(week.goal || "\u2014", 180);
      doc.text(goalLines, 14, y); y += goalLines.length * 5 + 6;
      doc.text("Request", 14, y); y += 5;
      const requestLines = doc.splitTextToSize(week.request || "\u2014", 180);
      doc.text(requestLines, 14, y); y += requestLines.length * 5 + 8;
      if (r) {
        doc.text("Comments", 14, y); y += 5;
        const cl = doc.splitTextToSize(r.comments ?? "\u2014", 180);
        doc.text(cl, 14, y); y += cl.length * 5 + 6;
        doc.text("Team leader (this week)", 14, y); y += 5;
        doc.text(r.team_leader_week ?? "\u2014", 14, y); y += 8;
        doc.text("MoM / Meeting notes", 14, y); y += 5;
        const ml = doc.splitTextToSize(r.mom_meeting ?? "\u2014", 180);
        doc.text(ml, 14, y); y += ml.length * 5 + 6;
        doc.text("Work done", 14, y); y += 5;
        const wl = doc.splitTextToSize(r.work_done ?? "\u2014", 180);
        doc.text(wl, 14, y);
      }
      const teamName = (myTeam.name || "team").replace(/[^a-zA-Z0-9-_]/g, "-");
      doc.save(`${teamName}-Week${week.week_number}.pdf`);
    },
    [myTeam]
  );

  // ---------- download all (ZIP) ----------

  /**
   * Generate a ZIP file containing per-week folders. Each folder has:
   *  - week-data.pdf  (generated with jsPDF from goal, request, report fields)
   *  - submission.pdf  (the uploaded PDF, if any)
   *
   * BUG FIX: `const r = week.report;` is added before using `r` so that
   * the report reference is correctly scoped inside the loop.
   */
  const handleDownloadAll = useCallback(async () => {
    if (!myTeam || downloadingAll) return;
    setDownloadingAll(true);

    const teamName = (myTeam.name || "team").replace(/[^a-zA-Z0-9-_]/g, "-");

    try {
      const zip = new JSZip();

      for (const week of weeks || []) {
        const r = week.report; // FIX: define r before using it

        const weekNum = String(week.week_number).padStart(2, "0");
        const folderName = `${teamName}-Week${weekNum}`;
        const folder = zip.folder(folderName);

        // Week data PDF (goal, request, report fields)
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });
        let y = 18;
        doc.setFontSize(16);
        doc.text(
          `${myTeam.name || "Project"} — Week ${week.week_number}`,
          14,
          y
        );
        y += 10;
        doc.setFontSize(11);
        doc.text("Goal", 14, y);
        y += 5;
        const goalLines = doc.splitTextToSize(week.goal || "\u2014", 180);
        doc.text(goalLines, 14, y);
        y += goalLines.length * 5 + 6;
        doc.text("Request", 14, y);
        y += 5;
        const requestLines = doc.splitTextToSize(
          week.request || "\u2014",
          180
        );
        doc.text(requestLines, 14, y);
        y += requestLines.length * 5 + 8;

        if (r) {
          doc.text("Comments", 14, y);
          y += 5;
          const commentLines = doc.splitTextToSize(
            r.comments ?? "\u2014",
            180
          );
          doc.text(commentLines, 14, y);
          y += commentLines.length * 5 + 6;
          doc.text("Team leader (this week)", 14, y);
          y += 5;
          doc.text(r.team_leader_week ?? "\u2014", 14, y);
          y += 8;
          doc.text("MoM / Meeting notes", 14, y);
          y += 5;
          const momLines = doc.splitTextToSize(r.mom_meeting ?? "\u2014", 180);
          doc.text(momLines, 14, y);
          y += momLines.length * 5 + 6;
          doc.text("Work done", 14, y);
          y += 5;
          const workLines = doc.splitTextToSize(r.work_done ?? "\u2014", 180);
          doc.text(workLines, 14, y);
          y += workLines.length * 5 + 6;
        }

        if (Array.isArray(myTeam.links) && myTeam.links.length > 0) {
          doc.text("Project Links", 14, y);
          y += 5;
          myTeam.links.forEach((l) => {
            const linkLine =
              (l?.label ? `${l.label}: ` : "") + (l?.url || "\u2014");
            const linkLines = doc.splitTextToSize(linkLine, 180);
            doc.text(linkLines, 14, y);
            y += linkLines.length * 5 + 2;
          });
        }

        folder.file("week-data.pdf", doc.output("blob"));

        // Submission document for this week (if any)
        if (r?.file_path) {
          const { data: urlData, error: urlErr } = await supabase.storage
            .from("weekly-reports")
            .createSignedUrl(r.file_path, 60 * 5);
          if (!urlErr && urlData?.signedUrl) {
            const res = await fetch(urlData.signedUrl);
            if (res.ok) {
              const blob = await res.blob();
              const submissionExt = r.file_path.split('.').pop() || 'pdf';
              folder.file(`submission.${submissionExt}`, blob);
            }
          }
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${teamName}-weekly-data.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingAll(false);
    }
  }, [myTeam, weeks, downloadingAll]);

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
    editingGoal,
    editingRequest,
    editingReport,
    savingWeek,
    uploading,
    downloadingAll,
    setSelectedWeek,
    setEditingGoal,
    setEditingRequest,
    setEditingReport,
    saveWeekDetails,
    handleUploadClick,
    handleDeletePdfClick,
    handleViewReportClick,
    handleDownloadWeek,
    handleDownloadAll,
    loadWeeks,
  };
}
