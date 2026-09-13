"""CLI entry point: runs the full pipeline (data -> model -> optimization) without the UI."""
from src.preprocessing import build_master_dataset
from src.forecasting import train_model, feature_importance
from src.simulation import run_scenario, print_summary

if __name__ == "__main__":
    print("Step 1/3: Building master dataset from raw sources...")
    df = build_master_dataset()
    print(f"  -> {df.shape[0]} rows, {df.shape[1]} columns")

    print("\nStep 2/3: Training demand forecasting model...")
    model, metrics = train_model(df)
    print(f"  -> MAE={metrics['mae']:.1f} tonnes, RMSE={metrics['rmse']:.1f} tonnes")
    print(f"  -> Feature importance: {feature_importance(model)}")

    print("\nStep 3/3: Running El Nino scenario simulation...")
    result = run_scenario("Severe El Nino")
    print_summary(result)
