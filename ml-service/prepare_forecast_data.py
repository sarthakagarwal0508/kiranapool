
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

shops = pd.read_csv(DATA_DIR / "shops.csv")
demand = pd.read_csv(DATA_DIR / "demand_history.csv")

# All shops × all days × all 30-minute intervals.
# Operating hours: 08:00–20:00 (24 intervals per day).
days = range(1, 8)
intervals = range(480, 1200, 30)

grid = pd.MultiIndex.from_product(
    [days, shops["shop_id"].unique(), intervals],
    names=["day", "shop_id", "interval_start"],
).to_frame(index=False)

# Add observed order counts; missing combinations mean zero orders.
forecast = grid.merge(
    demand,
    on=["day", "shop_id", "interval_start"],
    how="left",
)

forecast["order_count"] = (
    forecast["order_count"].fillna(0).astype(int)
)

# Simple time features.
forecast["hour"] = forecast["interval_start"] // 60
forecast["minute_of_hour"] = forecast["interval_start"] % 60

output_path = DATA_DIR / "forecast_dataset.csv"
forecast.to_csv(output_path, index=False)

print("Forecast dataset saved:", output_path)
print("Rows:", len(forecast))
print("Total orders:", forecast["order_count"].sum())
print("Shops:", forecast["shop_id"].nunique())
print("Days:", forecast["day"].nunique())
print("Zero-demand intervals:", (forecast["order_count"] == 0).sum())

# Verify expected dimensions: 7 days × 20 shops × 24 intervals.
assert len(forecast) == 7 * len(shops) * 24
assert forecast["order_count"].sum() == 1420

print("PASS: Forecast dataset checks completed.")
