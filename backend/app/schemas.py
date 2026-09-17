from typing import List

from pydantic import BaseModel


class Detection(BaseModel):
    class_id: int
    damage_type: str
    severity: str
    confidence: float
    bbox: List[float]


class PredictionResponse(BaseModel):
    filename: str
    detections: List[Detection]
    count: int
    annotated_image: str