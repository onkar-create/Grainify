"""Grainify FastAPI backend: exposes districts/warehouses/scenarios and runs the optimizer."""
import os
import sys
from typing import List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend import auth
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

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = auth.decode_access_token(token)
        user_id = int(payload["sub"])
    except (ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------- Auth ----------

@app.post("/api/auth/register", response_model=schemas.TokenResponse)
def register(req: schemas.RegisterRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    user = models.User(
        username=req.username,
        hashed_password=auth.hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = auth.create_access_token(str(user.id))
    return {"access_token": token, "user": user}


@app.post("/api/auth/login", response_model=schemas.TokenResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or not auth.verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = auth.create_access_token(str(user.id))
    return {"access_token": token, "user": user}


@app.get("/api/auth/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


# ---------- Core data (any logged-in user) ----------

@app.get("/api/districts")
def get_districts(_: models.User = Depends(get_current_user)):
    return [{"name": name, **meta} for name, meta in DISTRICTS.items()]


@app.get("/api/warehouses")
def get_warehouses(_: models.User = Depends(get_current_user)):
    return [{"name": name, **meta} for name, meta in WAREHOUSES.items()]


@app.get("/api/scenarios")
def get_scenarios(_: models.User = Depends(get_current_user)):
    return services.list_scenarios()


@app.get("/api/history", response_model=List[schemas.ScenarioRunSummary])
def get_history(limit: int = 20, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return (
        db.query(models.ScenarioRun)
        .order_by(desc(models.ScenarioRun.created_at))
        .limit(limit)
        .all()
    )


@app.get("/api/history/{run_id}", response_model=schemas.ScenarioRunOut)
def get_run_detail(run_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    run = db.query(models.ScenarioRun).filter(models.ScenarioRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


# ---------- Optimization ----------

@app.post("/api/predict-demand", response_model=schemas.PredictDemandOut)
def predict_demand_endpoint(
    req: schemas.RunScenarioRequest,
    _: models.User = Depends(get_current_user),
):
    try:
        return services.predict_demand(req.scenario)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/run-scenario", response_model=schemas.ScenarioRunOut)
def run_scenario_endpoint(
    req: schemas.RunScenarioRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    try:
        run = services.execute_and_save_scenario(db, req.scenario)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return run


@app.get("/api/health")
def health():
    return {"status": "ok"}
