import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.models.contract import Contract
from app.models.customer import Customer
from app.models.enums import ContractStatus, CustomerStatus, ValorizationStatus
from app.models.rate import Valorization
from app.service.alert import AlertService

pytestmark = pytest.mark.asyncio


@pytest.fixture
def db_session_mock():
    return AsyncMock()


async def test_alert_service_contract_expiry_30_days(db_session_mock):
    service = AlertService(db_session_mock)
    today = date.today()

    contract = Contract(
        id=uuid.uuid4(),
        contract_number="TEST/1",
        status=ContractStatus.ACTIVE,
        end_date=today + timedelta(days=30),
        customer_id=uuid.uuid4(),
    )
    
    async def mock_execute(query):
        res = MagicMock()
        query_str = str(query).lower()
        if "valorization" in query_str:
            res.scalars.return_value.all.return_value = []
        elif "activity_logs" in query_str:
            res.all.return_value = []
        elif "contract" in query_str:
            res.scalars.return_value.all.return_value = [contract]
        elif "customer" in query_str:
            res.scalars.return_value.all.return_value = []
        else:
            res.scalars.return_value.all.return_value = []
        return res
        
    db_session_mock.execute.side_effect = mock_execute

    alerts = await service.get_alerts()
    assert len(alerts) == 1
    assert alerts[0].type == "contract_expiry_30"
    assert alerts[0].severity == "urgent"


async def test_alert_service_contract_expiry_29_days(db_session_mock):
    service = AlertService(db_session_mock)
    today = date.today()

    contract = Contract(
        id=uuid.uuid4(),
        contract_number="TEST/2",
        status=ContractStatus.ACTIVE,
        end_date=today + timedelta(days=29),
        customer_id=uuid.uuid4(),
    )
    
    async def mock_execute(query):
        res = MagicMock()
        query_str = str(query).lower()
        if "valorization" in query_str:
            res.scalars.return_value.all.return_value = []
        elif "activity_logs" in query_str:
            res.all.return_value = []
        elif "contract" in query_str:
            res.scalars.return_value.all.return_value = [contract]
        elif "customer" in query_str:
            res.scalars.return_value.all.return_value = []
        else:
            res.scalars.return_value.all.return_value = []
        return res
        
    db_session_mock.execute.side_effect = mock_execute

    alerts = await service.get_alerts()
    assert len(alerts) == 1
    assert alerts[0].type == "contract_expiry_30"


async def test_alert_service_contract_expiry_31_days(db_session_mock):
    service = AlertService(db_session_mock)
    today = date.today()

    contract = Contract(
        id=uuid.uuid4(),
        contract_number="TEST/3",
        status=ContractStatus.ACTIVE,
        end_date=today + timedelta(days=31),
        customer_id=uuid.uuid4(),
    )
    
    async def mock_execute(query):
        res = MagicMock()
        query_str = str(query).lower()
        if "valorization" in query_str:
            res.scalars.return_value.all.return_value = []
        elif "activity_logs" in query_str:
            res.all.return_value = []
        elif "contract" in query_str:
            res.scalars.return_value.all.return_value = [contract]
        elif "customer" in query_str:
            res.scalars.return_value.all.return_value = []
        else:
            res.scalars.return_value.all.return_value = []
        return res
        
    db_session_mock.execute.side_effect = mock_execute

    alerts = await service.get_alerts()
    assert len(alerts) == 1
    assert alerts[0].type == "contract_expiry_60"


async def test_alert_service_valorization_pending(db_session_mock):
    service = AlertService(db_session_mock)
    today = date.today()

    val = Valorization(
        id=uuid.uuid4(),
        contract_id=uuid.uuid4(),
        status=ValorizationStatus.PENDING,
        planned_date=today + timedelta(days=29),
    )
    
    async def mock_execute(query):
        res = MagicMock()
        query_str = str(query).lower()
        if "valorization" in query_str:
            res.scalars.return_value.all.return_value = [val]
        elif "activity_logs" in query_str:
            res.all.return_value = []
        elif "contract" in query_str:
            res.scalars.return_value.all.return_value = []
        elif "customer" in query_str:
            res.scalars.return_value.all.return_value = []
        else:
            res.scalars.return_value.all.return_value = []
        return res
        
    db_session_mock.execute.side_effect = mock_execute

    alerts = await service.get_alerts()
    assert len(alerts) == 1
    assert alerts[0].type == "valorization_pending"
    assert alerts[0].severity == "high"


async def test_alert_service_no_contact(db_session_mock):
    service = AlertService(db_session_mock)
    today = datetime.now(timezone.utc)

    customer = Customer(
        id=uuid.uuid4(),
        ckk="C123",
        status=CustomerStatus.ACTIVE,
        created_at=today - timedelta(days=95),
    )
    
    async def mock_execute(query):
        res = MagicMock()
        query_str = str(query).lower()
        if "valorization" in query_str:
            res.scalars.return_value.all.return_value = []
        elif "activity_logs" in query_str:
            res.all.return_value = []
        elif "contract" in query_str:
            res.scalars.return_value.all.return_value = []
        elif "customer" in query_str:
            res.scalars.return_value.all.return_value = [customer]
        else:
            res.scalars.return_value.all.return_value = []
        return res
        
    db_session_mock.execute.side_effect = mock_execute

    alerts = await service.get_alerts()
    assert len(alerts) == 1
    assert alerts[0].type == "no_contact"
    assert alerts[0].severity == "medium"
