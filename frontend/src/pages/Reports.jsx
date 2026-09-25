import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";
import KpiCard from "../components/KpiCard";

const fmtDate = (iso) => new Date(iso).toLocaleDateString();

const SCENARIO_COLOR = {
  Normal: "#94a3b8",
  "Mild El Nino": "#eda100",
  "Severe El Nino": "#e34948",
};

export default function Reports() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getHistory(100)
      .then((data) => setRuns(data.slice().reverse())) // chronological order for trend lines
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const chartData = useMemo(
    () =>
      runs.map((r, i) => ({
        index: i + 1,
        date: fmtDate(r.created_at),
        scenario: r.scenario,
        cost_savings_pct: Number(r.cost_savings_pct.toFixed(1)),
        unmet_reduction_pct: Number(r.unmet_reduction_pct.toFixed(1)),
      })),
    [runs]
  );

  const averages = useMemo(() => {
    if (runs.length === 0) return null;
    const avg = (key) => runs.reduce((s, r) => s + r[key], 0) / runs.length;
    return {
      avgCostSavings: avg("cost_savings_pct"),
      avgUnmetReduction: avg("unmet_reduction_pct"),
    };
  }, [runs]);

  const countsByScenario = useMemo(() => {
    const counts = {};
    for (const r of runs) counts[r.scenario] = (counts[r.scenario] || 0) + 1;
    return counts;
  }, [runs]);

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 56 }}>
      <h1 style={{ fontSize: "1.7rem", marginBottom: 6 }}>Reports &amp; Analytics</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
        Trends across every optimization run &mdash; how consistently the optimizer beats the
        conventional baseline over time.
      </p>

      {error && (
        <div className="error-banner">
          {error}{" "}
          <button className="btn btn-ghost" style={{ padding: "4px 14px", marginLeft: 8 }} onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="state">
          <div className="spinner" />
          Loading report data...
        </div>
      )}

      {!loading && runs.length === 0 && !error && (
        <div className="card state">
          No runs yet &mdash; go to the Dashboard and run a few scenarios to build up report data.
        </div>
      )}

      {!loading && runs.length > 0 && (
        <>
          <div className="kpi-grid">
            <KpiCard label="Total runs" value={runs.length} />
            <KpiCard label="Average cost reduction" value={`${averages.avgCostSavings.toFixed(1)}%`} positive />
            <KpiCard label="Average unmet reduction" value={`${averages.avgUnmetReduction.toFixed(1)}%`} positive />
            <KpiCard
              label="Scenarios run"
              value={Object.entries(countsByScenario).map(([s, c]) => `${s}: ${c}`).join(" · ")}
            />
          </div>

          <div className="chart-grid">
            <div className="card chart-card">
              <h3>Cost reduction over time</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d6" vertical={false} />
                  <XAxis dataKey="index" tick={{ fontSize: 11 }} label={{ value: "Run #", position: "insideBottom", offset: -4, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" width={50} />
                  <Tooltip
                    formatter={(v) => `${v}%`}
                    labelFormatter={(i) => `Run #${i} — ${chartData[i - 1]?.scenario || ""} (${chartData[i - 1]?.date || ""})`}
                  />
                  <Line type="monotone" dataKey="cost_savings_pct" name="Cost reduction" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card chart-card">
              <h3>Unmet demand reduction over time</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d6" vertical={false} />
                  <XAxis dataKey="index" tick={{ fontSize: 11 }} label={{ value: "Run #", position: "insideBottom", offset: -4, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" width={50} />
                  <Tooltip
                    formatter={(v) => `${v}%`}
                    labelFormatter={(i) => `Run #${i} — ${chartData[i - 1]?.scenario || ""} (${chartData[i - 1]?.date || ""})`}
                  />
                  <Line type="monotone" dataKey="unmet_reduction_pct" name="Unmet demand reduction" stroke="#15803d" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Run #</th>
                    <th>Scenario</th>
                    <th>Date</th>
                    <th>Cost reduction</th>
                    <th>Unmet reduction</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData
                    .slice()
                    .reverse()
                    .map((r) => (
                      <tr key={r.index}>
                        <td>{r.index}</td>
                        <td>
                          <span
                            className="scenario-dot"
                            style={{ background: SCENARIO_COLOR[r.scenario] || "#94a3b8" }}
                          />
                          {r.scenario}
                        </td>
                        <td>{r.date}</td>
                        <td>{r.cost_savings_pct}%</td>
                        <td>{r.unmet_reduction_pct}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
