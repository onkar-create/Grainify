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


def register(client, username, password="password123", role="viewer"):
    resp = client.post(
        "/api/auth/register",
        json={"username": username, "password": password, "role": role},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def officer_token(client):
    return register(client, "officer1", role="officer")


@pytest.fixture()
def viewer_token(client):
    return register(client, "viewer1", role="viewer")


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_register_and_login(client):
    token = register(client, "onkar", password="secret123", role="officer")
    assert token

    resp = client.post("/api/auth/login", json={"username": "onkar", "password": "secret123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["username"] == "onkar"
    assert body["user"]["role"] == "officer"

    resp = client.post("/api/auth/login", json={"username": "onkar", "password": "wrongpass"})
    assert resp.status_code == 401


def test_register_duplicate_username(client, officer_token):
    resp = client.post(
        "/api/auth/register",
        json={"username": "officer1", "password": "password123", "role": "viewer"},
    )
    assert resp.status_code == 400


def test_register_invalid_role(client):
    resp = client.post(
        "/api/auth/register",
        json={"username": "someone", "password": "password123", "role": "superadmin"},
    )
    assert resp.status_code == 422


def test_me_requires_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_with_token(client, viewer_token):
    resp = client.get("/api/auth/me", headers=auth_headers(viewer_token))
    assert resp.status_code == 200
    assert resp.json()["role"] == "viewer"


def test_districts_requires_auth(client):
    assert client.get("/api/districts").status_code == 401


def test_districts(client, viewer_token):
    resp = client.get("/api/districts", headers=auth_headers(viewer_token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 35
    assert all("population" in d for d in data)


def test_warehouses(client, viewer_token):
    resp = client.get("/api/warehouses", headers=auth_headers(viewer_token))
    assert resp.status_code == 200
    assert len(resp.json()) == 7


def test_scenarios(client, viewer_token):
    resp = client.get("/api/scenarios", headers=auth_headers(viewer_token))
    assert resp.status_code == 200
    assert set(resp.json()) == {"Normal", "Mild El Nino", "Severe El Nino"}


def test_run_scenario_requires_officer_role(client, viewer_token):
    resp = client.post(
        "/api/run-scenario", json={"scenario": "Mild El Nino"}, headers=auth_headers(viewer_token)
    )
    assert resp.status_code == 403


def test_run_scenario_success(client, officer_token):
    resp = client.post(
        "/api/run-scenario", json={"scenario": "Mild El Nino"}, headers=auth_headers(officer_token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["scenario"] == "Mild El Nino"
    assert data["total_demand"] > 0
    assert len(data["district_results"]) == 35
    # equity floor: no district should be left at 0% of its demand
    for d in data["district_results"]:
        assert d["optimized_allocation"] >= 0.49 * d["demand"] - 1  # small rounding slack


def test_run_scenario_invalid(client, officer_token):
    resp = client.post(
        "/api/run-scenario",
        json={"scenario": "Not A Real Scenario"},
        headers=auth_headers(officer_token),
    )
    assert resp.status_code == 400


def test_history_after_run(client, officer_token, viewer_token):
    client.post(
        "/api/run-scenario", json={"scenario": "Normal"}, headers=auth_headers(officer_token)
    )
    # viewers can read history even though they can't trigger runs
    resp = client.get("/api/history", headers=auth_headers(viewer_token))
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) == 1
    assert history[0]["scenario"] == "Normal"

    run_id = history[0]["id"]
    detail_resp = client.get(f"/api/history/{run_id}", headers=auth_headers(viewer_token))
    assert detail_resp.status_code == 200
    assert len(detail_resp.json()["district_results"]) == 35


def test_history_detail_not_found(client, viewer_token):
    resp = client.get("/api/history/9999", headers=auth_headers(viewer_token))
    assert resp.status_code == 404
