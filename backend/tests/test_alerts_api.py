from unittest.mock import patch, MagicMock, AsyncMock
import pytest
from httpx import AsyncClient
import uuid
from datetime import datetime, timezone
from app.schemas.alert import AlertRead
from app.schemas.dashboard import DashboardKpi

@pytest.mark.asyncio
async def test_get_alerts_integration(client: AsyncClient):
    with patch("app.api.v1.alerts.AlertService") as mock_service_cls:
        mock_service = MagicMock()
        
        mock_alert = AlertRead(
            id=uuid.uuid4(),
            type="contract_expiry_30",
            severity="urgent",
            title="Test Alert",
            detail="Detail",
            contract_id=uuid.uuid4(),
            customer_id=uuid.uuid4(),
            due_date="2026-05-30",
            created_at=datetime.now(timezone.utc),
        )
        
        mock_service.get_alerts = AsyncMock(return_value=[mock_alert])
        mock_service_cls.return_value = mock_service

        response = await client.get("/api/v1/alerts/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["type"] == "contract_expiry_30"

@pytest.mark.asyncio
async def test_get_dashboard_kpi_integration(client: AsyncClient):
    with patch("app.api.v1.dashboard.AlertService") as mock_service_cls:
        mock_service = MagicMock()
        
        mock_kpi = DashboardKpi(
            active_customers=12,
            active_contracts=18,
            contracts_expiring_30d=3,
            valorizations_pending=3,
            valorizations_overdue=2
        )
        
        mock_service.get_dashboard_kpi = AsyncMock(return_value=mock_kpi)
        mock_service_cls.return_value = mock_service

        response = await client.get("/api/v1/dashboard/kpi")
        assert response.status_code == 200
        data = response.json()
        assert data["active_customers"] == 12
        assert data["valorizations_overdue"] == 2
