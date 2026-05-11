export default function StatusRow({ state, title, meta, action }) {
  // state: "ok" | "fail" | "pending"
  return (
    <div className="status">
      <div className={`status-icon ${state}`}>
        {state === "ok" && "✓"}
        {state === "fail" && "✕"}
        {state === "pending" && "…"}
      </div>
      <div className="status-body">
        <div className="status-title">{title}</div>
        {meta && <div className="status-meta">{meta}</div>}
      </div>
      {action && <div className="status-action">{action}</div>}
    </div>
  );
}
