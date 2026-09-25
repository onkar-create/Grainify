"""
Backend API tests. Uses a temporary SQLite file (not backend/grainify.db) so running
tests never touches or resets your real run history.
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.database import Base, get_db
from backend import main as main_module


@pytest.fixture()
def client(tmp_path):
    """Fresh, isolated SQLite file per test — never touches backend/grainify.db."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main_module.app.dependency_overrides[get_db] = override_get_db
    yield TestClient(main_module.app)
    main_module.app.dependency_overrides.clear()


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_districts(client):
    resp = client.get("/api/districts")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 8
    assert all("population" in d for d in data)


def test_warehouses(client):
    resp = client.get("/api/warehouses")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_scenarios(client):
    resp = client.get("/api/scenarios")
    assert resp.status_code == 200
    assert set(resp.json()) == {"Normal", "Mild El Nino", "Severe El Nino"}


def test_run_scenario_success(client):
    resp = client.post("/api/run-scenario", json={"scenario": "Mild El Nino"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["scenario"] == "Mild El Nino"
    assert data["total_demand"] > 0
    assert len(data["district_results"]) == 8
    # equity floor: no district should be left at 0% of its demand
    for d in data["district_results"]:
        assert d["optimized_allocation"] >= 0.49 * d["demand"] - 1  # small rounding slack


def test_run_scenario_invalid(client):
    resp = client.post("/api/run-scenario", json={"scenario": "Not A Real Scenario"})
    assert resp.status_code == 400


def test_history_after_run(client):
    client.post("/api/run-scenario", json={"scenario": "Normal"})
    resp = client.get("/api/history")
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) == 1
    assert history[0]["scenario"] == "Normal"

    run_id = history[0]["id"]
    detail_resp = client.get(f"/api/history/{run_id}")
    assert detail_resp.status_code == 200
    assert len(detail_resp.json()["district_results"]) == 8


def test_history_detail_not_found(client):
    resp = client.get("/api/history/9999")
    assert resp.status_code == 404
