import { useEffect, useState } from "react";
import { api } from "../api";
import KpiCard from "../components/KpiCard";
import ComparisonBarChart from "../components/ComparisonBarChart";
import DistrictChart from "../components/DistrictChart";
import AllocationMap from "../components/AllocationMap";
import { downloadDistributionPlanCsv } from "../csvExport";

const fmtTonnes = (v) => `${Math.round(v).toLocaleString()} t`;
const fmtRupees = (v) => `₹${Math.round(v).toLocaleString()}`;
const fmtRupeesPerTonne = (v) => `₹${Math.round(v).toLocaleString()}/t`;

// Mirrors src/config.py COST_PER_TONNE_PER_KM — used to estimate transport cost
// for a single district client-side from quantity + distance, without a new API.
const COST_PER_TONNE_PER_KM = 2.5;

function districtStatus(d) {
  if (d.demand <= 0) return { emoji: "🟢", label: "Surplus" };
  const unmetPct = d.optimized_unmet / d.demand;
  if (unmetPct <= 0.02) return { emoji: "🟢", label: "Surplus" };
  if (unmetPct <= 0.2) return { emoji: "🟡", label: "Moderate" };
  return { emoji: "🔴", label: "Deficit" };
}

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
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [showMaharashtraCharts, setShowMaharashtraCharts] = useState(false);

  const loadScenarios = () => {
    setScenariosError(null);
    api.getScenarios().then(setScenarios).catch((e) => setScenariosError(e.message));
  };

  useEffect(() => {
    loadScenarios();
    api.getDistricts().then(setDistricts).catch(() => {});
    api.getWarehouses().then(setWarehouses).catch(() => {});
  }, []);

  const totalStockCapacity = warehouses.reduce((s, w) => s + w.capacity_tonnes, 0);
  const districtsAtRisk = result
    ? result.district_results.filter((d) => districtStatus(d).label !== "Surplus").length
    : null;

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
    ? result.district_results.slice().sort((a, b) => {
        if (a.district === selectedDistrict) return -1;
        if (b.district === selectedDistrict) return 1;
        return b.demand - a.demand;
      })
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

  const districtInfo = districts.find((d) => d.name === selectedDistrict);
  const districtResult = result?.district_results.find((d) => d.district === selectedDistrict);
  const districtPrediction = prediction?.district_demand.find((d) => d.district === selectedDistrict);

  const warehouseCapacityByName = Object.fromEntries(warehouses.map((w) => [w.name, w.capacity_tonnes]));
  const availableSupplyForDistrict = districtInfo
    ? districtInfo.serving_warehouses.reduce((s, w) => s + (warehouseCapacityByName[w.warehouse] || 0), 0)
    : null;

  const districtRoutes = (result?.routes || []).filter((r) => r.district === selectedDistrict);
  const nearestWarehouseKm = districtInfo?.serving_warehouses?.[0]?.distance_km ?? null;
  const distanceByWarehouse = Object.fromEntries(
    (districtInfo?.serving_warehouses || []).map((w) => [w.warehouse, w.distance_km])
  );
  const optimizedDistrictCost = districtRoutes.reduce((sum, r) => {
    const km = distanceByWarehouse[r.warehouse];
    return sum + (km != null ? r.quantity * km * COST_PER_TONNE_PER_KM : 0);
  }, 0);
  const baselineDistrictCostApprox =
    nearestWarehouseKm != null && districtResult
      ? districtResult.baseline_allocation * nearestWarehouseKm * COST_PER_TONNE_PER_KM
      : null;
  const baselineDistrictCostPerTonne =
    baselineDistrictCostApprox != null && districtResult?.baseline_allocation > 0
      ? baselineDistrictCostApprox / districtResult.baseline_allocation
      : null;
  const optimizedDistrictCostPerTonne =
    districtResult?.optimized_allocation > 0 ? optimizedDistrictCost / districtResult.optimized_allocation : null;

  const baselineDelivered = result ? result.total_demand - result.baseline_unmet : 0;
  const optimizedDelivered = result ? result.total_demand - result.optimized_unmet : 0;
  const baselineCostPerTonne = baselineDelivered > 0 ? result.baseline_cost / baselineDelivered : 0;
  const optimizedCostPerTonne = optimizedDelivered > 0 ? result.optimized_cost / optimizedDelivered : 0;

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 56 }}>
      <div className="dashboard-header">
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: "1.7rem" }}>Scenario Dashboard</h1>
          <p style={{ color: "var(--text-muted)" }}>
            Select Region &rarr; Predict Demand &rarr; Supply-Demand Analysis &rarr; Optimize Distribution &rarr; Optimized Routes Map &rarr; Impact Analysis &rarr; Generate Report
          </p>
        </div>
      </div>

      <div style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
        Maharashtra Overview
      </div>
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KpiCard label="Total warehouses" value={warehouses.length || "—"} />
        <KpiCard label="Total warehouse stock" value={warehouses.length ? fmtTonnes(totalStockCapacity) : "—"} />
        <KpiCard label="Districts covered" value={districts.length || "—"} />
        <KpiCard
          label="Districts at risk"
          value={districtsAtRisk === null ? "Pending" : districtsAtRisk}
        />
      </div>

      {selectedDistrict && (
        <>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--primary-dark)", marginBottom: 8, textTransform: "uppercase" }}>
            {selectedDistrict} &mdash; Selected District
          </div>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <KpiCard
              label="Predicted demand"
              value={districtResult ? fmtTonnes(districtResult.demand) : districtPrediction ? fmtTonnes(districtPrediction.demand) : "Pending"}
            />
            <KpiCard
              label="Available supply (nearby warehouses)"
              value={availableSupplyForDistrict != null ? fmtTonnes(availableSupplyForDistrict) : "—"}
            />
            <KpiCard
              label="Optimized allocation"
              value={districtResult ? fmtTonnes(districtResult.optimized_allocation) : "Pending"}
            />
            <KpiCard
              label="Unmet demand"
              value={districtResult ? fmtTonnes(districtResult.optimized_unmet) : "Pending"}
            />
          </div>
        </>
      )}

      <div className="card region-bar" style={{ marginBottom: 20 }}>
        <div className="field" style={{ minWidth: 220 }}>
          Select Region
          <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}>
            <option value="">All Maharashtra (35 districts)</option>
            {districts.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
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
            {predicting ? "Predicting..." : "Predict Demand"}
          </button>
        </div>
      </div>

      {selectedDistrict && districtInfo && (
        <div className="card district-profile" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 12px" }}>{selectedDistrict} district profile</h3>
          <div className="district-profile-grid">
            <div className="profile-item">
              <span className="profile-label">Population</span>
              <span className="profile-value">{districtInfo.population.toLocaleString()}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Nearby warehouses</span>
              <span className="profile-value">
                {districtInfo.serving_warehouses.length
                  ? districtInfo.serving_warehouses
                      .map((w) => `${w.warehouse.replace("WH_", "")} (${w.distance_km} km)`)
                      .join(", ")
                  : "none configured"}
              </span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Available supply (nearby warehouses)</span>
              <span className="profile-value">
                {availableSupplyForDistrict != null ? fmtTonnes(availableSupplyForDistrict) : "n/a"}
              </span>
            </div>
            {districtResult ? (
              <>
                <div className="profile-item">
                  <span className="profile-label">Predicted demand</span>
                  <span className="profile-value">{fmtTonnes(districtResult.demand)}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Optimized allocation</span>
                  <span className="profile-value">{fmtTonnes(districtResult.optimized_allocation)}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Unmet demand</span>
                  <span className="profile-value">{fmtTonnes(districtResult.optimized_unmet)}</span>
                </div>
              </>
            ) : districtPrediction ? (
              <div className="profile-item">
                <span className="profile-label">Predicted demand</span>
                <span className="profile-value">{fmtTonnes(districtPrediction.demand)}</span>
              </div>
            ) : (
              <div className="profile-item">
                <span className="profile-label">Demand / allocation</span>
                <span className="profile-value" style={{ color: "var(--text-muted)" }}>
                  Run Predict Demand to see this district's forecast
                </span>
              </div>
            )}
          </div>
        </div>
      )}

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
              <h3 style={{ margin: "0 0 4px" }}>
                {selectedDistrict ? `${selectedDistrict} Demand Forecast` : "Maharashtra Demand Forecast"}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0 }}>
                {selectedDistrict && districtPrediction
                  ? `Predicted demand for ${selectedDistrict}: ${fmtTonnes(districtPrediction.demand)}`
                  : `${fmtTonnes(prediction.total_demand)} needed across 35 districts · ${fmtTonnes(prediction.total_supply)} available in warehouses`}
              </p>
            </div>
            {!result && (
              <button className="btn btn-primary" disabled={optimizing} onClick={optimizeDistribution}>
                {optimizing ? "Optimizing..." : "Optimize Distribution"}
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

          {!result && selectedDistrict && districtPrediction ? (
            <div style={{ marginTop: 16 }}>
              <DistrictChart
                data={[{ district: selectedDistrict, demand: Math.round(districtPrediction.demand) }]}
                seriesKeys={["demand"]}
              />
              <button
                className="btn btn-ghost"
                style={{ marginTop: 12 }}
                onClick={() => setShowMaharashtraCharts((v) => !v)}
              >
                {showMaharashtraCharts ? "Hide" : "Show"} Maharashtra-wide demand forecast
              </button>
              {showMaharashtraCharts && (
                <div style={{ marginTop: 16 }}>
                  <DistrictChart
                    data={sortedPredictedDistricts.map((d) => ({ district: d.district, demand: Math.round(d.demand) }))}
                    seriesKeys={["demand"]}
                  />
                </div>
              )}
            </div>
          ) : (
            !result && (
              <div style={{ marginTop: 16 }}>
                <DistrictChart
                  data={sortedPredictedDistricts.map((d) => ({ district: d.district, demand: Math.round(d.demand) }))}
                  seriesKeys={["demand"]}
                />
              </div>
            )
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
          <h2 style={{ fontSize: "1.15rem", margin: "0 0 12px" }}>Impact Analysis: Before vs. After Grainify</h2>
          <div className="kpi-grid">
            <KpiCard label="Total predicted demand" value={fmtTonnes(result.total_demand)} />
            <KpiCard label="Total warehouse supply" value={fmtTonnes(result.total_supply)} />
            <KpiCard
              label="Cost efficiency vs. baseline (per tonne)"
              value={`${result.cost_savings_pct.toFixed(1)}%`}
              positive={result.cost_savings_pct > 0}
              negative={result.cost_savings_pct < 0}
            />
            <KpiCard
              label="Unmet demand reduction"
              value={`${result.unmet_reduction_pct.toFixed(1)}%`}
              positive={result.unmet_reduction_pct > 0}
              negative={result.unmet_reduction_pct < 0}
            />
          </div>

          {result.cost_savings_pct < 0 && (
            <div className="error-banner" style={{ marginBottom: 20, background: "#fff7ec", borderColor: "#fde3b8", color: "var(--primary-dark)" }}>
              Even on a fair cost-per-tonne basis, this run's optimized routing costs more than the baseline's.
              That can happen when supply ({fmtTonnes(result.total_supply)}) is severely short of demand
              ({fmtTonnes(result.total_demand)}) and every district's equity floor forces routing through
              unusually expensive, distant warehouses. Re-check the scenario/data if this seems extreme.
            </div>
          )}

          <div className="chart-grid">
            <div className="card chart-card">
              <h3>Transport cost per tonne delivered</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: -8, marginBottom: 12 }}>
                The fair efficiency comparison &mdash; baseline and optimized deliver different total tonnage, so
                raw total cost alone isn't comparable.
              </p>
              <ComparisonBarChart
                baselineValue={baselineCostPerTonne}
                optimizedValue={optimizedCostPerTonne}
                valueFormatter={fmtRupeesPerTonne}
              />
              <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: 12, marginBottom: 0 }}>
                Totals: baseline {fmtRupees(result.baseline_cost)} for {fmtTonnes(baselineDelivered)} delivered
                &middot; optimized {fmtRupees(result.optimized_cost)} for {fmtTonnes(optimizedDelivered)} delivered.
              </p>
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

          {selectedDistrict && districtResult && (
            <div className="card chart-card" style={{ marginBottom: 24 }}>
              <h3>{selectedDistrict} District Impact</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: -8, marginBottom: 12 }}>
                Cost totals reflect different delivered quantities (see Allocation before/after), so compare the
                per-tonne figures shown below each for a fair efficiency read.
              </p>
              <div className="district-profile-grid">
                <div className="profile-item">
                  <span className="profile-label">Demand</span>
                  <span className="profile-value">{fmtTonnes(districtResult.demand)}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Allocation before</span>
                  <span className="profile-value">{fmtTonnes(districtResult.baseline_allocation)}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Allocation after</span>
                  <span className="profile-value">{fmtTonnes(districtResult.optimized_allocation)}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Unmet before</span>
                  <span className="profile-value">{fmtTonnes(districtResult.baseline_unmet)}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Unmet after</span>
                  <span className="profile-value">{fmtTonnes(districtResult.optimized_unmet)}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Cost before (est., nearest warehouse)</span>
                  <span className="profile-value">
                    {baselineDistrictCostApprox != null ? `≈ ${fmtRupees(baselineDistrictCostApprox)}` : "—"}
                  </span>
                  {baselineDistrictCostPerTonne != null && (
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {fmtRupeesPerTonne(baselineDistrictCostPerTonne)}
                    </span>
                  )}
                </div>
                <div className="profile-item">
                  <span className="profile-label">Cost after (optimized routes)</span>
                  <span className="profile-value">{fmtRupees(optimizedDistrictCost)}</span>
                  {optimizedDistrictCostPerTonne != null && (
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {fmtRupeesPerTonne(optimizedDistrictCostPerTonne)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="card chart-card" style={{ marginBottom: 24 }}>
            <h3>Optimized Routes Map</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: -8, marginBottom: 12 }}>
              Districts shaded by unmet demand severity (darker = more shortage). Lines show the
              optimized warehouse &rarr; district routing plan.
            </p>
            <AllocationMap result={result} districts={districts} focusDistrict={selectedDistrict || null} />
            <div className="map-legend">
              <span>Unmet demand:</span>
              <span className="map-legend-swatch" style={{ background: "#cde2fb" }} /> Low
              <span className="map-legend-swatch" style={{ background: "#3987e5" }} /> Medium
              <span className="map-legend-swatch" style={{ background: "#0d366b" }} /> High
            </div>
          </div>

          <div className="card chart-card" style={{ marginBottom: 24 }}>
            <h3>
              {selectedDistrict
                ? `${selectedDistrict} Allocation — Before vs After Grainify`
                : "District-level allocation"}
            </h3>
            {selectedDistrict && districtResult ? (
              <>
                <DistrictChart
                  data={districtData.filter((d) => d.district === selectedDistrict)}
                />
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: 12 }}
                  onClick={() => setShowMaharashtraCharts((v) => !v)}
                >
                  {showMaharashtraCharts ? "Hide" : "Show"} Maharashtra-wide allocation chart
                </button>
                {showMaharashtraCharts && (
                  <div style={{ marginTop: 16 }}>
                    <DistrictChart data={districtData} />
                  </div>
                )}
              </>
            ) : (
              <DistrictChart data={districtData} />
            )}
          </div>

          <div className="card chart-card" style={{ marginBottom: 24 }}>
            <h3>Supply-Demand Analysis</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: -8, marginBottom: 12 }}>
              🟢 Surplus/met &middot; 🟡 Moderate shortage &middot; 🔴 Critical deficit &mdash; status is based on
              unmet demand after optimized distribution.
            </p>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Status</th>
                    <th>Demand</th>
                    <th>Baseline alloc.</th>
                    <th>Baseline unmet</th>
                    <th>Optimized alloc.</th>
                    <th>Optimized unmet</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDistricts.map((d) => {
                    const status = districtStatus(d);
                    return (
                      <tr key={d.district} className={d.district === selectedDistrict ? "table-row-highlight" : ""}>
                        <td>{d.district}</td>
                        <td>{status.emoji} {status.label}</td>
                        <td>{fmtTonnes(d.demand)}</td>
                        <td>{fmtTonnes(d.baseline_allocation)}</td>
                        <td>{fmtTonnes(d.baseline_unmet)}</td>
                        <td>{fmtTonnes(d.optimized_allocation)}</td>
                        <td>{fmtTonnes(d.optimized_unmet)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button className="btn btn-ghost" onClick={() => downloadDistributionPlanCsv(result)}>
            Generate Report (CSV)
          </button>
        </>
      )}
    </div>
  );
}
