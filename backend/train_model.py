from pathlib import Path
import json
import pickle

import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "car_data.csv"
MODEL_PATH = BASE_DIR / "model.pkl"
METRICS_PATH = BASE_DIR / "model_metrics.json"

ENCODERS = {
    "company": {"Maruti": 0, "Hyundai": 1, "Honda": 2},
    "fuel": {"Petrol": 0, "Diesel": 1, "CNG": 2},
    "transmission": {"Manual": 0, "Automatic": 1},
    "owner_type": {"First": 0, "Second": 1, "Third": 2, "Fourth+": 3},
}

FEATURES = [
    "year",
    "km_driven",
    "company",
    "fuel",
    "transmission",
    "owner_type",
    "mileage",
    "engine",
    "power",
]


def train():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

    df = pd.read_csv(DATASET_PATH)

    for column, mapping in ENCODERS.items():
        df[column] = df[column].map(mapping).fillna(0)

    X = df[FEATURES]
    y = df["price"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    model = RandomForestRegressor(n_estimators=200, random_state=42)
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    metrics = {
        "r2_score": round(r2_score(y_test, predictions), 4),
        "mae": round(mean_absolute_error(y_test, predictions), 2),
        "features": FEATURES,
    }

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print("Model trained successfully")
    print(metrics)


if __name__ == "__main__":
    train()
