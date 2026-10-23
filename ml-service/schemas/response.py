
"""Response schemas for KiranaPool ML service."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ResponseBase(BaseModel):
    model_config = ConfigDict(extra="allow")


class HealthResponse(ResponseBase):
    status: str
    service: str
    version: str


class RouteResponse(ResponseBase):
    status: str
    batches_count: int
    routes: List[Any]


class BatchResponse(ResponseBase):
    status: str
    batches_count: int
    batches: List[Any]


class SolveRouteResponse(ResponseBase):
    route: List[Any]
    algorithm: str
    fallback: bool
    distance_km: float
    travel_time_minutes: float


class TravelTimeResponse(ResponseBase):
    distance_km: float
    speed_kmh: float
    estimated_travel_time: float
    unit: str


class CostResponse(ResponseBase):
    solo_cost: Optional[float] = None
    pooled_cost: Optional[float] = None
    savings_amount: Optional[float] = None
    savings_percentage: Optional[float] = None
    per_shop_savings: Optional[Any] = None


class ForecastResponse(ResponseBase):
    status: Optional[str] = None
    forecasts: List[Any] = Field(default_factory=list)
    modelSource: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    shop_id: Optional[str] = None
    time_interval: Optional[Any] = None
    forecasted_demand: Optional[float] = None
    default_used: Optional[bool] = None


class BatchPlanResult(ResponseBase):
    batch_index: int
    order_count: int
    route: List[Any]
    distance_km: float
    travel_time_minutes: float
    solo_cost: float
    pooled_cost: float
    savings_amount: float
    savings_percentage: float
    per_shop_savings: Optional[Any] = None


class DeliveryPlanResponse(ResponseBase):
    status: str
    total_orders: int
    total_batches: int
    total_distance_km: float
    total_travel_time_minutes: float
    total_solo_cost: float
    total_pooled_cost: float
    total_savings_amount: float
    overall_savings_percentage: Optional[float] = None
    batches: List[BatchPlanResult]
