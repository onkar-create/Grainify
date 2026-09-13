"""ORM models for persisted scenario runs and their per-district results."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from backend.database import Base


class ScenarioRun(Base):
    __tablename__ = "scenario_runs"

    id = Column(Integer, primary_key=True, index=True)
    scenario = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    total_demand = Column(Float)
    total_supply = Column(Float)
    baseline_cost = Column(Float)
    optimized_cost = Column(Float)
    baseline_unmet = Column(Float)
    optimized_unmet = Column(Float)
    cost_savings_pct = Column(Float)
    unmet_reduction_pct = Column(Float)

    district_results = relationship(
        "DistrictResult", back_populates="run", cascade="all, delete-orphan"
    )


class DistrictResult(Base):
    __tablename__ = "district_results"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("scenario_runs.id"))
    district = Column(String, nullable=False)

    demand = Column(Float)
    baseline_allocation = Column(Float)
    baseline_unmet = Column(Float)
    optimized_allocation = Column(Float)
    optimized_unmet = Column(Float)

    run = relationship("ScenarioRun", back_populates="district_results")
