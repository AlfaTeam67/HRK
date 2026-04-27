from fastapi import APIRouter, HTTPException, Query

from app.models.ad_user import ADUser
from app.models.whoami import CurrentUserResponse
from app.services.ad_service import ADService

router = APIRouter()
service = ADService()


@router.get("/ad/users", response_model=list[ADUser])
async def ad_users() -> list[ADUser]:
    return service.list_users()


@router.get("/ad/user", response_model=ADUser)
async def ad_user(identity: str = Query(..., description="Identity, np. HRK\\asia")) -> ADUser:
    user = service.find_user_by_identity(identity)
    if not user:
        raise HTTPException(status_code=404, detail="Uzytkownik nie znaleziony")

    return user


@router.get("/whoami", response_model=CurrentUserResponse)
async def whoami() -> CurrentUserResponse:
    return service.get_current_user()
