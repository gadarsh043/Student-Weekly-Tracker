import { useEffect, useState, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";

/**
 * Custom hook that manages teams, membership, and team members.
 *
 * @param {string|null} userId  - Current authenticated user's id
 * @param {boolean}     isAdmin - Whether the current user has the admin role
 */
export function useTeams(userId, isAdmin) {
  const [teams, setTeams] = useState([]);
  const [myTeam, setMyTeamState] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [rosterMembers, setRosterMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * Load team members from team_memberships (signed-up users).
   */
  const loadTeamMembers = useCallback(async (teamId) => {
    const { data, error } = await supabase
      .from("team_memberships")
      .select(
        `
        user_id,
        role,
        joined_at,
        profiles (
          full_name,
          first_name,
          last_name,
          email,
          netid,
          student_id
        )
      `
      )
      .eq("team_id", teamId)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("Error loading team members:", error);
    }

    setTeamMembers(
      data?.map((row) => ({
        user_id: row.user_id,
        role: row.role,
        joined_at: row.joined_at,
        full_name:
          row.profiles?.full_name ||
          (row.profiles?.first_name && row.profiles?.last_name
            ? `${row.profiles.first_name} ${row.profiles.last_name}`
            : "") ||
          "",
        first_name: row.profiles?.first_name || "",
        last_name: row.profiles?.last_name || "",
        email: row.profiles?.email || "",
        netid: row.profiles?.netid || "",
        student_id: row.profiles?.student_id || "",
      })) || []
    );
  }, []);

  /**
   * Load roster members (from CSV import) for a given team index.
   * These are students who haven't necessarily signed up yet.
   */
  const loadRosterMembers = useCallback(async (teamCode) => {
    // Extract team index from code like "T1" -> 1
    const match = teamCode?.match(/T(\d+)/i);
    if (!match) {
      setRosterMembers([]);
      return;
    }
    const teamIndex = parseInt(match[1]);

    const { data, error } = await supabase
      .from("student_roster")
      .select("*")
      .eq("team_index", teamIndex)
      .order("last_name");

    if (error) {
      // Table might not exist yet — fail silently
      setRosterMembers([]);
      return;
    }

    setRosterMembers(data || []);
  }, []);

  /**
   * Set the active team and load its members.
   */
  const setMyTeam = useCallback(
    async (team) => {
      setMyTeamState(team);
      if (team) {
        await Promise.all([
          loadTeamMembers(team.id),
          loadRosterMembers(team.code),
        ]);
      } else {
        setTeamMembers([]);
        setRosterMembers([]);
      }
    },
    [loadTeamMembers, loadRosterMembers]
  );

  /**
   * Join a team (student flow).
   */
  const joinTeam = useCallback(
    async (teamId) => {
      if (!userId) return;

      const confirmed = window.confirm(
        "Are you sure you want to join this team?"
      );
      if (!confirmed) return;

      const { error } = await supabase.from("team_memberships").insert({
        team_id: teamId,
        user_id: userId,
        role: "member",
      });

      if (error) {
        console.error("Error joining team:", error);
        return error.message;
      }

      await loadTeamsAndMembership();
      return null;
    },
    [userId]
  );

  /**
   * Load all active teams (used for both admin and students).
   */
  const loadTeamsAndMembership = useCallback(async () => {
    setLoading(true);

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("*")
      .eq("is_active", true)
      .order("id");

    if (teamsError) {
      console.error("Error loading teams:", teamsError);
    }

    setTeams(teamsData || []);

    // For non-admin users, check their team membership
    if (!isAdmin && userId) {
      const { data: membership } = await supabase
        .from("team_memberships")
        .select("team_id, teams(*)")
        .eq("user_id", userId)
        .maybeSingle();

      if (membership?.teams) {
        setMyTeamState(membership.teams);
        await Promise.all([
          loadTeamMembers(membership.team_id),
          loadRosterMembers(membership.teams.code),
        ]);
      } else {
        setMyTeamState(null);
        setTeamMembers([]);
        setRosterMembers([]);
      }
    }

    setLoading(false);
  }, [userId, isAdmin, loadTeamMembers, loadRosterMembers]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    loadTeamsAndMembership();
  }, [userId, loadTeamsAndMembership]);

  return {
    teams,
    myTeam,
    teamMembers,
    rosterMembers,
    loading,
    setMyTeam,
    joinTeam,
    loadTeamMembers,
    loadRosterMembers,
  };
}
