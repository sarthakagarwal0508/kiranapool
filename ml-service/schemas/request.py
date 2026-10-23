"""Request schemas for the KiranaPool ML service."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class RequestBase(BaseModel):
    model_config = ConfigDict(extra="allow")


class BatchRequest(RequestBase):
    orders: List[Dict[str, Any]]
    max_distance_km: Optional[float] = None
    max_time_window_minutes: Optional[float] = None
    max_orders_per_batch: Optional[int] = None
    max_weight_kg: Optional[float] = None


class CostCalculationRequest(RequestBase):
    base_cost: Optional[float] = None
    cost_per_km: Optional[float] = None
    cost_per_drop: Optional[float] = None
    solo_distances: Optional[List[float]] = None
    shop_solo_costs: Optional[Dict[str, float]] = None
    total_pooled_cost: Optional[float] = None
    total_pooled_distance: Optional[float] = None
    num_orders: Optional[int] = None
    allocation_method: Optional[str] = None


class DeliveryPlanRequest(BatchRequest):
    start_location: Optional[Any] = None
    base_cost: Optional[float] = None
    cost_per_km: Optional[float] = None
    cost_per_drop: Optional[float] = None
    speed_kmh: Optional[float] = None
    allocation_method: Optional[str] = None


class ForecastRequest(RequestBase):
    shop_id: Optional[str] = None
    time_interval: Optional[Any] = None
    historical_data: List[Dict[str, Any]] = Field(default_factory=list)
    default_forecast: float = 0.0
    horizonDays: Optional[int] = None
    groupBy: Optional[str] = None
    history: List[Dict[str, Any]] = Field(default_factory=list)
    shops: List[Dict[str, Any]] = Field(default_factory=list)
    slots: Optional[List[Dict[str, Any]]] = None


class RouteRequest(RequestBase):
    orders: List[Dict[str, Any]]


class SolveRouteRequest(RequestBase):
    stops: List[Any]
    start_location: Optional[Any] = None
    algorithm: Optional[str] = "auto"


class TravelTimeRequest(RequestBase):
    distance_km: float = Field(ge=0)
    speed_kmh: Optional[float] = Field(default=None, gt=0)
    unit: Optional[str] = "minutes"
