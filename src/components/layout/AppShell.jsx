export default function AppShell({ children, sidebar, topNav, sidebarOpen, onToggleSidebar }) {
  return (
    <div className="app-shell">
      {topNav}
      <div className="app-shell__body">
        {sidebar}
        {!sidebarOpen && onToggleSidebar && (
          <button
            className="sidebar-reopen"
            onClick={onToggleSidebar}
            title="Open sidebar"
          >
            Teams &rsaquo;
          </button>
        )}
        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}
