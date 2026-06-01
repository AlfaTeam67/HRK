# Migracje (Alembic)

## Cel

Jak generować, stosować i debugować migracje DB. **Nigdy** nie modyfikuj
schematu produkcyjnego ręcznie — tylko przez Alembic.

---

## Co masz w repo

```
backend/
├── alembic.ini             # konfiguracja: script_location=alembic
├── alembic/
│   ├── env.py              # async runner (asyncio.run + async_engine_from_config)
│   ├── script.py.mako      # template nowej migracji
│   └── versions/
│       ├── dda74663e6ba_feat_initial_crm_schema_mvp_alf_39.py     # początkowy schemat
│       ├── 40a1f8a0d4a7_add_company_id_to_attachments.py
│       ├── a1b2c3d4e5f6_add_email_index_to_contact_persons.py
│       ├── 1b2c3d4e5f6a_simplify_users_to_login_email.py
│       ├── b9813a3347a3_merge_multiple_heads.py
│       ├── c3f8e2a1b0d9_normalize_enum_values_to_lowercase.py
│       ├── d7e2c1f4a9b3_add_document_generations.py
│       ├── f3a9b2c1d8e4_add_primary_document_to_contracts.py
│       ├── e1f2a3b4c5d6_add_gus_cpi_snapshots.py
│       ├── a2b3c4d5e6f7_merge_gus_cpi_and_primary_document_heads.py
│       └── b8c9d0e1f2a3_add_include_in_ai_assistant_to_attachments.py
```

---

## Stosowanie migracji

### Lokalnie (Poetry)
```bash
cd backend
make migrate          # = PYTHONPATH=src poetry run alembic upgrade head
```

### W Dockerze (po `docker compose up`)
```bash
make docker-migrate   # = docker compose exec api alembic upgrade head
```

> Pierwsze uruchomienie kontenera **nie** uruchamia migracji
> automatycznie. Trzeba to zrobić ręcznie po starcie. Jeśli dorzucisz
> autostart — udokumentuj.

---

## Tworzenie nowej migracji (autogenerate)

```bash
# 1. Zmień model w src/app/models/*.py
# 2. Upewnij się, że nowy model jest re-eksportowany w models/__init__.py
# 3. Wygeneruj migrację:
make makemigration MSG="add gross_price to customer_rates"
# 4. Otwórz wygenerowany plik w alembic/versions/, sprawdź diff
# 5. Zastosuj:
make migrate
```

> **Zawsze** otwórz wygenerowaną migrację. Autogenerate nie wykrywa:
> - zmian wartości `default` / `server_default`
> - zmian typu kolumny w niektórych przypadkach
> - przemianowania kolumn (zinterpretuje jako DROP + ADD)
> - zmian w enumach z `native_enum=False` (są po prostu VARCHAR)

---

## Zasady pisania migracji

### Nazewnictwo
- Plik: `<hash>_<short_description>.py` (Alembic generuje hash sam).
- Wiadomość commit-style, czasownik w trybie rozkazującym:
  `add_email_index_to_contact_persons`, `simplify_users_to_login_email`.

### Co MUSZĘ zrobić
- ✅ Trzymać się konwencji nazewniczej constraintów (zdefiniowanej w
  `models/base.py`). Diffy autogenerate są deterministyczne.
- ✅ Dodać `down_revision` (Alembic robi to sam, ale sprawdź).
- ✅ Pisać `upgrade()` ORAZ `downgrade()`. Nawet jeśli downgrade nigdy
  nie pojechał na produkcji, piszemy go — to dokumentacja zmiany.
- ✅ Przy ALTER TABLE z `nullable=False` na istniejącej tabeli — **najpierw**
  dodaj kolumnę z `server_default`, **potem** usuń default w kolejnym
  kroku jeśli niepotrzebny.

### Czego NIE robić
- ❌ Edytować już zmergowanych migracji. Stwórz kolejną.
- ❌ Mieszać DDL i DML w jednej migracji bez transakcji.
- ❌ Polegać na auto-detekcji enum'ów (są stringami). Migracja
  wartości enum to ręczny `op.execute("UPDATE ...")`.

---

## Multiple heads (rozjazdy)

Jeśli dwóch deweloperów stworzyło migracje na bazie tego samego rodzica,
po `git pull` Alembic zwróci błąd „multiple heads". Rozwiązanie:

```bash
PYTHONPATH=src poetry run alembic heads      # zobacz głowy
PYTHONPATH=src poetry run alembic merge -m "merge multiple heads" head1 head2
make migrate
```

W repo jest już przykład: `b9813a3347a3_merge_multiple_heads.py`.

---

## Async runner

Plik `alembic/env.py` jest **niestandardowy** — używa async engine:

```python
def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

async def run_async_migrations() -> None:
    connectable = async_engine_from_config(...)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
```

To wynika z faktu, że `DATABASE_URL` ma driver `postgresql+asyncpg://`.
Standardowy synchroniczny env.py nie zadziała.

---

## Przykładowe wzorce

### Dodanie kolumny z `server_default`
```python
def upgrade() -> None:
    op.add_column(
        "contracts",
        sa.Column("notice_period_days", sa.Integer(), server_default="90", nullable=False),
    )

def downgrade() -> None:
    op.drop_column("contracts", "notice_period_days")
```

### Zmiana wartości enum (na poziomie danych)
```python
def upgrade() -> None:
    op.execute("UPDATE customers SET status = 'active' WHERE status = 'ACTIVE'")

def downgrade() -> None:
    op.execute("UPDATE customers SET status = 'ACTIVE' WHERE status = 'active'")
```

### Indeks częściowy / wyrażeniowy
```python
def upgrade() -> None:
    op.create_index(
        "idx_att_ocr_status",
        "attachments",
        ["ocr_status"],
        postgresql_where=sa.text("ocr_status IN ('pending', 'processing')"),
    )
```

### HNSW dla pgvector
```python
def upgrade() -> None:
    op.create_index(
        "idx_chunks_embedding_hnsw",
        "document_chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
        postgresql_with={"m": 16, "ef_construction": 64},
    )
```

---

## Diagnostyka

| Symptom | Co zrobić |
|---|---|
| `target metadata is empty` | Brakuje importu modelu w `models/__init__.py`. |
| `multiple heads` | `alembic heads` → `alembic merge -m "..." h1 h2`. |
| Diff w migracji wymyśla zbędne zmiany | Sprawdź czy konwencja constraintów (`models/base.py`) nie została zepsuta. |
| `relation already exists` | Bazę w lokalnym Postgresie zresetuj: `docker compose down -v && docker compose up -d db`. |
| `ImportError: cannot import name 'app'` | `PYTHONPATH=src` musi być ustawione (Makefile to robi). |
