"""
Orchestrates one end-to-end run: apply a scenario (e.g. El Nino drought) to the latest
district data, forecast demand, then compare Min-Cost Max-Flow optimized allocation
against the naive proportional baseline.
"""
import pandas as pd

from src.config import SCENARIOS, WAREHOUSES
from src.preprocessing import get_master_dataset
from src.forecasting import load_model, predict_demand, FEATURES
from src.network_optimizer import optimized_allocation, baseline_proportional_allocation
from src.generate_synthetic_data import generate_all


def _latest_district_snapshot(df: pd.DataFrame) -> pd.DataFrame:
    return df.sort_values("date").groupby("district").tail(1).reset_index(drop=True)


def _latest_warehouse_stock() -> dict:
    paths = generate_all()
    fci = pd.read_csv(paths["fci_stock"], parse_dates=["date"])
    latest = fci.sort_values("date").groupby("warehouse").tail(1)
    return dict(zip(latest["warehouse"], latest["stock_tonnes"]))


def apply_scenario(snapshot: pd.DataFrame, scenario_name: str) -> pd.DataFrame:
    scenario = SCENARIOS[scenario_name]
    df = snapshot.copy()
    df["rainfall_mm"] = df["normal_rainfall_mm"] * (1 + scenario["rainfall_anomaly_pct"] / 100)
    df["rainfall_anomaly_pct"] = scenario["rainfall_anomaly_pct"]
    df["mandi_arrivals_tonnes"] = df["mandi_arrivals_tonnes"] * (1 - abs(scenario["rainfall_anomaly_pct"]) / 150)
    return df


def run_scenario(scenario_name: str = "Severe El Nino") -> dict:
    df = get_master_dataset()
    snapshot = _latest_district_snapshot(df)
    scenario_df = apply_scenario(snapshot, scenario_name)

    model = load_model()
    predicted = predict_demand(model, scenario_df) * SCENARIOS[scenario_name]["demand_multiplier"]
    demand = dict(zip(scenario_df["district"], predicted))

    supply = _latest_warehouse_stock()

    optimized = optimized_allocation(supply, demand)
    baseline = baseline_proportional_allocation(supply, demand)

    cost_savings_pct = (
        100 * (baseline["total_cost"] - optimized["total_cost"]) / baseline["total_cost"]
        if baseline["total_cost"] > 0 else 0
    )
    unmet_reduction_pct = (
        100 * (baseline["total_unmet"] - optimized["total_unmet"]) / baseline["total_unmet"]
        if baseline["total_unmet"] > 0 else 0
    )

    return {
        "scenario": scenario_name,
        "demand": demand,
        "supply": supply,
        "optimized": optimized,
        "baseline": baseline,
        "cost_savings_pct": cost_savings_pct,
        "unmet_reduction_pct": unmet_reduction_pct,
    }


def print_summary(result: dict):
    print(f"\nScenario: {result['scenario']}")
    print(f"Total predicted demand: {sum(result['demand'].values()):.0f} tonnes")
    print(f"Total warehouse supply: {sum(result['supply'].values()):.0f} tonnes")
    print("\n--- Baseline (proportional) allocation ---")
    print(f"Total cost: Rs {result['baseline']['total_cost']:.0f}")
    print(f"Total unmet demand: {result['baseline']['total_unmet']:.0f} tonnes")
    print("\n--- Optimized (Min-Cost Max-Flow) allocation ---")
    print(f"Total cost: Rs {result['optimized']['total_cost']:.0f}")
    print(f"Total unmet demand: {result['optimized']['total_unmet']:.0f} tonnes")
    print(f"\nCost reduction vs baseline: {result['cost_savings_pct']:.1f}%")
    print(f"Unmet demand reduction vs baseline: {result['unmet_reduction_pct']:.1f}%")


if __name__ == "__main__":
    result = run_scenario("Severe El Nino")
    print_summary(result)
