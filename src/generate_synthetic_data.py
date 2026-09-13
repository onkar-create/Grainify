"""
Generates a synthetic-but-realistic dataset that mirrors the schema of the real sources
(FCI stock/off-take, IMD rainfall, Agmarknet arrivals, Census population) so the rest of
the pipeline can be built and tested before the real datasets are downloaded.

Swap the CSVs this writes into data/raw/ with real data of the same column names to
switch from synthetic to real without touching any other module.
"""
import os
import numpy as np
import pandas as pd

from src.config import DISTRICTS, WAREHOUSES, HISTORY_MONTHS, RANDOM_SEED

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")


def _month_range(n_months):
    end = pd.Timestamp.today().normalize().replace(day=1)
    return pd.date_range(end=end, periods=n_months, freq="MS")


def generate_rainfall_data(rng):
    """IMD-style monthly rainfall per district, with a seasonal cycle + drought years."""
    months = _month_range(HISTORY_MONTHS)
    rows = []
    for district in DISTRICTS:
        normal_mm = rng.uniform(650, 950)  # district's long-term average annual rainfall
        for i, month in enumerate(months):
            seasonal = 1.6 if month.month in (6, 7, 8, 9) else 0.25  # monsoon vs dry months
            # occasional drought years lower rainfall broadly (El Nino years)
            drought_factor = 0.55 if (month.year % 4 == 0 and month.month in range(5, 10)) else 1.0
            noise = rng.normal(1.0, 0.12)
            rainfall_mm = max(0.0, (normal_mm / 12) * seasonal * drought_factor * noise)
            rows.append({
                "district": district,
                "date": month,
                "rainfall_mm": round(rainfall_mm, 1),
                "normal_rainfall_mm": round(normal_mm / 12, 1),
            })
    return pd.DataFrame(rows)


def generate_agmarknet_data(rng, rainfall_df):
    """Mandi arrivals (tonnes) and price (INR/quintal), which fall/rise with rainfall deficit."""
    rows = []
    for _, r in rainfall_df.iterrows():
        deficit_ratio = r["rainfall_mm"] / max(r["normal_rainfall_mm"], 1e-6)
        base_arrivals = DISTRICTS[r["district"]]["base_demand_tonnes"] * 0.8
        arrivals = max(50.0, base_arrivals * min(deficit_ratio, 1.3) * rng.normal(1.0, 0.1))
        price = 2000 * (1.0 + max(0.0, 1 - deficit_ratio)) * rng.normal(1.0, 0.08)
        rows.append({
            "district": r["district"],
            "date": r["date"],
            "mandi_arrivals_tonnes": round(arrivals, 1),
            "price_per_quintal": round(price, 1),
        })
    return pd.DataFrame(rows)


def generate_fci_stock_data(rng):
    """Warehouse-level monthly stock and off-take."""
    months = _month_range(HISTORY_MONTHS)
    rows = []
    for wh, meta in WAREHOUSES.items():
        for month in months:
            stock = meta["capacity_tonnes"] * rng.uniform(0.75, 1.0)
            offtake = stock * rng.uniform(0.55, 0.85)
            rows.append({
                "warehouse": wh,
                "date": month,
                "stock_tonnes": round(stock, 1),
                "offtake_tonnes": round(offtake, 1),
            })
    return pd.DataFrame(rows)


def generate_census_data():
    """Static district population snapshot (Census-style)."""
    rows = [{"district": d, "population": meta["population"], "state": meta["state"]}
            for d, meta in DISTRICTS.items()]
    return pd.DataFrame(rows)


def generate_demand_data(rng, rainfall_df):
    """
    District-wise actual PDS demand (tonnes/month) — the forecasting target.
    Rises when rainfall is below normal (drought -> more households need PDS grain).
    """
    rows = []
    for _, r in rainfall_df.iterrows():
        base = DISTRICTS[r["district"]]["base_demand_tonnes"]
        deficit_ratio = r["rainfall_mm"] / max(r["normal_rainfall_mm"], 1e-6)
        shortage_boost = 1.0 + max(0.0, (1.0 - deficit_ratio)) * 0.9
        demand = base * shortage_boost * rng.normal(1.0, 0.07)
        rows.append({
            "district": r["district"],
            "date": r["date"],
            "demand_tonnes": round(max(demand, 0), 1),
        })
    return pd.DataFrame(rows)


def generate_all(force=False):
    os.makedirs(RAW_DIR, exist_ok=True)
    rng = np.random.default_rng(RANDOM_SEED)

    paths = {
        "rainfall": os.path.join(RAW_DIR, "rainfall.csv"),
        "agmarknet": os.path.join(RAW_DIR, "agmarknet.csv"),
        "fci_stock": os.path.join(RAW_DIR, "fci_stock.csv"),
        "census": os.path.join(RAW_DIR, "census.csv"),
        "demand": os.path.join(RAW_DIR, "demand.csv"),
    }

    if not force and all(os.path.exists(p) for p in paths.values()):
        return paths

    rainfall_df = generate_rainfall_data(rng)
    agmarknet_df = generate_agmarknet_data(rng, rainfall_df)
    fci_df = generate_fci_stock_data(rng)
    census_df = generate_census_data()
    demand_df = generate_demand_data(rng, rainfall_df)

    rainfall_df.to_csv(paths["rainfall"], index=False)
    agmarknet_df.to_csv(paths["agmarknet"], index=False)
    fci_df.to_csv(paths["fci_stock"], index=False)
    census_df.to_csv(paths["census"], index=False)
    demand_df.to_csv(paths["demand"], index=False)

    return paths


if __name__ == "__main__":
    generate_all(force=True)
    print(f"Synthetic raw data written to {os.path.abspath(RAW_DIR)}")
