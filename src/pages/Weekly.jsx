import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import PageLayout from "../components/layout/PageLayout";
import LoadingSpinner from "../components/common/LoadingSpinner";
import Toast from "../components/common/Toast";
import EmptyState from "../components/common/EmptyState";
import { useAuth } from "../hooks/useAuth";
import { useSemesterConfig } from "../hooks/useSemesterConfig";
import { supabase } from "../utils/supabaseClient";
import { renderMissingWeekPlaceholder, renderWeekPdfToDoc } from "../utils/weekPdf";

function parseTeamCodeIndex(code) {
  if (!code) return null;
  const match = String(code).match(/T(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function teamSortKey(team) {
  const idx = parseTeamCodeIndex(team.code);
  if (idx != null && !Number.isNaN(idx)) return { type: 0, idx };
  return { type: 1, idx: String(team.code || team.name || "").toLowerCase() };
}

export default function Weekly() {
  const navigate = useNavigate();
  const { user, isAdmin, sessionChecked, loading: authLoading } = useAuth();
  const { weekDates, totalWeeks, loading: semLoading } = useSemesterConfig();

  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(1);

  const [message, setMessage] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [progressText, setProgressText] = useState("");

  const cancelRef = useRef(false);
  const userSelectedWeekRef = useRef(false);

  useEffect(() => {
    if (sessionChecked && !authLoading) {
      if (!user) navigate("/", { replace: true });
    }
  }, [sessionChecked, authLoading, user, navigate]);

  useEffect(() => {
    const loadTeams = async () => {
      setTeamsLoading(true);
      const { data, error } = await supabase.from("teams").select("*").order("id");
      if (error) setMessage(error.message || "Failed to load teams.");
      setTeams(data || []);
      setTeamsLoading(false);
    };
    if (user && isAdmin) loadTeams();
  }, [user, isAdmin]);

  // Default week selection to the current calendar week when possible.
  useEffect(() => {
    if (semLoading) return;
    if (!weekDates || weekDates.length === 0) return;
    if (userSelectedWeekRef.current) return;
    const today = new Date().toISOString().split("T")[0];
    const current = weekDates.find((w) => w.startDate <= today && today <= w.endDate);
    if (current?.weekNumber) setSelectedWeek(current.weekNumber);
  }, [semLoading, weekDates]);

  const selectedWeekDates = useMemo(
    () => (weekDates || []).find((w) => w.weekNumber === selectedWeek) || null,
    [weekDates, selectedWeek]
  );

  const filename = useMemo(() => {
    const w = String(selectedWeek).padStart(2, "0");
    if (selectedWeekDates?.startDate && selectedWeekDates?.endDate) {
      return `Week ${w} - ${selectedWeekDates.startDate} to ${selectedWeekDates.endDate}.pdf`;
    }
    return `Week ${w}.pdf`;
  }, [selectedWeek, selectedWeekDates]);

  const handleDownload = async () => {
    if (exporting) return;
    if (!teams || teams.length === 0) {
      setMessage("No teams found.");
      return;
    }

    cancelRef.current = false;
    setExporting(true);
    setProgressText("Loading week data...");
    setMessage(null);

    try {
      const sortedTeams = teams
        .slice()
        .sort((a, b) => {
          const ka = teamSortKey(a);
          const kb = teamSortKey(b);
          if (ka.type !== kb.type) return ka.type - kb.type;
          if (ka.type === 0) return ka.idx - kb.idx;
          return ka.idx.localeCompare(kb.idx);
        });

      const teamIds = sortedTeams.map((t) => t.id);
      const { data: teamWeeks, error: weeksErr } = await supabase
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
        .in("team_id", teamIds)
        .eq("week_number", selectedWeek);

      if (weeksErr) {
        setMessage(weeksErr.message || "Failed to load week reports.");
        return;
      }

      const weekByTeamId = new Map();
      (teamWeeks || []).forEach((w) => {
        weekByTeamId.set(w.team_id, {
          id: w.id,
          team_id: w.team_id,
          week_number: w.week_number,
          report: w.weekly_reports?.[0] || null,
        });
      });

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      for (let i = 0; i < sortedTeams.length; i++) {
        if (cancelRef.current) {
          setMessage("Export cancelled.");
          return;
        }

        const team = sortedTeams[i];
        const label = team.code || team.name || `Team ${i + 1}`;
        setProgressText(`Generating ${label} (${i + 1}/${sortedTeams.length})...`);

        if (i > 0) doc.addPage();

        const wk = weekByTeamId.get(team.id);
        const hasSubmission = Boolean(wk?.report?.id);

        if (!wk || !hasSubmission) {
          renderMissingWeekPlaceholder(doc, { team, weekNumber: selectedWeek });
          continue;
        }

        await renderWeekPdfToDoc(doc, { team, week: wk });
      }

      setProgressText("Finalizing PDF...");
      const blob = doc.output("blob");
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
      setProgressText("");
    } catch (e) {
      console.error(e);
      setMessage(e?.message || "Failed to generate PDF.");
    } finally {
      setExporting(false);
      cancelRef.current = false;
    }
  };

  if (!sessionChecked || authLoading || teamsLoading) return <LoadingSpinner />;
  if (!user) return null;

  if (!isAdmin) {
    return (
      <PageLayout>
        <EmptyState message="Admin access required to use Weekly Export." />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="weekly-page">
        <header className="weekly-page__header">
          <div>
            <h1>Weekly Export</h1>
            <p className="weekly-page__sub">Download a single PDF for all teams for a specific week</p>
          </div>
          <div className="weekly-page__controls">
            <select
              className="field-select"
              value={selectedWeek}
              onChange={(e) => {
                userSelectedWeekRef.current = true;
                setSelectedWeek(parseInt(e.target.value, 10));
              }}
              disabled={exporting}
            >
              {Array.from({ length: totalWeeks || 11 }, (_, i) => i + 1).map((w) => {
                const dates = (weekDates || []).find((d) => d.weekNumber === w);
                const label = dates?.startDate && dates?.endDate ? `${dates.startDate} to ${dates.endDate}` : "";
                return (
                  <option key={w} value={w}>
                    Week {String(w).padStart(2, "0")}
                    {label ? ` — ${label}` : ""}
                  </option>
                );
              })}
            </select>
            <button type="button" className="btn btn--primary" onClick={handleDownload} disabled={exporting}>
              {exporting ? "Generating..." : "Download PDF"}
            </button>
            {exporting && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  cancelRef.current = true;
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </header>

        <section className="card">
          <h2 className="card__title">Output</h2>
          <p className="card__sub">
            File: <strong>{filename}</strong>
          </p>
          <p className="weekly-page__hint">
            Teams included: <strong>{teams.length}</strong>. Teams are ordered by code (T1, T2, …) when available.
            Missing submissions produce a placeholder page.
          </p>
          {exporting && progressText && <p className="weekly-page__progress">{progressText}</p>}
        </section>

        <Toast message={message} onDismiss={() => setMessage(null)} />
      </div>
    </PageLayout>
  );
}

