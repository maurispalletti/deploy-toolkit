export default function Card({ title, sub, children, className = "" }) {
  return (
    <div className={`card ${className}`}>
      {title && <h1 className="card-title">{title}</h1>}
      {sub && <p className="card-sub">{sub}</p>}
      {children}
    </div>
  );
}
