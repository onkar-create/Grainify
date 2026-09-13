# Grainify

AI-assisted decision support system for optimizing food grain distribution through India's
Public Distribution System (PDS) during El Niño-induced scarcity. The system forecasts
district-wise grain demand with a CatBoost model and reallocates grain stocks from FCI
warehouses to districts using a Min-Cost Max-Flow network optimization, minimizing both
transport cost and unmet demand.

## Project structure

```
grainify/
├── data/
│   ├── raw/            # source datasets (synthetic by default, swap in real data here)
│   └── processed/      # cleaned, merged dataset used for training
├── models/             # trained model artifacts (.cbm)
├── src/
│   ├── config.py               # districts, warehouses, transport network definition
│   ├── generate_synthetic_data.py  # builds a realistic placeholder dataset
│   ├── preprocessing.py        # cleans + merges raw data into one table
│   ├── forecasting.py          # trains/loads the CatBoost demand model
│   ├── network_optimizer.py    # Min-Cost Max-Flow optimizer + baseline allocator
│   └── simulation.py           # runs a scenario end-to-end, returns comparison metrics
├── dashboard/
│   └── app.py           # Streamlit dashboard
├── run_pipeline.py      # CLI entry point to run the whole pipeline without the UI
└── requirements.txt
```

## Setup

```bash
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

## Quickstart (synthetic data)

The repo ships with a synthetic-but-realistic dataset generator so the full pipeline runs
end-to-end immediately, before real government datasets are plugged in.

```bash
python run_pipeline.py
```

This will:
1. Generate synthetic FCI stock, IMD rainfall, Agmarknet arrivals and Census population data
   into `data/raw/` (only if not already present).
2. Clean and merge them into `data/processed/master_dataset.csv`.
3. Train a CatBoost demand-forecasting model (saved to `models/demand_model.cbm`).
4. Run an El Niño drought scenario and compare Min-Cost Max-Flow optimized allocation
   against a naive proportional baseline, printing cost and unmet-demand savings.

## Dashboard

```bash
streamlit run dashboard/app.py
```

Lets you pick a drought severity, run the optimization, and see per-district allocation,
cost, and unmet-demand charts for optimized vs. baseline allocation.

## Swapping in real data

Replace the files in `data/raw/` with the real datasets (same column names as the synthetic
generator produces — see `src/generate_synthetic_data.py` for the schema), matching:

- FCI stock & off-take data — data.gov.in
- IMD rainfall data — imdpune.gov.in / data.gov.in
- Agmarknet mandi arrival data — agmarknet.gov.in
- Census district population data — censusindia.gov.in

Then delete `data/processed/master_dataset.csv` and `models/demand_model.cbm` and re-run
`python run_pipeline.py` to retrain on real data.
