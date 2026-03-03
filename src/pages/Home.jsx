import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTeams } from "../hooks/useTeams";
import { useWeeks } from "../hooks/useWeeks";
import { useWeekPanel } from "../hooks/useWeekPanel";
import { useSemesterConfig } from "../hooks/useSemesterConfig";
import AppShell from "../components/layout/AppShell";
import TopNav from "../components/layout/TopNav";
import Sidebar from "../components/layout/Sidebar";
import LoadingSpinner from "../components/common/LoadingSpinner";
import EmptyState from "../components/common/EmptyState";
import Toast from "../components/common/Toast";
import WeekTimeline from "../components/dashboard/WeekTimeline";
import WeekDetailPanel from "../components/dashboard/WeekDetailPanel";
import ProjectCard from "../components/project/ProjectCard";
import TeamMembersList from "../components/project/TeamMembersList";
import ProfileEditModal from "../components/profile/ProfileEditModal";
import { supabase } from "../utils/supabaseClient";

function Home() {
  const {
    user,
    profile,
    isAdmin,
    sessionChecked,
    loading: authLoading,
    needsNetid,
    signInWithGoogle,
    signInWithMicrosoft,
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

  // Project detail state
  const [projectTitle, setProjectTitle] = useState("");
  const [projectOverview, setProjectOverview] = useState("");
  const [projectLinks, setProjectLinks] = useState([]);
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  useEffect(() => {
    setProjectTitle(myTeam?.project_title ?? "");
    setProjectOverview(myTeam?.project_overview ?? "");
    setProjectLinks(
      myTeam?.links && Array.isArray(myTeam.links) ? myTeam.links : []
    );
    setMeetingLink(myTeam?.meeting_link ?? "");
    setMeetingTime(myTeam?.meeting_time ?? "");
    if (myTeam?.id) {
      loadTeamMembers(myTeam.id);
      if (myTeam.code) loadRosterMembers(myTeam.code);
    }
  }, [myTeam?.id]);

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
              setMyTeam(team);
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
            onDownloadAll={weekProps.handleDownloadAll}
            downloadingAll={weekProps.downloadingAll}
          />

          <WeekTimeline
            weeks={weekProps.weeks}
            selectedWeek={weekProps.selectedWeek}
            onSelectWeek={weekProps.setSelectedWeek}
            weekDates={weekDates}
          />

          {weekProps.selectedWeek && (
            <WeekDetailPanel
              selectedWeek={weekProps.selectedWeek}
              editingGoal={weekProps.editingGoal}
              editingRequest={weekProps.editingRequest}
              editingReport={weekProps.editingReport}
              onGoalChange={weekProps.setEditingGoal}
              onRequestChange={weekProps.setEditingRequest}
              onReportChange={weekProps.setEditingReport}
              onSave={handleSaveWeek}
              onUpload={() => weekProps.handleUploadClick(weekProps.selectedWeek)}
              onViewPdf={() => weekProps.handleViewReportClick(weekProps.selectedWeek)}
              onDeletePdf={() => weekProps.handleDeletePdfClick(weekProps.selectedWeek)}
              onDownloadWeek={weekProps.handleDownloadWeek}
              saving={weekProps.savingWeek}
              uploading={weekProps.uploading}
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

      <Toast message={message} onDismiss={() => setMessage(null)} />
    </AppShell>
  );
}

export default Home;
