"""Bridges the API layer to the existing ML/optimization pipeline in src/, and persists runs."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.orm import Session

from src.simulation import run_scenario
from src.config import SCENARIOS
from backend.models import ScenarioRun, DistrictResult


def list_scenarios():
    return list(SCENARIOS.keys())


def execute_and_save_scenario(db: Session, scenario_name: str) -> ScenarioRun:
    if scenario_name not in SCENARIOS:
        raise ValueError(f"Unknown scenario: {scenario_name}")

    result = run_scenario(scenario_name)

    run = ScenarioRun(
        scenario=scenario_name,
        total_demand=sum(result["demand"].values()),
        total_supply=sum(result["supply"].values()),
        baseline_cost=result["baseline"]["total_cost"],
        optimized_cost=result["optimized"]["total_cost"],
        baseline_unmet=result["baseline"]["total_unmet"],
        optimized_unmet=result["optimized"]["total_unmet"],
        cost_savings_pct=result["cost_savings_pct"],
        unmet_reduction_pct=result["unmet_reduction_pct"],
    )

    for district in result["demand"]:
        run.district_results.append(DistrictResult(
            district=district,
            demand=result["demand"][district],
            baseline_allocation=result["baseline"]["allocation"][district],
            baseline_unmet=result["baseline"]["unmet"][district],
            optimized_allocation=result["optimized"]["allocation"][district],
            optimized_unmet=result["optimized"]["unmet"][district],
        ))

    db.add(run)
    db.commit()
    db.refresh(run)
    return run
