"""Cleans and merges the raw datasets into one district-month table used for training."""
import os
import pandas as pd

from src.generate_synthetic_data import generate_all, RAW_DIR

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")
MASTER_PATH = os.path.join(PROCESSED_DIR, "master_dataset.csv")


def load_raw():
    paths = generate_all()  # no-ops if the CSVs already exist (e.g. real data was swapped in)
    rainfall = pd.read_csv(paths["rainfall"], parse_dates=["date"])
    agmarknet = pd.read_csv(paths["agmarknet"], parse_dates=["date"])
    fci = pd.read_csv(paths["fci_stock"], parse_dates=["date"])
    census = pd.read_csv(paths["census"])
    demand = pd.read_csv(paths["demand"], parse_dates=["date"])
    return rainfall, agmarknet, fci, census, demand


def _clean(df, numeric_cols):
    df = df.drop_duplicates()
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        df[col] = df[col].fillna(df[col].median())
    return df


def build_master_dataset():
    rainfall, agmarknet, fci, census, demand = load_raw()

    rainfall = _clean(rainfall, ["rainfall_mm", "normal_rainfall_mm"])
    agmarknet = _clean(agmarknet, ["mandi_arrivals_tonnes", "price_per_quintal"])
    demand = _clean(demand, ["demand_tonnes"])

    df = rainfall.merge(agmarknet, on=["district", "date"], how="left")
    df = df.merge(demand, on=["district", "date"], how="left")
    df = df.merge(census[["district", "population", "state"]], on="district", how="left")

    df["rainfall_anomaly_pct"] = (
        (df["rainfall_mm"] - df["normal_rainfall_mm"]) / df["normal_rainfall_mm"].replace(0, 1)
    ) * 100
    df["month"] = df["date"].dt.month
    df["year"] = df["date"].dt.year

    df = df.dropna(subset=["demand_tonnes"]).sort_values(["district", "date"]).reset_index(drop=True)

    os.makedirs(PROCESSED_DIR, exist_ok=True)
    df.to_csv(MASTER_PATH, index=False)
    return df


def get_master_dataset(force_rebuild=False):
    if not force_rebuild and os.path.exists(MASTER_PATH):
        return pd.read_csv(MASTER_PATH, parse_dates=["date"])
    return build_master_dataset()


if __name__ == "__main__":
    df = build_master_dataset()
    print(f"Master dataset: {df.shape[0]} rows, {df.shape[1]} columns -> {MASTER_PATH}")
    print(df.head())
