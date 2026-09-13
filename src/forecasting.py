"""Trains and serves the CatBoost demand-forecasting model."""
import os
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error

from src.preprocessing import get_master_dataset

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "demand_model.cbm")

FEATURES = [
    "rainfall_mm", "normal_rainfall_mm", "rainfall_anomaly_pct",
    "mandi_arrivals_tonnes", "price_per_quintal", "population", "month",
]
CATEGORICAL_FEATURES = []  # district-level effects are captured via population/rainfall; keep it simple
TARGET = "demand_tonnes"


def train_model(df=None, save=True):
    if df is None:
        df = get_master_dataset()

    X = df[FEATURES]
    y = df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = CatBoostRegressor(
        iterations=400,
        learning_rate=0.05,
        depth=6,
        loss_function="RMSE",
        verbose=False,
        random_seed=42,
    )
    model.fit(X_train, y_train, cat_features=CATEGORICAL_FEATURES)

    preds = model.predict(X_test)
    metrics = {
        "mae": mean_absolute_error(y_test, preds),
        "rmse": mean_squared_error(y_test, preds) ** 0.5,
    }

    if save:
        os.makedirs(MODEL_DIR, exist_ok=True)
        model.save_model(MODEL_PATH)

    return model, metrics


def load_model():
    if not os.path.exists(MODEL_PATH):
        model, _ = train_model()
        return model
    model = CatBoostRegressor()
    model.load_model(MODEL_PATH)
    return model


def predict_demand(model, district_features: pd.DataFrame) -> pd.Series:
    """district_features must have the columns in FEATURES, one row per district."""
    return pd.Series(model.predict(district_features[FEATURES]), index=district_features.index)


def feature_importance(model):
    return dict(zip(FEATURES, model.get_feature_importance()))


if __name__ == "__main__":
    model, metrics = train_model()
    print(f"Trained demand model. MAE={metrics['mae']:.1f} tonnes, RMSE={metrics['rmse']:.1f} tonnes")
    print("Feature importance:", feature_importance(model))
