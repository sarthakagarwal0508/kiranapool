"""Response schemas for KiranaPool ML service."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ResponseBase(BaseModel):
    model_config = ConfigDict(extra="allow")


class HealthResponse(ResponseBase):
    status: str = Field("healthy", examples=["healthy"])
    service: str = Field("KiranaPool ML Service", examples=["KiranaPool ML Service"])
    version: str = Field("1.0.0", examples=["1.0.0"])


class RouteResponse(ResponseBase):
    status: str = Field("success", examples=["success"])
    batches_count: int = Field(..., examples=[2])
    routes: List[Any] = Field(..., description="Solved routes for each batch")


class SolveRouteResponse(ResponseBase):
    route: List[Any] = Field(..., description="Ordered list of stops")
    algorithm: str = Field("heuristic", examples=["heuristic"])
    fallback: bool = Field(False, examples=[False])
    distance_km: Optional[float] = Field(None, examples=[4.82])
    travel_time_minutes: Optional[float] = Field(None, examples=[14.46])


class BatchResponse(ResponseBase):
    status: str = Field("success", examples=["success"])
    batches_count: int = Field(..., examples=[2])
    batches: List[Any] = Field(..., description="List of batches")


class ForecastResponse(ResponseBase):
    status: Optional[str] = None
    forecasts: Optional[List[Any]] = None
    modelSource: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    shop_id: Optional[str] = Field(None, examples=["shop_1"])
    time_interval: Optional[Any] = Field(None, examples=["09:00-11:00"])
    forecasted_demand: Optional[float] = Field(None, examples=[8.5])
    default_used: Optional[bool] = Field(None, examples=[False])


class TravelTimeResponse(ResponseBase):
    distance_km: float = Field(..., examples=[5.0])
    speed_kmh: float = Field(..., examples=[20.0])
    estimated_travel_time: float = Field(..., examples=[15.0])
    unit: str = Field("minutes", examples=["minutes"])


class CostResponse(ResponseBase):
    solo_cost: Optional[float] = Field(None, examples=[115.0])
    pooled_cost: Optional[float] = Field(None, examples=[85.0])
    savings_amount: Optional[float] = Field(None, examples=[30.0])
    savings_percentage: Optional[float] = Field(None, examples=[26.09])
    per_shop_savings: Optional[Any] = Field(None, examples=[{"shop_1": 13.04, "shop_2": 16.96}])


class BatchPlanResult(ResponseBase):
    batch_index: int = Field(..., examples=[0])
    order_count: int = Field(..., examples=[3])
    route: List[Any] = Field(..., description="Ordered stops for this batch")
    distance_km: float = Field(..., examples=[3.75])
    travel_time_minutes: float = Field(..., examples=[11.25])
    solo_cost: float = Field(..., examples=[85.0])
    pooled_cost: float = Field(..., examples=[62.5])
    savings_amount: float = Field(..., examples=[22.5])
    savings_percentage: Optional[float] = Field(None, examples=[26.47])
    per_shop_savings: Optional[Any] = None


class DeliveryPlanResponse(ResponseBase):
    status: str = Field("success", examples=["success"])
    total_orders: int = Field(..., examples=[6])
    total_batches: int = Field(..., examples=[2])
    total_distance_km: float = Field(..., examples=[7.8])
    total_travel_time_minutes: float = Field(..., examples=[23.4])
    total_solo_cost: float = Field(..., examples=[170.0])
    total_pooled_cost: float = Field(..., examples=[125.0])
    total_savings_amount: float = Field(..., examples=[45.0])
    overall_savings_percentage: Optional[float] = Field(None, examples=[26.47])
    batches: List[BatchPlanResult] = Field(...)
