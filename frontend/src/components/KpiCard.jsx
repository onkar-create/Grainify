export default function KpiCard({ label, value, positive = false, negative = false }) {
  const tone = positive ? " positive" : negative ? " negative" : "";
  return (
    <div className="card kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${tone}`}>{value}</div>
    </div>
  );
}
