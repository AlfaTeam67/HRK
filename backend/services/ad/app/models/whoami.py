from pydantic import BaseModel


class CurrentUserResponse(BaseModel):
    identity: str | None
    groups: list[str]
