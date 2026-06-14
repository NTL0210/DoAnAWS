export default function WorkspaceViewTransition({ viewKey, children }) {
  return (
    <div key={viewKey} className="workspace-view-transition flex h-full flex-col">
      {children}
    </div>
  );
}
