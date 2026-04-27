from pydantic import BaseModel


class AppInfo(BaseModel):
    service: str
    version: str
