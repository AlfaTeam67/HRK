from pydantic import BaseModel


class ADUser(BaseModel):
    identity: str
    displayName: str
    groups: list[str]
    department: str
