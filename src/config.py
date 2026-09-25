"""Static definition of the districts, warehouses and transport network Grainify optimizes over.

Covers all 35 Maharashtra districts as they existed at the 2011 Census (Palghar was
carved out of Thane in 2014, after the census, so its population is folded into
Thane's figure here — consistent with the real historical data rather than an
estimated split), grouped into the state's 6 administrative divisions. One FCI
warehouse serves each division (Marathwada keeps its original two, since it was
built out first and already has finer-grained distances).
"""

RANDOM_SEED = 42

# District -> state, base population, base monthly PDS demand (tonnes) under normal conditions
DISTRICTS = {
    # Aurangabad division (Marathwada)
    "Latur":      {"state": "Maharashtra", "population": 2_454_196, "base_demand_tonnes": 3200},
    "Osmanabad":  {"state": "Maharashtra", "population": 1_657_576, "base_demand_tonnes": 2100},
    "Beed":       {"state": "Maharashtra", "population": 2_585_049, "base_demand_tonnes": 3300},
    "Jalna":      {"state": "Maharashtra", "population": 1_959_046, "base_demand_tonnes": 2500},
    "Parbhani":   {"state": "Maharashtra", "population": 1_836_086, "base_demand_tonnes": 2350},
    "Nanded":     {"state": "Maharashtra", "population": 3_361_292, "base_demand_tonnes": 4300},
    "Hingoli":    {"state": "Maharashtra", "population": 1_177_345, "base_demand_tonnes": 1500},
    "Aurangabad": {"state": "Maharashtra", "population": 3_701_282, "base_demand_tonnes": 4750},

    # Amravati division (Vidarbha)
    "Amravati":   {"state": "Maharashtra", "population": 2_888_445, "base_demand_tonnes": 3700},
    "Akola":      {"state": "Maharashtra", "population": 1_813_906, "base_demand_tonnes": 2300},
    "Washim":     {"state": "Maharashtra", "population": 1_197_160, "base_demand_tonnes": 1550},
    "Buldhana":   {"state": "Maharashtra", "population": 2_586_258, "base_demand_tonnes": 3300},
    "Yavatmal":   {"state": "Maharashtra", "population": 2_772_348, "base_demand_tonnes": 3550},

    # Nagpur division (Vidarbha)
    "Nagpur":     {"state": "Maharashtra", "population": 4_653_570, "base_demand_tonnes": 5950},
    "Wardha":     {"state": "Maharashtra", "population": 1_300_774, "base_demand_tonnes": 1650},
    "Bhandara":   {"state": "Maharashtra", "population": 1_200_334, "base_demand_tonnes": 1550},
    "Gondia":     {"state": "Maharashtra", "population": 1_322_507, "base_demand_tonnes": 1700},
    "Chandrapur": {"state": "Maharashtra", "population": 2_204_307, "base_demand_tonnes": 2800},
    "Gadchiroli": {"state": "Maharashtra", "population": 1_072_942, "base_demand_tonnes": 1350},

    # Nashik division
    "Nashik":     {"state": "Maharashtra", "population": 6_107_187, "base_demand_tonnes": 7800},
    "Dhule":      {"state": "Maharashtra", "population": 2_050_862, "base_demand_tonnes": 2650},
    "Nandurbar":  {"state": "Maharashtra", "population": 1_648_295, "base_demand_tonnes": 2100},
    "Jalgaon":    {"state": "Maharashtra", "population": 4_229_917, "base_demand_tonnes": 5400},
    "Ahmednagar": {"state": "Maharashtra", "population": 4_543_159, "base_demand_tonnes": 5800},

    # Pune division
    "Pune":       {"state": "Maharashtra", "population": 9_429_408, "base_demand_tonnes": 12050},
    "Satara":     {"state": "Maharashtra", "population": 3_003_741, "base_demand_tonnes": 3850},
    "Sangli":     {"state": "Maharashtra", "population": 2_822_143, "base_demand_tonnes": 3600},
    "Solapur":    {"state": "Maharashtra", "population": 4_317_756, "base_demand_tonnes": 5550},
    "Kolhapur":   {"state": "Maharashtra", "population": 3_876_001, "base_demand_tonnes": 4950},

    # Konkan division
    "Mumbai":          {"state": "Maharashtra", "population": 3_085_411,  "base_demand_tonnes": 3950},
    "Mumbai Suburban": {"state": "Maharashtra", "population": 9_356_962,  "base_demand_tonnes": 12000},
    "Thane":           {"state": "Maharashtra", "population": 11_060_148, "base_demand_tonnes": 14150},
    "Raigad":          {"state": "Maharashtra", "population": 2_634_200,  "base_demand_tonnes": 3350},
    "Ratnagiri":       {"state": "Maharashtra", "population": 1_615_069,  "base_demand_tonnes": 2050},
    "Sindhudurg":      {"state": "Maharashtra", "population": 849_651,    "base_demand_tonnes": 1100},
}

# Warehouse -> state, monthly stock capacity (tonnes). One per administrative division.
WAREHOUSES = {
    "WH_Latur":    {"state": "Maharashtra", "capacity_tonnes": 14000},
    "WH_Nanded":   {"state": "Maharashtra", "capacity_tonnes": 16000},
    "WH_Amravati": {"state": "Maharashtra", "capacity_tonnes": 18000},
    "WH_Nagpur":   {"state": "Maharashtra", "capacity_tonnes": 19000},
    "WH_Nashik":   {"state": "Maharashtra", "capacity_tonnes": 30000},
    "WH_Pune":     {"state": "Maharashtra", "capacity_tonnes": 38000},
    "WH_Mumbai":   {"state": "Maharashtra", "capacity_tonnes": 46000},
}

# Approximate road distance (km) from each warehouse to each district it can serve.
# Cost per tonne is derived from this distance. A district is only connected to
# warehouses within reasonable range, mirroring real logistics constraints.
WAREHOUSE_DISTRICT_DISTANCE_KM = {
    "WH_Latur":    {"Latur": 10, "Osmanabad": 70, "Beed": 90, "Jalna": 140, "Parbhani": 120, "Nanded": 180, "Aurangabad": 200},
    "WH_Nanded":   {"Nanded": 10, "Parbhani": 75, "Jalna": 150, "Beed": 170, "Hingoli": 90, "Aurangabad": 200},
    "WH_Amravati": {"Amravati": 5, "Akola": 95, "Washim": 130, "Buldhana": 145, "Yavatmal": 160},
    "WH_Nagpur":   {"Nagpur": 5, "Wardha": 75, "Bhandara": 65, "Gondia": 165, "Chandrapur": 155, "Gadchiroli": 200},
    "WH_Nashik":   {"Nashik": 5, "Dhule": 165, "Nandurbar": 240, "Jalgaon": 280, "Ahmednagar": 130},
    "WH_Pune":     {"Pune": 5, "Satara": 110, "Sangli": 230, "Solapur": 250, "Kolhapur": 235},
    "WH_Mumbai":   {"Mumbai": 5, "Mumbai Suburban": 20, "Thane": 30, "Raigad": 100, "Ratnagiri": 330, "Sindhudurg": 500},
}

COST_PER_TONNE_PER_KM = 2.5  # INR, used to convert distance into a transport cost

# El Nino severity presets used by the simulation / dashboard scenario picker
SCENARIOS = {
    "Normal":        {"rainfall_anomaly_pct": 0,   "demand_multiplier": 1.00},
    "Mild El Nino":  {"rainfall_anomaly_pct": -20, "demand_multiplier": 1.15},
    "Severe El Nino": {"rainfall_anomaly_pct": -45, "demand_multiplier": 1.35},
}

HISTORY_MONTHS = 60  # 5 years of synthetic monthly history for model training
