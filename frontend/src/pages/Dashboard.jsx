import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import KpiCard from "../components/KpiCard";
import ComparisonBarChart from "../components/ComparisonBarChart";
import DistrictChart from "../components/DistrictChart";

const fmtTonnes = (v) => `${Math.round(v).toLocaleString()} t`;
const fmtRupees = (v) => `₹${Math.round(v).toLocaleString()}`;

export default function Dashboard() {
  const { isOfficer } = useAuth();
  const [scenarios, setScenarios] = useState([]);
  const [scenariosError, setScenariosError] = useState(null);
  const [scenario, setScenario] = useState("Severe El Nino");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadScenarios = () => {
    setScenariosError(null);
    api.getScenarios().then(setScenarios).catch((e) => setScenariosError(e.message));
  };

  useEffect(() => {
    loadScenarios();
  }, []);

  // Viewers can't trigger new runs, so show them the latest one that exists instead.
  useEffect(() => {
    if (isOfficer) return;
    setLoading(true);
    api
      .getHistory(1)
      .then((history) => (history.length > 0 ? api.getRunDetail(history[0].id) : null))
      .then((data) => data && setResult(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isOfficer]);

  const runScenario = async (name) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.runScenario(name);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const sortedDistricts = result
    ? result.district_results.slice().sort((a, b) => b.demand - a.demand)
    : [];

  const districtData = sortedDistricts.map((d) => ({
    district: d.district,
    demand: Math.round(d.demand),
    baseline: Math.round(d.baseline_allocation),
    optimized: Math.round(d.optimized_allocation),
  }));

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 56 }}>
      <div className="dashboard-header">
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: "1.7rem" }}>Scenario Dashboard</h1>
          <p style={{ color: "var(--text-muted)" }}>
            Pick a drought severity and compare optimized vs. conventional grain allocation.
          </p>
        </div>
        {isOfficer ? (
          <div className="control-bar">
            <select
              value={scenario}
              disabled={loading || scenarios.length === 0}
              onChange={(e) => setScenario(e.target.value)}
            >
              {scenarios.length === 0 && <option>Loading scenarios...</option>}
              {scenarios.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              disabled={loading || scenarios.length === 0}
              onClick={() => runScenario(scenario)}
            >
              {loading ? "Running..." : "Run Optimization"}
            </button>
          </div>
        ) : (
          <span className="badge">Viewer &middot; showing the latest run</span>
        )}
      </div>

      {scenariosError && (
        <div className="error-banner">
          Couldn't load scenarios: {scenariosError}{" "}
          <button className="btn btn-ghost" style={{ padding: "4px 14px", marginLeft: 8 }} onClick={loadScenarios}>
            Retry
          </button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          {error}{" "}
          <button
            className="btn btn-ghost"
            style={{ padding: "4px 14px", marginLeft: 8 }}
            onClick={() => runScenario(scenario)}
          >
            Retry
          </button>
        </div>
      )}

      {loading && !result && (
        <div className="state">
          <div className="spinner" />
          Forecasting demand and solving the allocation network...
        </div>
      )}

      {!loading && !result && !error && (
        <div className="card state">
          {isOfficer ? (
            <>
              Pick a scenario above and click <strong>Run Optimization</strong> to see results.
            </>
          ) : (
            "No optimization runs yet — ask an officer to run one, or check back later."
          )}
        </div>
      )}

      {result && (
        <>
          <div className="kpi-grid">
            <KpiCard label="Total predicted demand" value={fmtTonnes(result.total_demand)} />
            <KpiCard label="Total warehouse supply" value={fmtTonnes(result.total_supply)} />
            <KpiCard label="Cost reduction vs. baseline" value={`${result.cost_savings_pct.toFixed(1)}%`} positive />
            <KpiCard label="Unmet demand reduction" value={`${result.unmet_reduction_pct.toFixed(1)}%`} positive />
          </div>

          <div className="chart-grid">
            <div className="card chart-card">
              <h3>Total transport cost</h3>
              <ComparisonBarChart
                baselineValue={result.baseline_cost}
                optimizedValue={result.optimized_cost}
                valueFormatter={fmtRupees}
              />
            </div>
            <div className="card chart-card">
              <h3>Total unmet demand</h3>
              <ComparisonBarChart
                baselineValue={result.baseline_unmet}
                optimizedValue={result.optimized_unmet}
                valueFormatter={fmtTonnes}
              />
            </div>
          </div>

          <div className="card chart-card" style={{ marginBottom: 24 }}>
            <h3>District-level allocation</h3>
            <DistrictChart data={districtData} />
          </div>

          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Demand</th>
                    <th>Baseline alloc.</th>
                    <th>Baseline unmet</th>
                    <th>Optimized alloc.</th>
                    <th>Optimized unmet</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDistricts.map((d) => (
                    <tr key={d.district}>
                      <td>{d.district}</td>
                      <td>{fmtTonnes(d.demand)}</td>
                      <td>{fmtTonnes(d.baseline_allocation)}</td>
                      <td>{fmtTonnes(d.baseline_unmet)}</td>
                      <td>{fmtTonnes(d.optimized_allocation)}</td>
                      <td>{fmtTonnes(d.optimized_unmet)}</td>
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
