
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from economics.costs import (
    calculate_per_shop_savings,
    calculate_pooled_cost,
    calculate_savings_amount,
    calculate_savings_percentage,
    calculate_solo_cost,
)
from forecasting.baseline import forecast_all_shops, forecast_demand
from forecasting.travel_time import estimate_travel_time
from routing.batching import batch_orders
from routing.distance import haversine_distance
from routing.metrics import calculate_route_metrics
from routing.solver import solve_route
from schemas.request import (
    BatchRequest,
    CostCalculationRequest,
    DeliveryPlanRequest,
    ForecastRequest,
    RouteRequest,
    SolveRouteRequest,
    TravelTimeRequest,
)
from schemas.response import (
    BatchPlanResult,
    BatchResponse,
    CostResponse,
    DeliveryPlanResponse,
    ForecastResponse,
    HealthResponse,
    RouteResponse,
    SolveRouteResponse,
    TravelTimeResponse,
)

app = FastAPI(
    title="KiranaPool ML Service",
    description="Neighbourhood kirana-store delivery pooling, route optimization, and forecasting microservice",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health_check():
    return {
        "status": "healthy",
        "service": "KiranaPool ML Service",
        "version": "1.0.0",
    }


@app.post("/route", response_model=RouteResponse)
async def optimize_route(request: Request):
    try:
        body = await request.json()
    except (ValueError, Exception) as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid or empty JSON request body. Send a JSON object containing 'orders'.",
        ) from exc

    if not isinstance(body, dict):
        raise HTTPException(
            status_code=400,
            detail="Request body must be a JSON object containing 'orders'.",
        )

    if "orders" not in body:
        raise HTTPException(
            status_code=422,
            detail="Missing required field 'orders'.",
        )

    orders = body["orders"]

    if not isinstance(orders, list):
        raise HTTPException(
            status_code=422,
            detail="'orders' must be a list.",
        )

    if not orders:
        raise HTTPException(
            status_code=422,
            detail="'orders' cannot be empty.",
        )

    try:
        batches = batch_orders(orders)
        routes = [solve_route(batch) for batch in batches]

        return {
            "status": "success",
            "batches_count": len(batches),
            "routes": routes,
        }
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Route optimization failed.",
        ) from exc


@app.post("/routes/solve", response_model=SolveRouteResponse)
def solve_single_route(payload: SolveRouteRequest):
    try:
        result = solve_route(
            payload.stops,
            start_location=payload.start_location,
            algorithm=payload.algorithm or "auto",
        )
        route = result.get("route", [])
        metrics = calculate_route_metrics(route)

        return {
            "route": route,
            "algorithm": result.get("algorithm", "heuristic"),
            "fallback": result.get("fallback", False),
            "distance_km": round(metrics.get("distance_km", 0.0), 3),
            "travel_time_minutes": round(
                metrics.get("travel_time_minutes", 0.0), 2
            ),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/batch", response_model=BatchResponse)
def create_batches(payload: BatchRequest):
    try:
        batches = batch_orders(
            payload.orders,
            max_distance_km=(
                payload.max_distance_km
                if payload.max_distance_km is not None
                else 2.0
            ),
            max_time_window_minutes=(
                payload.max_time_window_minutes
                if payload.max_time_window_minutes is not None
                else 30.0
            ),
            max_orders_per_batch=(
                payload.max_orders_per_batch
                if payload.max_orders_per_batch is not None
                else 4
            ),
            max_weight_kg=(
                payload.max_weight_kg
                if payload.max_weight_kg is not None
                else 15.0
            ),
        )
        return {
            "status": "success",
            "batches_count": len(batches),
            "batches": batches,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _handle_backend_forecast_request(
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    horizon_days = int(payload.get("horizonDays", 7))
    if not 1 <= horizon_days <= 30:
        raise HTTPException(
            status_code=422,
            detail="horizonDays must be between 1 and 30.",
        )

    group_by = payload.get("groupBy", "both")
    if group_by not in ("both", "shop", "area"):
        raise HTTPException(
            status_code=422,
            detail="groupBy must be 'both', 'shop', or 'area'.",
        )

    history = payload.get("history", [])
    shops = payload.get("shops", [])
    slots = payload.get("slots") or [
        {"key": "morning", "startHour": 8, "endHour": 12},
        {"key": "afternoon", "startHour": 12, "endHour": 17},
        {"key": "evening", "startHour": 17, "endHour": 21},
    ]

    if not isinstance(history, list) or not isinstance(shops, list):
        raise HTTPException(
            status_code=422,
            detail="'history' and 'shops' must be lists.",
        )

    ist = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    forecast_rows = []
    areas = {
        shop.get("area") or "Mansarovar"
        for shop in shops
        if isinstance(shop, dict)
    }

    for day_idx in range(horizon_days):
        forecast_date = now + timedelta(days=day_idx)
        date_iso = forecast_date.isoformat()

        for slot in slots:
            slot_key = slot.get("key", "morning")
            start_hour = int(slot.get("startHour", 8))
            end_hour = int(slot.get("endHour", 12))

            if not 0 <= start_hour <= 23 or not 1 <= end_hour <= 24:
                raise HTTPException(
                    status_code=422,
                    detail="Slot hours must be valid hours of the day.",
                )

            slot_start = (
                forecast_date + timedelta(hours=start_hour)
            ).isoformat()
            slot_end = (
                forecast_date + timedelta(hours=end_hour)
            ).isoformat()

            if group_by in ("both", "shop"):
                for shop in shops:
                    if not isinstance(shop, dict):
                        continue

                    shop_id = str(
                        shop.get("shopId") or shop.get("_id") or ""
                    )
                    area = str(shop.get("area") or "Mansarovar")

                    matching_history = [
                        item
                        for item in history
                        if isinstance(item, dict)
                        and str(item.get("shopId", "")) == shop_id
                    ]

                    base_count = (
                        len(matching_history) / 4
                        if matching_history
                        else 2.5
                    )

                    forecast_rows.append({
                        "forecastDate": date_iso,
                        "scope": "shop",
                        "shop": shop_id,
                        "area": area,
                        "timeSlot": slot_key,
                        "slotStart": slot_start,
                        "slotEnd": slot_end,
                        "predictedOrders": round(
                            max(1.0, float(base_count)), 2
                        ),
                        "confidence": 0.82,
                        "modelSource": "fastapi-ml",
                        "meta": {
                            "algorithm": "historical-average",
                            "shopId": shop_id,
                        },
                    })

            if group_by in ("both", "area"):
                for area_name in sorted(areas or {"Mansarovar"}):
                    matching_history = [
                        item
                        for item in history
                        if isinstance(item, dict)
                        and str(item.get("area", "")) == area_name
                    ]

                    base_count = (
                        len(matching_history) / 4
                        if matching_history
                        else 5.0
                    )

                    forecast_rows.append({
                        "forecastDate": date_iso,
                        "scope": "area",
                        "shop": None,
                        "area": area_name,
                        "timeSlot": slot_key,
                        "slotStart": slot_start,
                        "slotEnd": slot_end,
                        "predictedOrders": round(
                            max(2.0, float(base_count)), 2
                        ),
                        "confidence": 0.85,
                        "modelSource": "fastapi-ml",
                        "meta": {
                            "algorithm": "historical-average-area",
                            "area": area_name,
                        },
                    })

    return {
        "forecasts": forecast_rows,
        "modelSource": "fastapi-ml",
        "meta": {
            "total_rows": len(forecast_rows),
            "horizonDays": horizon_days,
        },
    }


@app.post("/forecast")
async def get_demand_forecast(request: Request):
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid or empty JSON request body.",
        ) from exc

    if not isinstance(body, dict):
        raise HTTPException(
            status_code=400,
            detail="Request payload must be a JSON object.",
        )

    if "horizonDays" in body or (
        "history" in body and "shops" in body
    ):
        return _handle_backend_forecast_request(body)

    shop_id = body.get("shop_id")
    time_interval = body.get("time_interval")

    if not shop_id or not time_interval:
        raise HTTPException(
            status_code=422,
            detail="Missing required 'shop_id' or 'time_interval'.",
        )

    history = body.get("historical_data") or []
    default_forecast = body.get("default_forecast", 0.0)

    try:
        forecast = forecast_demand(
            shop_id=shop_id,
            time_interval=time_interval,
            historical_data=history,
            default_forecast=default_forecast,
        )

        return {
            "shop_id": shop_id,
            "time_interval": time_interval,
            "forecasted_demand": float(forecast),
            "default_used": not history or forecast == default_forecast,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/forecast/all")
def get_all_shops_forecast(payload: Dict[str, Any]):
    try:
        forecasts = forecast_all_shops(
            historical_data=payload.get("historical_data", []),
            time_interval=payload.get("time_interval"),
            default_forecast=payload.get("default_forecast", 0.0),
        )
        return {
            "status": "success",
            "forecasts": forecasts,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/travel-time", response_model=TravelTimeResponse)
def calculate_estimated_travel_time(payload: TravelTimeRequest):
    try:
        unit = payload.unit or "minutes"
        speed = (
            payload.speed_kmh
            if payload.speed_kmh is not None
            else 20.0
        )

        time_est = estimate_travel_time(
            distance_km=payload.distance_km,
            speed_kmh=speed,
            unit=unit,
        )

        return {
            "distance_km": payload.distance_km,
            "speed_kmh": speed,
            "estimated_travel_time": time_est,
            "unit": unit,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/economics/costs", response_model=CostResponse)
def compute_costs_and_savings(payload: CostCalculationRequest):
    try:
        cost_params = {
            "base_cost": (
                payload.base_cost
                if payload.base_cost is not None
                else 20.0
            ),
            "cost_per_km": (
                payload.cost_per_km
                if payload.cost_per_km is not None
                else 10.0
            ),
            "cost_per_drop": (
                payload.cost_per_drop
                if payload.cost_per_drop is not None
                else 5.0
            ),
        }

        solo_cost = None

        if payload.solo_distances is not None:
            solo_cost = calculate_solo_cost(
                payload.solo_distances,
                cost_params=cost_params,
            )
        elif payload.shop_solo_costs:
            solo_cost = sum(payload.shop_solo_costs.values())

        pooled_cost = payload.total_pooled_cost

        if (
            pooled_cost is None
            and payload.total_pooled_distance is not None
        ):
            pooled_cost = calculate_pooled_cost(
                distance=payload.total_pooled_distance,
                num_orders=(
                    payload.num_orders
                    if payload.num_orders is not None
                    else 1
                ),
                cost_params=cost_params,
            )

        savings_amount = None
        savings_percentage = None

        if solo_cost is not None and pooled_cost is not None:
            savings_amount = calculate_savings_amount(
                solo_cost, pooled_cost
            )
            savings_percentage = calculate_savings_percentage(
                solo_cost, pooled_cost
            )

        per_shop_savings = None

        if payload.shop_solo_costs and pooled_cost is not None:
            per_shop_savings = calculate_per_shop_savings(
                shop_solo_costs=payload.shop_solo_costs,
                total_pooled_cost=pooled_cost,
                allocation_method=(
                    payload.allocation_method
                    or "proportional_solo_cost"
                ),
            )

        return {
            "solo_cost": solo_cost,
            "pooled_cost": pooled_cost,
            "savings_amount": savings_amount,
            "savings_percentage": savings_percentage,
            "per_shop_savings": per_shop_savings,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/routes/plan", response_model=DeliveryPlanResponse)
def plan_delivery(payload: DeliveryPlanRequest):
    try:
        orders = payload.orders

        if not orders:
            raise HTTPException(
                status_code=422,
                detail="Orders list cannot be empty.",
            )

        cost_params = {
            "base_cost": (
                payload.base_cost
                if payload.base_cost is not None
                else 20.0
            ),
            "cost_per_km": (
                payload.cost_per_km
                if payload.cost_per_km is not None
                else 10.0
            ),
            "cost_per_drop": (
                payload.cost_per_drop
                if payload.cost_per_drop is not None
                else 5.0
            ),
        }

        speed_kmh = (
            payload.speed_kmh
            if payload.speed_kmh is not None
            else 20.0
        )

        batches = batch_orders(
            orders,
            max_distance_km=(
                payload.max_distance_km
                if payload.max_distance_km is not None
                else 2.0
            ),
            max_time_window_minutes=(
                payload.max_time_window_minutes
                if payload.max_time_window_minutes is not None
                else 30.0
            ),
            max_orders_per_batch=(
                payload.max_orders_per_batch
                if payload.max_orders_per_batch is not None
                else 4
            ),
            max_weight_kg=(
                payload.max_weight_kg
                if payload.max_weight_kg is not None
                else 15.0
            ),
        )

        batch_results: List[BatchPlanResult] = []
        total_plan_distance = 0.0
        total_plan_time = 0.0
        total_plan_solo = 0.0
        total_plan_pooled = 0.0

        for idx, batch in enumerate(batches):
            solved = solve_route(
                batch,
                start_location=payload.start_location,
            )
            route = solved.get("route", [])
            metrics = calculate_route_metrics(
                route,
                speed_kmh=speed_kmh,
            )

            distance_km = round(
                metrics.get("distance_km", 0.0), 3
            )
            travel_time = round(
                metrics.get("travel_time_minutes", 0.0), 2
            )

            solo_distances = []
            shop_costs: Dict[str, float] = {}

            for item in batch:
                coords = item.get("coordinates") or item.get("location")

                if coords is None and "lat" in item and (
                    "lon" in item or "lng" in item
                ):
                    longitude = (
                        item["lon"]
                        if item.get("lon") is not None
                        else item.get("lng")
                    )
                    coords = (item["lat"], longitude)

                if coords is not None and payload.start_location:
                    solo_distance = (
                        haversine_distance(
                            payload.start_location,
                            coords,
                        )
                        * 2.0
                    )
                else:
                    solo_distance = 2.0

                solo_distances.append(solo_distance)

                shop_id = str(item.get("shop_id", "default_shop"))
                item_cost = calculate_solo_cost(
                    solo_distance,
                    cost_params=cost_params,
                )
                shop_costs[shop_id] = (
                    shop_costs.get(shop_id, 0.0) + item_cost
                )

            batch_solo_cost = calculate_solo_cost(
                solo_distances,
                cost_params=cost_params,
            )
            batch_pooled_cost = calculate_pooled_cost(
                distance=distance_km,
                num_orders=len(batch),
                cost_params=cost_params,
            )

            savings_amount = calculate_savings_amount(
                batch_solo_cost,
                batch_pooled_cost,
            )
            savings_percentage = calculate_savings_percentage(
                batch_solo_cost,
                batch_pooled_cost,
            )

            per_shop_savings = None

            if shop_costs:
                try:
                    per_shop_savings = calculate_per_shop_savings(
                        shop_solo_costs=shop_costs,
                        total_pooled_cost=batch_pooled_cost,
                        allocation_method=(
                            payload.allocation_method
                            or "proportional_solo_cost"
                        ),
                    )
                except Exception:
                    per_shop_savings = None

            batch_results.append(
                BatchPlanResult(
                    batch_index=idx,
                    order_count=len(batch),
                    route=route,
                    distance_km=distance_km,
                    travel_time_minutes=travel_time,
                    solo_cost=batch_solo_cost,
                    pooled_cost=batch_pooled_cost,
                    savings_amount=savings_amount,
                    savings_percentage=savings_percentage,
                    per_shop_savings=per_shop_savings,
                )
            )

            total_plan_distance += distance_km
            total_plan_time += travel_time
            total_plan_solo += batch_solo_cost
            total_plan_pooled += batch_pooled_cost

        total_savings = round(
            total_plan_solo - total_plan_pooled, 2
        )
        savings_percentage = (
            round(
                total_savings / total_plan_solo * 100.0,
                2,
            )
            if total_plan_solo > 0
            else None
        )

        return DeliveryPlanResponse(
            status="success",
            total_orders=len(orders),
            total_batches=len(batches),
            total_distance_km=round(total_plan_distance, 3),
            total_travel_time_minutes=round(total_plan_time, 2),
            total_solo_cost=round(total_plan_solo, 2),
            total_pooled_cost=round(total_plan_pooled, 2),
            total_savings_amount=total_savings,
            overall_savings_percentage=savings_percentage,
            batches=batch_results,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=False)
