import { useEffect, useState, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";
import { DEFAULT_SEMESTER_START, TOTAL_WEEKS as DEFAULT_TOTAL_WEEKS, computeWeekDates } from "../utils/constants";

/**
 * Hook for managing semester configuration: start date, holiday weeks, and total weeks.
 * Stores config in `semester_config` table (single row, key="current").
 */
export function useSemesterConfig() {
  const [startDate, setStartDate] = useState(DEFAULT_SEMESTER_START);
  const [holidays, setHolidays] = useState([]);
  const [totalWeeks, setTotalWeeks] = useState(DEFAULT_TOTAL_WEEKS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("semester_config")
      .select("*")
      .eq("config_key", "current")
      .maybeSingle();

    if (!error && data) {
      setStartDate(data.start_date || DEFAULT_SEMESTER_START);
      setHolidays(data.holiday_weeks || []);
      setTotalWeeks(data.total_weeks || DEFAULT_TOTAL_WEEKS);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = useCallback(
    async (newStartDate, newHolidays, newTotalWeeks) => {
      setSaving(true);
      const weeks = newTotalWeeks ?? totalWeeks;
      const payload = {
        config_key: "current",
        start_date: newStartDate,
        holiday_weeks: newHolidays,
        total_weeks: weeks,
      };

      const { error } = await supabase
        .from("semester_config")
        .upsert(payload, { onConflict: "config_key" });

      if (!error) {
        setStartDate(newStartDate);
        setHolidays(newHolidays);
        setTotalWeeks(weeks);
      }
      setSaving(false);
      return { error };
    },
    [totalWeeks]
  );

  /**
   * Add a week: increments total, creates team_weeks rows for all teams.
   */
  const addWeek = useCallback(async () => {
    setSaving(true);
    const newTotal = totalWeeks + 1;

    // Save updated total to semester_config
    const { error: cfgErr } = await supabase
      .from("semester_config")
      .upsert(
        { config_key: "current", start_date: startDate, holiday_weeks: holidays, total_weeks: newTotal },
        { onConflict: "config_key" }
      );

    if (cfgErr) {
      setSaving(false);
      return { error: cfgErr };
    }

    // Create team_weeks row for every active team
    const { data: teams } = await supabase
      .from("teams")
      .select("id")
      .eq("is_active", true);

    if (teams && teams.length > 0) {
      const rows = teams.map((t) => ({
        team_id: t.id,
        week_number: newTotal,
      }));
      // Use upsert to avoid duplicates if row already exists
      await supabase.from("team_weeks").upsert(rows, { onConflict: "team_id,week_number" });
    }

    setTotalWeeks(newTotal);
    setSaving(false);
    return { error: null, newTotal };
  }, [totalWeeks, startDate, holidays]);

  /**
   * Remove the last week (only if > 1). Deletes team_weeks rows for that week number.
   */
  const removeWeek = useCallback(async () => {
    if (totalWeeks <= 1) return { error: "Must have at least 1 week" };
    setSaving(true);
    const removedWeek = totalWeeks;
    const newTotal = totalWeeks - 1;

    const { error: cfgErr } = await supabase
      .from("semester_config")
      .upsert(
        {
          config_key: "current",
          start_date: startDate,
          holiday_weeks: holidays.filter((w) => w <= newTotal),
          total_weeks: newTotal,
        },
        { onConflict: "config_key" }
      );

    if (cfgErr) {
      setSaving(false);
      return { error: cfgErr };
    }

    // Remove team_weeks rows for the deleted week
    await supabase.from("team_weeks").delete().eq("week_number", removedWeek);

    setTotalWeeks(newTotal);
    setHolidays((prev) => prev.filter((w) => w <= newTotal));
    setSaving(false);
    return { error: null, newTotal };
  }, [totalWeeks, startDate, holidays]);

  const weekDates = computeWeekDates(startDate, holidays, totalWeeks);

  return {
    startDate,
    holidays,
    totalWeeks,
    weekDates,
    loading,
    saving,
    saveConfig,
    addWeek,
    removeWeek,
    toggleHoliday: useCallback(
      (weekNumber) => {
        return holidays.includes(weekNumber)
          ? holidays.filter((w) => w !== weekNumber)
          : [...holidays, weekNumber].sort((a, b) => a - b);
      },
      [holidays]
    ),
    reload: loadConfig,
  };
}
