import { useEffect, useState } from "react";
import { api } from "../api";
import DistrictChart from "../components/DistrictChart";

const fmtDate = (iso) => new Date(iso).toLocaleString();

export default function History() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api
      .getHistory()
      .then(setRuns)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const openDetail = async (id) => {
    setDetailLoading(true);
    try {
      const data = await api.getRunDetail(id);
      setSelected(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const districtData = selected
    ? selected.district_results
        .slice()
        .sort((a, b) => b.demand - a.demand)
        .map((d) => ({
          district: d.district,
          demand: Math.round(d.demand),
          baseline: Math.round(d.baseline_allocation),
          optimized: Math.round(d.optimized_allocation),
        }))
    : [];

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 56 }}>
      <h1 style={{ fontSize: "1.7rem", marginBottom: 6 }}>Run History</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
        Every scenario run is saved &mdash; click a row to see its full district-level breakdown.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {loading && (
        <div className="state">
          <div className="spinner" />
          Loading history...
        </div>
      )}

      {!loading && runs.length === 0 && (
        <div className="card state">No runs yet &mdash; go to the Dashboard and run a scenario first.</div>
      )}

      {runs.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="history-header">
            <span>Scenario</span>
            <span>Run at</span>
            <span>Cost savings</span>
            <span>Unmet reduction</span>
          </div>
          {runs.map((r) => (
            <div className="history-row" key={r.id} onClick={() => openDetail(r.id)}>
              <span>{r.scenario}</span>
              <span>{fmtDate(r.created_at)}</span>
              <span>{r.cost_savings_pct.toFixed(1)}%</span>
              <span>{r.unmet_reduction_pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}

      {detailLoading && (
        <div className="state">
          <div className="spinner" />
          Loading run detail...
        </div>
      )}

      {selected && !detailLoading && (
        <div className="card chart-card">
          <h3>
            {selected.scenario} &mdash; {fmtDate(selected.created_at)}
          </h3>
          <DistrictChart data={districtData} />
        </div>
      )}
    </div>
  );
}
