"""Static definition of the districts, warehouses and transport network Grainify optimizes over."""

RANDOM_SEED = 42

# District -> state, base population, base monthly PDS demand (tonnes) under normal conditions
DISTRICTS = {
    "Latur":      {"state": "Maharashtra", "population": 2_454_196, "base_demand_tonnes": 3200},
    "Osmanabad":  {"state": "Maharashtra", "population": 1_657_576, "base_demand_tonnes": 2100},
    "Beed":       {"state": "Maharashtra", "population": 2_585_049, "base_demand_tonnes": 3300},
    "Jalna":      {"state": "Maharashtra", "population": 1_959_046, "base_demand_tonnes": 2500},
    "Parbhani":   {"state": "Maharashtra", "population": 1_836_086, "base_demand_tonnes": 2350},
    "Nanded":     {"state": "Maharashtra", "population": 3_361_292, "base_demand_tonnes": 4300},
    "Amravati":   {"state": "Maharashtra", "population": 2_888_445, "base_demand_tonnes": 3700},
    "Akola":      {"state": "Maharashtra", "population": 1_813_906, "base_demand_tonnes": 2300},
}

# Warehouse -> state, monthly stock capacity (tonnes)
WAREHOUSES = {
    "WH_Latur":    {"state": "Maharashtra", "capacity_tonnes": 14000},
    "WH_Nanded":   {"state": "Maharashtra", "capacity_tonnes": 16000},
}

# Approximate road distance (km) from each warehouse to each district it can serve.
# Cost per tonne is derived from this distance. A district is only connected to
# warehouses within reasonable range, mirroring real logistics constraints.
WAREHOUSE_DISTRICT_DISTANCE_KM = {
    "WH_Latur":    {"Latur": 10, "Osmanabad": 70, "Beed": 90, "Jalna": 140, "Parbhani": 120, "Nanded": 180},
    "WH_Nanded":   {"Nanded": 10, "Parbhani": 75, "Jalna": 150, "Beed": 170, "Amravati": 210, "Akola": 240},
}

COST_PER_TONNE_PER_KM = 2.5  # INR, used to convert distance into a transport cost

# El Nino severity presets used by the simulation / dashboard scenario picker
SCENARIOS = {
    "Normal":        {"rainfall_anomaly_pct": 0,   "demand_multiplier": 1.00},
    "Mild El Nino":  {"rainfall_anomaly_pct": -20, "demand_multiplier": 1.15},
    "Severe El Nino": {"rainfall_anomaly_pct": -45, "demand_multiplier": 1.35},
}

HISTORY_MONTHS = 60  # 5 years of synthetic monthly history for model training
