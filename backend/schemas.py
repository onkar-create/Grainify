"""Pydantic request/response schemas for the API."""
from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, field_validator


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str


class RegisterRequest(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        if len(v.strip()) < 3:
            raise ValueError("username must be at least 3 characters")
        return v.strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class DistrictResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    district: str
    demand: float
    baseline_allocation: float
    baseline_unmet: float
    optimized_allocation: float
    optimized_unmet: float


class AllocationRouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    warehouse: str
    district: str
    quantity: float


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
    routes: List[AllocationRouteOut] = []


class ScenarioRunSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scenario: str
    created_at: datetime
    cost_savings_pct: float
    unmet_reduction_pct: float


class RunScenarioRequest(BaseModel):
    scenario: str


class DistrictDemandOut(BaseModel):
    district: str
    demand: float


class PredictDemandOut(BaseModel):
    scenario: str
    total_demand: float
    total_supply: float
    district_demand: List[DistrictDemandOut]
