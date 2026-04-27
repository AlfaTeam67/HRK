from pydantic import BaseModel, ConfigDict, Field


class ADUserRead(BaseModel):
    identity: str = Field(..., max_length=100)
    display_name: str = Field(alias="displayName", max_length=255)
    groups: list[str]
    department: str | None = Field(None, max_length=100)

    model_config = ConfigDict(populate_by_name=True)
