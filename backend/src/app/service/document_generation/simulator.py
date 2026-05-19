"""Pure-python financial simulator for valorization amendments.

No DB access here — receives ORM objects from the caller and emits
Pydantic-friendly dicts/Decimals. Numbers in the resulting PDF come
from this module exclusively (LLM never produces figures).
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from app.models.contract import Contract
from app.models.contract_service import ContractService
from app.models.enums import BillingCycle
from app.models.rate import CustomerRate
from app.schemas.document_generation import (
    ServiceSimulation,
    SimulationSummary,
    ValorizationParams,
)

_TWO_PLACES = Decimal("0.01")
_HUNDRED = Decimal("100")


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)


def _periods_per_year(billing_cycle: BillingCycle | None) -> int:
    """How many billing periods fit in a year for revenue projection."""
    match billing_cycle:
        case BillingCycle.MONTHLY:
            return 12
        case BillingCycle.QUARTERLY:
            return 4
        case BillingCycle.ANNUAL:
            return 1
        case BillingCycle.ONE_TIME | None:
            return 1
    return 12


def simulate_valorization(
    *,
    contract: Contract,
    rates_by_cs: dict[UUID, CustomerRate],
    service_names: dict[UUID, str],
    params: ValorizationParams,
) -> SimulationSummary:
    """Compute proposed prices given current rates and the requested index."""
    overrides = {entry.contract_service_id: entry for entry in params.services}

    services_in_scope: list[ContractService] = [
        cs for cs in contract.contract_services if _is_in_scope(cs, overrides)
    ]

    rows: list[ServiceSimulation] = []
    for cs in services_in_scope:
        rate = rates_by_cs.get(cs.id)
        applied_index = _resolve_index(cs.id, overrides, params.index_value)
        row = _build_row(
            cs=cs,
            rate=rate,
            service_name=service_names.get(cs.service_id, "Usługa"),
            applied_index_pct=applied_index,
            billing_cycle=contract.billing_cycle,
        )
        rows.append(row)

    periods = Decimal(_periods_per_year(contract.billing_cycle))
    current_total_year = sum(
        (r.current_effective_price * periods for r in rows), start=Decimal("0")
    )
    proposed_total_year = sum(
        (r.proposed_effective_price * periods for r in rows), start=Decimal("0")
    )
    delta_year = proposed_total_year - current_total_year
    delta_pct = (
        (delta_year / current_total_year * _HUNDRED)
        if current_total_year > 0
        else Decimal("0")
    )
    revenue_in_scope = sum(
        (r.current_effective_price for r in rows), start=Decimal("0")
    )
    weighted_index_numer = sum(
        (r.applied_index_pct * r.current_effective_price for r in rows),
        start=Decimal("0"),
    )
    weighted_avg = (
        (weighted_index_numer / revenue_in_scope) if revenue_in_scope > 0 else Decimal("0")
    )

    return SimulationSummary(
        services=rows,
        current_annual_revenue=_quantize(current_total_year),
        proposed_annual_revenue=_quantize(proposed_total_year),
        delta_annual_revenue=_quantize(delta_year),
        delta_annual_revenue_pct=_quantize(delta_pct),
        weighted_avg_index_pct=_quantize(weighted_avg),
    )


def _is_in_scope(cs: ContractService, overrides: dict[UUID, object]) -> bool:
    if cs.id not in overrides:
        # Default: include every active contract service when user did not narrow scope.
        return True
    entry = overrides[cs.id]
    return bool(getattr(entry, "include", True))


def _resolve_index(
    cs_id: UUID,
    overrides: dict[UUID, object],
    default_index: Decimal,
) -> Decimal:
    entry = overrides.get(cs_id)
    if entry is None:
        return default_index
    custom = getattr(entry, "custom_index_pct", None)
    if custom is None:
        return default_index
    return Decimal(custom)


def _build_row(
    *,
    cs: ContractService,
    rate: CustomerRate | None,
    service_name: str,
    applied_index_pct: Decimal,
    billing_cycle: BillingCycle | None,
) -> ServiceSimulation:
    base_price = rate.base_price if rate else Decimal("0")
    discount_pct = rate.discount_pct if rate else Decimal("0")

    current_effective = _quantize(base_price * (Decimal("1") - discount_pct / _HUNDRED))
    multiplier = Decimal("1") + applied_index_pct / _HUNDRED
    proposed_base = _quantize(base_price * multiplier)
    proposed_effective = _quantize(proposed_base * (Decimal("1") - discount_pct / _HUNDRED))

    delta_period = proposed_effective - current_effective
    periods = Decimal(_periods_per_year(billing_cycle))
    delta_yearly = delta_period * periods

    return ServiceSimulation(
        contract_service_id=cs.id,
        service_name=service_name,
        current_base_price=_quantize(base_price),
        discount_pct=_quantize(discount_pct),
        current_effective_price=current_effective,
        applied_index_pct=_quantize(applied_index_pct),
        proposed_base_price=proposed_base,
        proposed_effective_price=proposed_effective,
        delta_per_period=_quantize(delta_period),
        delta_yearly=_quantize(delta_yearly),
        billing_cycle=billing_cycle.value if billing_cycle else None,
        billing_unit=cs.service.billing_unit.value if cs.service else None,
    )
