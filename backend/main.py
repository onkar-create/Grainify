"""Grainify FastAPI backend: exposes districts/warehouses/scenarios and runs the optimizer."""
import os
import sys
from typing import List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend.database import Base, engine, get_db
from backend import models, schemas, services
from src.config import DISTRICTS, WAREHOUSES

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Grainify API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/districts")
def get_districts():
    return [{"name": name, **meta} for name, meta in DISTRICTS.items()]


@app.get("/api/warehouses")
def get_warehouses():
    return [{"name": name, **meta} for name, meta in WAREHOUSES.items()]


@app.get("/api/scenarios")
def get_scenarios():
    return services.list_scenarios()


@app.post("/api/run-scenario", response_model=schemas.ScenarioRunOut)
def run_scenario_endpoint(req: schemas.RunScenarioRequest, db: Session = Depends(get_db)):
    try:
        run = services.execute_and_save_scenario(db, req.scenario)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return run


@app.get("/api/history", response_model=List[schemas.ScenarioRunSummary])
def get_history(limit: int = 20, db: Session = Depends(get_db)):
    return (
        db.query(models.ScenarioRun)
        .order_by(desc(models.ScenarioRun.created_at))
        .limit(limit)
        .all()
    )


@app.get("/api/history/{run_id}", response_model=schemas.ScenarioRunOut)
def get_run_detail(run_id: int, db: Session = Depends(get_db)):
    run = db.query(models.ScenarioRun).filter(models.ScenarioRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.get("/api/health")
def health():
    return {"status": "ok"}
