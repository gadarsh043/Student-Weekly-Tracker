import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsNetid, setNeedsNetid] = useState(false);

  const isAdmin = profile?.role === "admin";

  // ---------- helpers ----------

  const fetchProfile = async (userId) => {
    const { data: profileRow, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, first_name, last_name, email, netid, student_id, role"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
    }

    return profileRow || null;
  };

  /**
   * After a user signs in, check whether they already belong to a team.
   * If not, try to auto-match them against the student_roster table using
   * the netid portion of their email (everything before the '@').
   *
   * When a match is found (and that roster row has not already been claimed):
   *  1. Mark the roster row as matched.
   *  2. Back-fill the profile with first_name, last_name, and netid from the roster.
   *  3. Automatically add them to the roster's team via team_memberships.
   */
  const tryAutoMatch = async (currentUser, currentProfile) => {
    // Admins don't need netid matching
    if (currentProfile?.role === "admin") return currentProfile;

    // Skip if the user already belongs to a team
    const { data: existingMembership } = await supabase
      .from("team_memberships")
      .select("team_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (existingMembership) return currentProfile;

    // Try matching by profile netid first, then email prefix
    const netid = currentProfile?.netid || currentUser.email?.split("@")[0] || "";
    if (!netid) {
      setNeedsNetid(true);
      return currentProfile;
    }

    // Look for a matching roster entry that hasn't been claimed yet
    const { data: rosterRow, error: rosterError } = await supabase
      .from("student_roster")
      .select("*")
      .eq("netid", netid)
      .is("matched_profile_id", null)
      .maybeSingle();

    if (rosterError) {
      console.error("Error querying student_roster:", rosterError);
      return currentProfile;
    }

    if (!rosterRow) {
      // No match found — prompt user to enter their netid manually
      if (!currentProfile?.netid) {
        setNeedsNetid(true);
      }
      return currentProfile;
    }

    // 1. Claim the roster row
    const { error: rosterUpdateError } = await supabase
      .from("student_roster")
      .update({ matched_profile_id: currentUser.id })
      .eq("id", rosterRow.id);

    if (rosterUpdateError) {
      console.error("Error updating student_roster:", rosterUpdateError);
      return currentProfile;
    }

    // 2. Back-fill profile with roster data
    const profileUpdates = {
      first_name: rosterRow.first_name || currentProfile?.first_name || null,
      last_name: rosterRow.last_name || currentProfile?.last_name || null,
      netid: rosterRow.netid || currentProfile?.netid || null,
      full_name:
        rosterRow.first_name && rosterRow.last_name
          ? `${rosterRow.first_name} ${rosterRow.last_name}`
          : currentProfile?.full_name || null,
    };

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("id", currentUser.id);

    if (profileUpdateError) {
      console.error("Error updating profile from roster:", profileUpdateError);
    }

    // 3. Auto-join the team — look up by team_index → team code "T{n}"
    if (rosterRow.team_index) {
      const teamCode = `T${rosterRow.team_index}`;
      const { data: teamRow } = await supabase
        .from("teams")
        .select("id")
        .eq("code", teamCode)
        .maybeSingle();

      if (teamRow) {
        const { error: joinError } = await supabase
          .from("team_memberships")
          .insert({
            team_id: teamRow.id,
            user_id: currentUser.id,
            role: "member",
          });

        if (joinError) {
          console.error("Error auto-joining team:", joinError);
        }
      }
    }

    setNeedsNetid(false);
    // Return the refreshed profile
    const updatedProfile = await fetchProfile(currentUser.id);
    return updatedProfile;
  };

  // ---------- manual netid claim ----------

  /**
   * Called when a user manually enters their netid.
   * Attempts to match against student_roster and auto-join team.
   */
  const claimNetid = async (netid) => {
    if (!user || !netid) return { error: "No user or netid" };

    // Save netid to profile
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ netid })
      .eq("id", user.id);

    if (profileErr) return { error: profileErr.message };

    // Try to match roster
    const { data: rosterRow } = await supabase
      .from("student_roster")
      .select("*")
      .eq("netid", netid)
      .is("matched_profile_id", null)
      .maybeSingle();

    if (rosterRow) {
      // Claim roster row
      await supabase
        .from("student_roster")
        .update({ matched_profile_id: user.id })
        .eq("id", rosterRow.id);

      // Back-fill profile
      const updates = {
        first_name: rosterRow.first_name || profile?.first_name || null,
        last_name: rosterRow.last_name || profile?.last_name || null,
        netid: rosterRow.netid,
        full_name:
          rosterRow.first_name && rosterRow.last_name
            ? `${rosterRow.first_name} ${rosterRow.last_name}`
            : profile?.full_name || null,
      };
      await supabase.from("profiles").update(updates).eq("id", user.id);

      // Auto-join team
      if (rosterRow.team_index) {
        const teamCode = `T${rosterRow.team_index}`;
        const { data: teamRow } = await supabase
          .from("teams")
          .select("id")
          .eq("code", teamCode)
          .maybeSingle();

        if (teamRow) {
          await supabase.from("team_memberships").upsert(
            { team_id: teamRow.id, user_id: user.id, role: "member" },
            { onConflict: "team_id,user_id" }
          );
        }
      }
    }

    // Refresh profile
    const updatedProfile = await fetchProfile(user.id);
    setProfile(updatedProfile);
    setNeedsNetid(false);

    return {
      error: null,
      matched: !!rosterRow,
      message: rosterRow
        ? `Matched! Joined Team T${rosterRow.team_index}.`
        : "NetID saved. You can join a team from the sidebar.",
    };
  };

  const skipNetid = () => {
    setNeedsNetid(false);
  };

  // ---------- core loader ----------

  const loadUserAndProfile = async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      setUser(null);
      setProfile(null);
      setSessionChecked(true);
      setLoading(false);
      return;
    }

    setUser(currentUser);

    let profileRow = await fetchProfile(currentUser.id);

    // Attempt auto-match on login
    profileRow = await tryAutoMatch(currentUser, profileRow);

    setProfile(profileRow);
    setSessionChecked(true);
    setLoading(false);
  };

  // ---------- public API ----------

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" },
      },
    });
  };

  const signInWithMicrosoft = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: window.location.origin,
        scopes: "email profile openid",
        queryParams: { prompt: "select_account" },
      },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    setUser(null);
    setProfile(null);
    setNeedsNetid(false);
    setSessionChecked(true);
    setLoading(false);
  };

  const updateProfile = async (updates) => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      console.error("Error updating profile:", error);
      throw error;
    }

    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  // ---------- mount ----------

  useEffect(() => {
    loadUserAndProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUserAndProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  // ---------- provider ----------

  const value = {
    user,
    profile,
    sessionChecked,
    loading,
    isAdmin,
    needsNetid,
    signInWithGoogle,
    signInWithMicrosoft,
    logout,
    updateProfile,
    claimNetid,
    skipNetid,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
