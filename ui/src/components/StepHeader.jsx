export default function StepHeader({ current, total = 7 }) {
  return (
    <>
      <div className="brand">
        <div className="brand-flame" />
        <div className="brand-name">deploy-toolkit</div>
      </div>
      <div className="steps">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`step-dot ${i < current - 1 ? "done" : ""} ${i === current - 1 ? "active" : ""}`} />
        ))}
      </div>
    </>
  );
}
