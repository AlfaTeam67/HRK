import getpass
import os

from app.models.ad_user import ADUser
from app.models.whoami import CurrentUserResponse


class ADService:
    def __init__(self) -> None:
        self._users: list[ADUser] = [
            ADUser(
                identity=r"HRK\asia",
                displayName="Joanna Kniema",
                groups=[
                    r"HRK\users",
                    r"HRK\observator",
                    r"HRK\HR",
                ],
                department="HR",
            ),
            ADUser(
                identity=r"HRK\mateusz",
                displayName="Mateusz Kowalski",
                groups=[
                    r"HRK\Administrator",
                    r"HRK\users",
                    r"HRK\IT",
                ],
                department="Infrastruktura",
            ),
            ADUser(
                identity=r"HRK\tomek",
                displayName="Tomasz Nowak",
                groups=[
                    r"HRK\users",
                    r"HRK\observator",
                    r"HRK\Sales",
                ],
                department="Handlowy",
            ),
            ADUser(
                identity=r"HRK\kasia",
                displayName="Katarzyna Nowakowska",
                groups=[
                    r"HRK\users",
                    r"HRK\account_managers",
                    r"HRK\Sales",
                ],
                department="Obsługa Klienta",
            ),
        ]
        self._users_by_identity: dict[str, ADUser] = {
            self._normalize_identity(user.identity): user for user in self._users
        }

    def list_users(self) -> list[ADUser]:
        return self._users

    def find_user_by_identity(self, identity: str) -> ADUser | None:
        return self._users_by_identity.get(self._normalize_identity(identity))

    def _normalize_identity(self, identity: str) -> str:
        return identity.strip().replace("/", "\\").lower()

    def _resolve_identity_for_simulation(self) -> str | None:
        simulated_identity = os.environ.get("AD_SIMULATED_IDENTITY")
        if simulated_identity:
            return simulated_identity

        try:
            user = getpass.getuser()
        except Exception:
            user = os.environ.get("USERNAME") or os.environ.get("USER")

        if not user:
            return None

        if "\\" in user:
            return user

        domain = os.environ.get("AD_SIMULATED_DOMAIN", "HRK")
        return f"{domain}\\{user}"

    def get_current_user(self) -> CurrentUserResponse:
        identity = self._resolve_identity_for_simulation()
        matched_user = self.find_user_by_identity(identity) if identity else None
        return CurrentUserResponse(
            identity=identity,
            groups=matched_user.groups if matched_user else [],
        )
