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
│   ├── processed/      # cleaned, merged dataset used for training
│   └── external/       # real data checked into the repo (e.g. Census 2011 population)
├── models/             # trained model artifacts (.cbm)
├── src/
│   ├── config.py               # districts, warehouses, transport network definition
│   ├── generate_synthetic_data.py  # builds a realistic placeholder dataset
│   ├── preprocessing.py        # cleans + merges raw data into one table
│   ├── forecasting.py          # trains/loads the CatBoost demand model
│   ├── network_optimizer.py    # Min-Cost Max-Flow optimizer + baseline allocator
│   └── simulation.py           # runs a scenario end-to-end, returns comparison metrics
├── backend/             # FastAPI + SQLite API that powers the website
├── frontend/            # React (Vite) website: landing page, dashboard, history
├── tests/               # backend API tests (pytest)
├── dashboard/
│   └── app.py           # Streamlit dashboard (earlier standalone prototype)
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

## Dashboard (Streamlit prototype)

```bash
streamlit run dashboard/app.py
```

Lets you pick a drought severity, run the optimization, and see per-district allocation,
cost, and unmet-demand charts for optimized vs. baseline allocation.

## Backend API (FastAPI + SQLite)

Powers the full website (React frontend calls this). Every scenario run is persisted to
`backend/grainify.db` so past runs show up in the History page.

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

Interactive API docs at `http://localhost:8000/docs`. Key endpoints:

- `GET /api/districts`, `GET /api/warehouses`, `GET /api/scenarios`
- `POST /api/run-scenario` — body `{"scenario": "Severe El Nino"}`, runs forecasting +
  optimization, saves the run, returns full district-level results
- `GET /api/history` — list past runs; `GET /api/history/{run_id}` — one run's detail

## Frontend (React website)

The full website — landing page, scenario dashboard, and run history — lives in
`frontend/`. It talks to the FastAPI backend above.

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173` by default. Make sure the backend
(`uvicorn backend.main:app --reload --port 8000`) is running first — the frontend calls
it at the URL in `frontend/.env` (`VITE_API_BASE_URL`, defaults to `http://localhost:8000`).

Pages:
- **`/`** — landing page (problem statement, objectives, tech stack, team)
- **`/dashboard`** — pick a scenario, run the optimizer, see KPIs and charts
- **`/history`** — every past run, click one to see its full district breakdown

## Tests

```bash
python -m pytest tests/ -v
```

Covers every endpoint plus a regression check that no district is ever left at 0%
allocation (the equity floor in `src/network_optimizer.py`).

## Data sources — what's real vs. synthetic right now

| Source | Status | Details |
|---|---|---|
| Census district population | **Real** | `data/external/census_2011_district_population.csv` — actual Census of India 2011 figures for all 35 Maharashtra districts (as they existed at the 2011 Census, before Palghar was carved out of Thane in 2014), sourced from the official Primary Census Abstract (mirrored on GitHub since censusindia.gov.in isn't reachable from this dev environment). Used automatically by `generate_census_data()`. |
| FCI stock & off-take | Synthetic | data.gov.in hosts "Daily FCI Stock Position of the Commodity", but data.gov.in/api.data.gov.in are not reachable from this environment and the full API needs a personal API key anyway. |
| IMD rainfall | Synthetic | mausam.imd.gov.in / IMD's CDSP portal have district rainfall, same reachability issue. |
| Agmarknet mandi arrivals/prices | Synthetic | agmarknet.gov.in's price/arrival reports are date-range form submissions, not a plain file download, on top of the same reachability issue. |

**To finish the real-data swap** (recommended before treating results as final "Key
Findings" for your report): from your own machine (not blocked the way this dev
environment is), download:

- FCI stock & off-take — data.gov.in → search "Daily FCI Stock Position of the Commodity",
  export CSV/JSON (needs a free data.gov.in account + API key for the full history)
- IMD rainfall — imdpune.gov.in's CDSP portal, or data.gov.in's rainfall catalog
- Agmarknet — agmarknet.gov.in → Price and Arrival Report, filter by state/commodity/date
  range, export

Drop the files into `data/raw/` using the column names `generate_synthetic_data.py`
produces (or send them to me and I'll write the cleaning/mapping code for whatever
format they actually come in — real government exports rarely match a schema exactly).
Then delete `data/processed/master_dataset.csv` and `models/demand_model.cbm` and re-run
`python run_pipeline.py` to retrain on real data.
