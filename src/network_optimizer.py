"""
Core optimization layer: models the warehouse -> district supply chain as a flow network
and solves it with Min-Cost Max-Flow (NetworkX), compared against a naive proportional
baseline that mirrors how conventional PDS allocation works today.
"""
import networkx as nx

from src.config import WAREHOUSE_DISTRICT_DISTANCE_KM, COST_PER_TONNE_PER_KM

SOURCE = "SOURCE"
SINK = "SINK"


def build_flow_graph(supply: dict, demand: dict) -> nx.DiGraph:
    """
    supply: {warehouse_name: stock_tonnes}
    demand: {district_name: predicted_demand_tonnes}
    """
    G = nx.DiGraph()

    for wh, stock in supply.items():
        G.add_edge(SOURCE, wh, capacity=max(0, int(round(stock))), weight=0)

    for wh, districts in WAREHOUSE_DISTRICT_DISTANCE_KM.items():
        if wh not in supply:
            continue
        for district, km in districts.items():
            if district not in demand:
                continue
            cost_per_tonne = int(round(km * COST_PER_TONNE_PER_KM))
            G.add_edge(wh, district, capacity=10**7, weight=cost_per_tonne)

    for district, dem in demand.items():
        G.add_edge(district, SINK, capacity=max(0, int(round(dem))), weight=0)

    return G


def _min_cost_max_flow(supply: dict, demand: dict) -> dict:
    """
    Runs plain Min-Cost Max-Flow. On its own this only minimizes total transport
    cost among all ways of achieving the maximum possible flow — with no competing
    objective for spread, it will happily allocate 0 to a far/expensive district to
    keep cheaper, closer ones at 100%. See `optimized_allocation` for the
    equity-aware version actually used by the simulation.
    """
    G = build_flow_graph(supply, demand)
    flow_dict = nx.max_flow_min_cost(G, SOURCE, SINK)
    total_cost = nx.cost_of_flow(G, flow_dict)

    fulfilled = {d: 0.0 for d in demand}
    for wh in supply:
        for district, amt in flow_dict.get(wh, {}).items():
            if district in fulfilled:
                fulfilled[district] += amt

    warehouse_usage = {wh: flow_dict.get(SOURCE, {}).get(wh, 0.0) for wh in supply}

    unmet = {d: max(0.0, demand[d] - fulfilled[d]) for d in demand}
    return {
        "allocation": fulfilled,
        "cost": total_cost,
        "unmet": unmet,
        "total_unmet": sum(unmet.values()),
        "total_cost": total_cost,
        "warehouse_usage": warehouse_usage,
    }


def optimized_allocation(supply: dict, demand: dict, min_service_level: float = 0.5) -> dict:
    """
    Equity-aware Min-Cost Max-Flow, run in two stages so no single district can be
    starved to zero just because it's expensive to reach:

    Stage 1 (equity floor): guarantee every district at least `min_service_level`
    of its demand, solved as its own Min-Cost Max-Flow so the floor itself is still
    delivered as cheaply as possible.
    Stage 2 (efficiency top-up): whatever warehouse stock is left after the floor
    is allocated to remaining unmet demand, again cost-minimized.

    This keeps the "minimize cost" objective from the report while also satisfying
    the "ensure equitable distribution" objective — as long as total supply covers
    at least `min_service_level` of total demand, every district gets that floor
    before any district is topped up further.
    """
    floor_demand = {d: dem * min_service_level for d, dem in demand.items()}
    stage1 = _min_cost_max_flow(supply, floor_demand)

    remaining_supply = {
        wh: max(0.0, supply[wh] - stage1["warehouse_usage"].get(wh, 0.0)) for wh in supply
    }
    remaining_demand = {
        d: max(0.0, demand[d] - stage1["allocation"].get(d, 0.0)) for d in demand
    }
    stage2 = _min_cost_max_flow(remaining_supply, remaining_demand)

    allocation = {d: stage1["allocation"][d] + stage2["allocation"][d] for d in demand}
    total_cost = stage1["cost"] + stage2["cost"]
    unmet = {d: max(0.0, demand[d] - allocation[d]) for d in demand}

    return {
        "allocation": allocation,
        "cost": total_cost,
        "unmet": unmet,
        "total_unmet": sum(unmet.values()),
        "total_cost": total_cost,
    }


def baseline_proportional_allocation(supply: dict, demand: dict) -> dict:
    """
    Mirrors conventional PDS allocation: split total available stock across districts
    proportional to their demand share, then deliver each share from its nearest
    warehouse with remaining stock (greedy, no global cost optimization).
    """
    total_supply = sum(supply.values())
    total_demand = sum(demand.values())
    scale = min(1.0, total_supply / total_demand) if total_demand > 0 else 0.0
    target_allocation = {d: dem * scale for d, dem in demand.items()}

    remaining_supply = dict(supply)
    fulfilled = {d: 0.0 for d in demand}
    total_cost = 0.0

    for district, target in target_allocation.items():
        candidates = sorted(
            (
                (wh, km) for wh, districts in WAREHOUSE_DISTRICT_DISTANCE_KM.items()
                if district in districts and wh in supply
                for km in [districts[district]]
            ),
            key=lambda x: x[1],
        )
        need = target
        for wh, km in candidates:
            if need <= 0:
                break
            available = remaining_supply.get(wh, 0.0)
            take = min(available, need)
            if take > 0:
                remaining_supply[wh] -= take
                fulfilled[district] += take
                total_cost += take * km * COST_PER_TONNE_PER_KM
                need -= take

    unmet = {d: max(0.0, demand[d] - fulfilled[d]) for d in demand}
    return {
        "allocation": fulfilled,
        "cost": total_cost,
        "unmet": unmet,
        "total_unmet": sum(unmet.values()),
        "total_cost": total_cost,
    }
