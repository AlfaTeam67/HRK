from pydantic import BaseModel, ConfigDict


class DashboardKpi(BaseModel):
    active_customers: int
    active_contracts: int
    contracts_expiring_30d: int
    valorizations_pending: int
    valorizations_overdue: int

    model_config = ConfigDict(from_attributes=True)
