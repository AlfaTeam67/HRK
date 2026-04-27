# AD Microservice

Mikroserwis AD z pelna symulacja domeny na potrzeby demo.

## Uruchomienie lokalne

```bash
cd backend/AD
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Endpointy symulacji AD

- `GET /ad/users` - lista uzytkownikow AD (mock)
- `GET /ad/user?identity=HRK\asia` - pojedynczy uzytkownik po identity
- `GET /whoami` - aktualna tozsamosc procesu mapowana do formatu domenowego

## Wymuszenie tozsamosci domenowej

W pliku `.env` ustaw:

```bash
AD_SIMULATED_IDENTITY=HRK\\asia
```

Po restarcie serwera `GET /whoami` zwroci `HRK\asia` i dopasuje dane uzytkownika z listy.
