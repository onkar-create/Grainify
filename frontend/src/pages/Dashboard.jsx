import { useEffect, useState } from "react";
import { api } from "../api";
import KpiCard from "../components/KpiCard";
import ComparisonBarChart from "../components/ComparisonBarChart";
import DistrictChart from "../components/DistrictChart";
import AllocationMap from "../components/AllocationMap";
import { downloadDistributionPlanCsv } from "../csvExport";

const fmtTonnes = (v) => `${Math.round(v).toLocaleString()} t`;
const fmtRupees = (v) => `₹${Math.round(v).toLocaleString()}`;

export default function Dashboard() {
  const [scenarios, setScenarios] = useState([]);
  const [scenariosError, setScenariosError] = useState(null);
  const [scenario, setScenario] = useState("Severe El Nino");

  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState(null);

  const [result, setResult] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState(null);

  const [districts, setDistricts] = useState([]);

  const loadScenarios = () => {
    setScenariosError(null);
    api.getScenarios().then(setScenarios).catch((e) => setScenariosError(e.message));
  };

  useEffect(() => {
    loadScenarios();
    api.getDistricts().then(setDistricts).catch(() => {});
  }, []);

  const handleScenarioChange = (name) => {
    setScenario(name);
    setPrediction(null);
    setResult(null);
    setPredictError(null);
    setOptimizeError(null);
  };

  const predictDemand = async () => {
    setPredicting(true);
    setPredictError(null);
    setResult(null);
    try {
      const data = await api.predictDemand(scenario);
      setPrediction(data);
    } catch (e) {
      setPredictError(e.message);
    } finally {
      setPredicting(false);
    }
  };

  const optimizeDistribution = async () => {
    setOptimizing(true);
    setOptimizeError(null);
    try {
      const data = await api.runScenario(scenario);
      setResult(data);
    } catch (e) {
      setOptimizeError(e.message);
    } finally {
      setOptimizing(false);
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

  const sortedPredictedDistricts = prediction
    ? prediction.district_demand.slice().sort((a, b) => b.demand - a.demand)
    : [];

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 56 }}>
      <div className="dashboard-header">
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: "1.7rem" }}>Scenario Dashboard</h1>
          <p style={{ color: "var(--text-muted)" }}>
            Step 1: predict demand for a drought scenario. Step 2: optimize grain allocation against it.
          </p>
        </div>
        <div className="control-bar">
          <select
            value={scenario}
            disabled={predicting || optimizing || scenarios.length === 0}
            onChange={(e) => handleScenarioChange(e.target.value)}
          >
            {scenarios.length === 0 && <option>Loading scenarios...</option>}
            {scenarios.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            disabled={predicting || scenarios.length === 0}
            onClick={predictDemand}
          >
            {predicting ? "Predicting..." : "1. Predict Demand"}
          </button>
        </div>
      </div>

      {scenariosError && (
        <div className="error-banner">
          Couldn't load scenarios: {scenariosError}{" "}
          <button className="btn btn-ghost" style={{ padding: "4px 14px", marginLeft: 8 }} onClick={loadScenarios}>
            Retry
          </button>
        </div>
      )}

      {predictError && (
        <div className="error-banner">
          {predictError}{" "}
          <button className="btn btn-ghost" style={{ padding: "4px 14px", marginLeft: 8 }} onClick={predictDemand}>
            Retry
          </button>
        </div>
      )}

      {predicting && (
        <div className="state">
          <div className="spinner" />
          Forecasting district-wise demand...
        </div>
      )}

      {!predicting && !prediction && !predictError && (
        <div className="card state">
          Pick a scenario above and click <strong>1. Predict Demand</strong> to forecast district-wise need.
        </div>
      )}

      {prediction && (
        <div className="card chart-card" style={{ marginBottom: 24 }}>
          <div className="predict-header">
            <div>
              <h3 style={{ margin: "0 0 4px" }}>Step 1 result: predicted demand</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0 }}>
                {fmtTonnes(prediction.total_demand)} needed across 35 districts &middot; {fmtTonnes(prediction.total_supply)} available in warehouses
              </p>
            </div>
            {!result && (
              <button className="btn btn-primary" disabled={optimizing} onClick={optimizeDistribution}>
                {optimizing ? "Optimizing..." : "2. Optimize Distribution"}
              </button>
            )}
          </div>

          {optimizeError && (
            <div className="error-banner" style={{ marginTop: 16 }}>
              {optimizeError}{" "}
              <button className="btn btn-ghost" style={{ padding: "4px 14px", marginLeft: 8 }} onClick={optimizeDistribution}>
                Retry
              </button>
            </div>
          )}

          {!result && (
            <div style={{ marginTop: 16 }}>
              <DistrictChart
                data={sortedPredictedDistricts.map((d) => ({ district: d.district, demand: Math.round(d.demand) }))}
                seriesKeys={["demand"]}
              />
            </div>
          )}
        </div>
      )}

      {optimizing && !result && (
        <div className="state">
          <div className="spinner" />
          Solving the Min-Cost Max-Flow allocation network...
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
            <h3>Allocation map</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: -8, marginBottom: 12 }}>
              Districts shaded by unmet demand severity (darker = more shortage). Lines show the
              optimized warehouse &rarr; district routing plan.
            </p>
            <AllocationMap result={result} districts={districts} />
            <div className="map-legend">
              <span>Unmet demand:</span>
              <span className="map-legend-swatch" style={{ background: "#cde2fb" }} /> Low
              <span className="map-legend-swatch" style={{ background: "#3987e5" }} /> Medium
              <span className="map-legend-swatch" style={{ background: "#0d366b" }} /> High
            </div>
          </div>

          <div className="card chart-card" style={{ marginBottom: 24 }}>
            <h3>District-level allocation</h3>
            <DistrictChart data={districtData} />
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
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

          <button className="btn btn-ghost" onClick={() => downloadDistributionPlanCsv(result)}>
            Download Distribution Plan (CSV)
          </button>
        </>
      )}
    </div>
  );
}
