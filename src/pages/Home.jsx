import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTeams } from "../hooks/useTeams";
import { useWeeks } from "../hooks/useWeeks";
import { useWeekPanel } from "../hooks/useWeekPanel";
import { useSemesterConfig } from "../hooks/useSemesterConfig";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import AppShell from "../components/layout/AppShell";
import TopNav from "../components/layout/TopNav";
import Sidebar from "../components/layout/Sidebar";
import LoadingSpinner from "../components/common/LoadingSpinner";
import EmptyState from "../components/common/EmptyState";
import Toast from "../components/common/Toast";
import UnsavedChangesModal from "../components/common/UnsavedChangesModal";
import WeekTimeline from "../components/dashboard/WeekTimeline";
import WeekDetailPanel from "../components/dashboard/WeekDetailPanel";
import ProjectCard from "../components/project/ProjectCard";
import TeamMembersList from "../components/project/TeamMembersList";
import ProfileEditModal from "../components/profile/ProfileEditModal";
import { supabase } from "../utils/supabaseClient";

function Home() {
  const navigate = useNavigate();
  const { teamCode } = useParams();
  const {
    user,
    profile,
    isAdmin,
    sessionChecked,
    loading: authLoading,
    needsNetid,
    signInWithGoogle,
    // signInWithMicrosoft,
    logout,
    updateProfile,
    claimNetid,
    skipNetid,
  } = useAuth();

  const [netidInput, setNetidInput] = useState("");
  const [netidLoading, setNetidLoading] = useState(false);

  const [message, setMessage] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const {
    teams,
    myTeam,
    setMyTeam,
    teamMembers,
    rosterMembers,
    joinTeam: doJoinTeam,
    loadTeamMembers,
    loadRosterMembers,
  } = useTeams(user?.id, isAdmin);

  const weekProps = useWeeks(myTeam?.id, user?.id, myTeam);

  const weekPanel = useWeekPanel(
    myTeam?.id,
    myTeam?.code,
    weekProps.selectedWeek?.week_number,
    user?.id
  );

  const { weekDates } = useSemesterConfig();

  // Project detail state (must be declared before useMemo that references them)
  const [projectTitle, setProjectTitle] = useState("");
  const [projectOverview, setProjectOverview] = useState("");
  const [projectLinks, setProjectLinks] = useState([]);
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  // Team documents state
  const [teamDocuments, setTeamDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // ---------- Unsaved-changes detection ----------

  const hasProjectChanges = useMemo(() => {
    if (!myTeam || !isAdmin) return false;
    const origLinks = myTeam.links && Array.isArray(myTeam.links) ? myTeam.links : [];
    return (
      (myTeam.project_title ?? "") !== projectTitle ||
      (myTeam.project_overview ?? "") !== projectOverview ||
      JSON.stringify(origLinks) !== JSON.stringify(projectLinks) ||
      (myTeam.meeting_link ?? "") !== meetingLink ||
      (myTeam.meeting_time ?? "") !== meetingTime
    );
  }, [myTeam, isAdmin, projectTitle, projectOverview, projectLinks, meetingLink, meetingTime]);

  const hasWeekChanges = useMemo(() => {
    if (!weekProps.selectedWeek || !weekProps.editingReport) return false;
    const orig = weekProps.selectedWeek.report;
    const editing = weekProps.editingReport;
    return (
      (orig?.comments ?? "") !== (editing.comments ?? "") ||
      (orig?.team_leader_week ?? "") !== (editing.team_leader_week ?? "")
    );
  }, [weekProps.selectedWeek, weekProps.editingReport]);

  const isDirty = hasProjectChanges || hasWeekChanges;
  const { blocker, confirmOrRun } = useUnsavedChanges(isDirty);
  useEffect(() => {
    setProjectTitle(myTeam?.project_title ?? "");
    setProjectOverview(myTeam?.project_overview ?? "");
    setProjectLinks(
      myTeam?.links && Array.isArray(myTeam.links) ? myTeam.links : []
    );
    setMeetingLink(myTeam?.meeting_link ?? "");
    setMeetingTime(myTeam?.meeting_time ?? "");
    setTeamDocuments(
      myTeam?.documents && Array.isArray(myTeam.documents) ? myTeam.documents : []
    );
    if (myTeam?.id) {
      loadTeamMembers(myTeam.id);
      if (myTeam.code) loadRosterMembers(myTeam.code);
    }
  }, [myTeam?.id]);

  // Keep myTeam in sync when navigating directly to /:teamCode
  useEffect(() => {
    if (!teamCode || !teams.length) return;
    const match = teams.find(
      (t) => t.code && t.code.toLowerCase() === teamCode.toLowerCase()
    );
    if (match && match.id !== myTeam?.id) {
      confirmOrRun(() => setMyTeam(match));
    }
  }, [teamCode, teams, myTeam?.id, setMyTeam, confirmOrRun]);

  // Keep URL in sync with currently selected team
  useEffect(() => {
    const currentCode = teamCode ? teamCode.toLowerCase() : null;
    const desiredCode = myTeam?.code ? myTeam.code.toLowerCase() : null;

    // Only push a new URL when we actually have a selected team
    // and it doesn't match the current URL segment.
    if (desiredCode && currentCode !== desiredCode) {
      navigate(`/${desiredCode}`, { replace: true });
    }
    // If there's no selected team, we leave the URL as-is so that
    // direct navigation like `/t4` can still be resolved once teams load.
  }, [myTeam?.code, teamCode, navigate]);

  const saveProjectDetails = async () => {
    if (!myTeam) return;
    setSavingProject(true);
    setMessage(null);
    const updatePayload = {
      project_title: projectTitle || null,
      project_overview: projectOverview || null,
      links: projectLinks,
      meeting_link: meetingLink || null,
      meeting_time: meetingTime || null,
    };
    const { error } = await supabase
      .from("teams")
      .update(updatePayload)
      .eq("id", myTeam.id);
    if (error) {
      setMessage(error.message || "Failed to save project.");
    } else {
      setMyTeam({ ...myTeam, ...updatePayload });
      setMessage("Project saved.");
    }
    setSavingProject(false);
  };

  // ---------- Team document handlers ----------

  const handleDocUpload = async () => {
    if (!myTeam) return;
    const label = prompt("Enter a label for this document (e.g. Week 3 Report, Design Doc):");
    if (!label) return;

    // Trigger file picker
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.ppt,.pptx,.doc,.docx,.txt,.xlsx,.xls,.csv,.png,.jpg,.jpeg";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadingDoc(true);
      const teamCode = myTeam.code || `team-${myTeam.id}`;
      const timestamp = Date.now();
      const filePath = `teams/${teamCode}/docs/${timestamp}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("weekly-reports")
        .upload(filePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        setMessage("Upload failed: " + uploadError.message);
        setUploadingDoc(false);
        return;
      }

      const newDoc = {
        label,
        file_path: filePath,
        type: file.name.split(".").pop().toLowerCase(),
        uploaded_at: new Date().toISOString(),
      };
      const updatedDocs = [...teamDocuments, newDoc];

      const { error: dbError } = await supabase
        .from("teams")
        .update({ documents: updatedDocs })
        .eq("id", myTeam.id);

      if (dbError) {
        console.error("DB error:", dbError);
        setMessage("Failed to save document metadata.");
      } else {
        setTeamDocuments(updatedDocs);
        setMyTeam({ ...myTeam, documents: updatedDocs });
        setMessage("Document uploaded.");
      }
      setUploadingDoc(false);
    };
    input.click();
  };

  const handleDocView = async (doc) => {
    const { data, error } = await supabase.storage
      .from("weekly-reports")
      .createSignedUrl(doc.file_path, 600);

    if (error || !data?.signedUrl) {
      setMessage("Failed to get document URL.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDocDelete = async (doc) => {
    if (!myTeam) return;
    if (!confirm(`Delete "${doc.label}"?`)) return;

    const { error: storageError } = await supabase.storage
      .from("weekly-reports")
      .remove([doc.file_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    const updatedDocs = teamDocuments.filter((d) => d.file_path !== doc.file_path);
    const { error: dbError } = await supabase
      .from("teams")
      .update({ documents: updatedDocs })
      .eq("id", myTeam.id);

    if (dbError) {
      setMessage("Failed to update document list.");
    } else {
      setTeamDocuments(updatedDocs);
      setMyTeam({ ...myTeam, documents: updatedDocs });
      setMessage("Document deleted.");
    }
  };

  const handleDownloadAllDocs = async () => {
    if (!myTeam || teamDocuments.length === 0) return;
    setMessage("Preparing ZIP...");

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    for (const doc of teamDocuments) {
      const { data, error } = await supabase.storage
        .from("weekly-reports")
        .download(doc.file_path);

      if (!error && data) {
        const ext = doc.type || "bin";
        const safeName = (doc.label || "doc").replace(/[^a-zA-Z0-9-_ ]/g, "");
        zip.file(`${safeName}.${ext}`, data);
      }
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const teamName = (myTeam.name || "team").replace(/[^a-zA-Z0-9-_]/g, "-");
    a.download = `${teamName}-documents.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(null);
  };

  const handleJoinTeam = async (teamId) => {
    const msg = await doJoinTeam(teamId);
    if (msg) setMessage(msg);
  };

  const handleSaveWeek = async () => {
    await weekProps.saveWeekDetails();
    setMessage("Saved.");
  };

  if (!sessionChecked || authLoading) return <LoadingSpinner />;

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-card__title">CS-4485 Weekly Tracker</h1>
          <p className="login-card__sub">
            Sign in with your university account to submit weekly reports with your team.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={signInWithGoogle}
              style={{ width: "100%" }}
            >
              <span className="login-google-icon" />
              Sign in with Google
            </button>
            {/* Microsoft/Outlook login — uncomment when Azure provider is configured in Supabase
            <button
              type="button"
              className="btn btn--secondary"
              onClick={signInWithMicrosoft}
              style={{ width: "100%" }}
            >
              <span className="login-ms-icon" />
              Sign in with Outlook / Microsoft
            </button>
            */}
          </div>
        </div>
      </div>
    );
  }

  // NetID prompt — shown after first login if email doesn't match roster
  if (needsNetid) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-card__title">Enter Your NetID</h1>
          <p className="login-card__sub">
            We couldn't automatically match your account. Please enter your UT Dallas NetID to join your team.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <input
              className="field-input"
              type="text"
              placeholder="e.g. abc123456"
              value={netidInput}
              onChange={(e) => setNetidInput(e.target.value)}
              style={{ textAlign: "center", fontSize: "var(--font-md)" }}
            />
            <button
              type="button"
              className="btn btn--primary"
              disabled={!netidInput.trim() || netidLoading}
              onClick={async () => {
                setNetidLoading(true);
                const result = await claimNetid(netidInput.trim());
                if (result.message) setMessage(result.message);
                setNetidLoading(false);
              }}
            >
              {netidLoading ? "Matching..." : "Submit NetID"}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={skipNetid}
              style={{ fontSize: "var(--font-sm)" }}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin always sees sidebar; student only if they have no team yet
  const showSidebar = isAdmin || !myTeam;

  return (
    <AppShell
      sidebarOpen={sidebarOpen}
      onToggleSidebar={showSidebar ? () => setSidebarOpen(true) : undefined}
      topNav={
        <TopNav
          user={user}
          profile={profile}
          isAdmin={isAdmin}
          onLogout={logout}
          onEditProfile={() => setShowProfileModal(true)}
        />
      }
      sidebar={
        showSidebar ? (
          <Sidebar
            teams={teams}
            selectedTeam={myTeam}
            onSelectTeam={(team) => {
              confirmOrRun(() => {
                setMyTeam(team);
                if (team?.code) {
                  navigate(`/${team.code.toLowerCase()}`);
                } else {
                  navigate("/");
                }
              });
            }}
            isAdmin={isAdmin}
            onJoinTeam={handleJoinTeam}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen((o) => !o)}
          />
        ) : null
      }
    >
      {showProfileModal && (
        <ProfileEditModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          profile={profile}
          onSave={async (updates) => {
            await updateProfile(updates);
            setShowProfileModal(false);
            setMessage("Profile updated.");
          }}
        />
      )}

      {!myTeam && (
        <EmptyState message="Select a team from the sidebar to get started." />
      )}

      {myTeam && (
        <>
          <ProjectCard
            team={myTeam}
            projectTitle={projectTitle}
            projectOverview={projectOverview}
            projectLinks={projectLinks}
            meetingLink={meetingLink}
            meetingTime={meetingTime}
            isAdmin={isAdmin}
            onTitleChange={setProjectTitle}
            onOverviewChange={setProjectOverview}
            onLinksChange={setProjectLinks}
            onMeetingLinkChange={setMeetingLink}
            onMeetingTimeChange={setMeetingTime}
            onSave={saveProjectDetails}
            saving={savingProject}
            teamDocuments={teamDocuments}
            onDocUpload={isAdmin ? handleDocUpload : null}
            onDocView={handleDocView}
            onDocDelete={isAdmin ? handleDocDelete : null}
            uploadingDoc={uploadingDoc}
            onDownloadAll={teamDocuments.length > 0 ? handleDownloadAllDocs : null}
          />

          <WeekTimeline
            weeks={weekProps.weeks}
            selectedWeek={weekProps.selectedWeek}
            onSelectWeek={(week) => confirmOrRun(() => weekProps.setSelectedWeek(week))}
            weekDates={weekDates}
          />

          {weekProps.selectedWeek && (
            <WeekDetailPanel
              selectedWeek={weekProps.selectedWeek}
              editingReport={weekProps.editingReport}
              onReportChange={weekProps.setEditingReport}
              onSave={handleSaveWeek}
              onDownloadWeek={weekProps.handleDownloadWeek}
              saving={weekProps.savingWeek}
              isAdmin={isAdmin}
              rosterStudents={isAdmin ? weekPanel.rosterStudents : []}
              attendance={isAdmin ? weekPanel.attendance : {}}
              effortPoints={isAdmin ? weekPanel.effortPoints : {}}
              teamRating={isAdmin ? weekPanel.teamRating : null}
              onAttendanceChange={isAdmin ? weekPanel.setAttendance : null}
              onEffortChange={isAdmin ? weekPanel.setEffortPoints : null}
              onRatingChange={isAdmin ? weekPanel.setTeamRating : null}
              contributionPoints={isAdmin ? weekPanel.contributionPoints : {}}
              onContributionChange={isAdmin ? weekPanel.setContributionPoints : null}
            />
          )}

          <TeamMembersList
            members={teamMembers}
            rosterMembers={rosterMembers}
          />
        </>
      )}

      <UnsavedChangesModal blocker={blocker} />
      <Toast message={message} onDismiss={() => setMessage(null)} />
    </AppShell>
  );
}

export default Home;
