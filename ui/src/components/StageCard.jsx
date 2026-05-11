import LiveLog from "./LiveLog.jsx";

export default function StageCard({ name, status, lines, open }) {
  // status: "idle" | "running" | "done" | "error"
  return (
    <div className={`stage ${open ? "open" : ""}`}>
      <div className="stage-head">
        <div className={`stage-dot ${status}`} />
        <div className="stage-name">{name}</div>
      </div>
      {open && (
        <div className="stage-log-wrap">
          <LiveLog lines={lines} />
        </div>
      )}
    </div>
  );
}
