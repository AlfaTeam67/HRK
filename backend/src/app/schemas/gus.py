"""GUS CPI response schemas."""

from datetime import datetime

from pydantic import BaseModel


class GusCpiRead(BaseModel):
    """Latest CPI snapshot from GUS BDL."""

    value: float
    year: int
    quarter: int
    source: str
    fetched_at: datetime
