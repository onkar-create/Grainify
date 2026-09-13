"""Pydantic request/response schemas for the API."""
from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict


class DistrictResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    district: str
    demand: float
    baseline_allocation: float
    baseline_unmet: float
    optimized_allocation: float
    optimized_unmet: float


class ScenarioRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scenario: str
    created_at: datetime
    total_demand: float
    total_supply: float
    baseline_cost: float
    optimized_cost: float
    baseline_unmet: float
    optimized_unmet: float
    cost_savings_pct: float
    unmet_reduction_pct: float
    district_results: List[DistrictResultOut] = []


class ScenarioRunSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scenario: str
    created_at: datetime
    cost_savings_pct: float
    unmet_reduction_pct: float


class RunScenarioRequest(BaseModel):
    scenario: str
