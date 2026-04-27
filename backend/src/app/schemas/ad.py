from pydantic import BaseModel, Field


class ADUserRead(BaseModel):
    identity: str = Field(..., max_length=100)
    groups: list[str]
