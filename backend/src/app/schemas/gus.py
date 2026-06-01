"""GUS schemas."""
from datetime import datetime

from pydantic import BaseModel


class GusCpiResponse(BaseModel):
    value: float
    year: int
    quarter: int
    source: str
    fetched_at: datetime
