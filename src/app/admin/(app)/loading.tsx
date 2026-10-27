/** Shown at once when an admin page is opened, while the server is still reading the database. */
export default function AdminLoading() {
  return (
    <div className="skel" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Đang tải...</span>
      <div className="skel-bar skel-title" />
      <div className="skel-grid">
        <div className="skel-bar skel-tile" />
        <div className="skel-bar skel-tile" />
        <div className="skel-bar skel-tile" />
        <div className="skel-bar skel-tile" />
      </div>
      <div className="skel-bar skel-row" />
      <div className="skel-bar skel-row" />
      <div className="skel-bar skel-row" />
    </div>
  );
}
