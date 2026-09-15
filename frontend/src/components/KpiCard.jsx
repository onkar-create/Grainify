export default function KpiCard({ label, value, positive = false }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${positive ? " positive" : ""}`}>{value}</div>
    </div>
  );
}
