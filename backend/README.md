# HRK Backend

FastAPI-based backend for HRK application with complete project structure.

## Quick Start

### Prerequisites

- Python 3.12+
- Poetry
- Docker + Docker Compose (for full stack)

## Docker (recommended)

Copy the env file and start the backend stack:

```bash
cp .env.example .env
make docker-up
```

This starts:
| Service | URL |
|---|---|
| FastAPI API | http://localhost:8000 |
| AD microservice | http://localhost:8001 |
| Schema Manager | http://localhost:8002 |
| API docs (debug) | http://localhost:8000/docs |
| PostgreSQL + pgvector | localhost:5432 |
| MinIO S3 API | http://localhost:9000 |
| MinIO Console | http://localhost:9001 |

The `minio-init` container automatically creates the `hrk-documents` bucket on first start.

If your environment cannot resolve `registry-1.docker.io`, set `PYTHON_BASE_IMAGE` in `.env` to a reachable registry mirror (default is already set to `public.ecr.aws/docker/library/python:3.12-slim` in `.env.example`).

Apply migrations after the stack is up:

```bash
make docker-migrate
```

### Useful Docker commands

```bash
make docker-down    # Stop all containers
make docker-build   # Rebuild images after Dockerfile changes
make docker-logs    # Tail API logs
make docker-logs-ad # Tail AD microservice logs
make docker-logs-schema-manager # Tail Schema Manager logs
make minio-init     # Re-create MinIO bucket manually if needed
```

## Schema Manager

All table/column management logic lives in the `schema_manager` microservice.

Supported endpoints:

- `POST /tables/create`
- `DELETE /tables/drop`
- `PUT /tables/rename`
- `POST /columns/add`
- `DELETE /columns/drop`
- `PUT /columns/update-type`
- `GET /tables/inspect/{table_name}`

Supported column types:

- `TEXT`
- `INTEGER` / `INT`
- `BOOLEAN`
- `TIMESTAMP`
- `DATE`
- `FLOAT` / `DOUBLE`
- `NUMERIC`
- `VARCHAR`

### Installation

```bash
cd backend
poetry install
```

### Running Locally

```bash
make run
```

Or manually with auto-reload:

```bash
poetry run uvicorn app.main:app --reload
```

## AD Login Flow

The main API now talks to the AD microservice and can sync a user into PostgreSQL.
Users are stored with only three fields: `id`, `login`, `email`.
The email is generated as `login@hrk.eu`.

Login endpoint:

```bash
POST /api/v1/auth/login/{username}
```

Example:

```bash
POST /api/v1/auth/login/asia
```

Required integration setting for local runs:

```bash
AD_SERVICE_URL=http://localhost:8001
```

When running through Docker Compose, the API container uses `http://ad:8001` automatically.

## Development Commands

All commands should be run from the `backend/` directory:

```bash
make install    # Install dependencies with Poetry
make run        # Run the application locally
make test       # Run pytest
make test-docker # Run pytest with Docker-backed dependencies (db/minio/ad/...)
make lint       # Run ruff linter
make format     # Format code with ruff
make typecheck  # Run mypy type checking
make security   # Run bandit security check
make migrate    # Apply database migrations
make makemigration  # Create new database migration
make check      # Run all checks: lint + typecheck + test + security
```

## Project Structure

```
app/
  ├── api/          # API routes and endpoints
  ├── core/         # Core infra: database and shared internals
  ├── models/       # SQLAlchemy database models
  ├── repo/         # Repository/DAL layer
  ├── schemas/      # Pydantic request/response schemas
  ├── service/      # Business logic services
  ├── utils/        # Utility functions and helpers
  ├── config.py     # Pydantic v2 settings
  └── main.py       # Application entry point and basic endpoints

alembic/           # Database migrations
  ├── versions/     # Migration scripts
  └── env.py        # Alembic environment config

tests/             # Test suite
  └── test_*.py     # Test files
```

## Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory based on `.env.example`:

```bash
cp .env.example .env
```

Available settings:

- `DATABASE_URL` - SQLite, PostgreSQL, or MySQL connection string
- `DEBUG` - Enable debug mode
- `APP_NAME` - Application name
- `APP_VERSION` - Application version
- `HOST` - Server host (default: 127.0.0.1)
- `PORT` - Server port (default: 8000)

### Tools Configuration

All tools are pre-configured in `pyproject.toml`:

- **ruff**: Code linting and formatting
- **mypy**: Static type checking
- **pytest**: Testing framework
- **bandit**: Security analysis
- **alembic**: Database migrations

## Development Workflow

1. **Install dependencies**:

   ```bash
   make install
   ```

2. **Run application**:

   ```bash
   make run
   ```

3. **Create a new feature**:

   ```bash
   # Write tests first (TDD)
   # Add schemas, models, services
   # Add API routes
   ```

4. **Check code quality**:

   ```bash
   make check
   ```

5. **Database migrations**:

   ```bash
   # Create migration
   make makemigration

   # Apply migrations
   make migrate
   ```

## Architecture Notes

### Separation of Concerns

- **API Layer** (`api/`): HTTP request handling, route definitions
- **Schema Layer** (`schemas/`): Request/response validation (Pydantic)
- **Service Layer** (`service/`): Business logic
- **Repository Layer** (`repo/`): Database access (ORM abstraction)
- **Model Layer** (`models/`): SQLAlchemy ORM definitions
- **Core** (`core/`): Infrastructure internals (e.g. database)
- **Utils** (`utils/`): Shared utilities and helpers

This structure promotes clean code, testability, and maintainability.

## Testing

Tests are located in the `tests/` directory with naming convention `test_*.py`.

```bash
# Run all tests
make test

# Run with coverage
poetry run pytest --cov=app tests/
```

## Type Checking

MyPy is configured with strict settings:

```bash
make typecheck
```

All code should be fully typed.

## Security

Bandit checks for common security issues:

```bash
make security
```

## CI/CD Friendly

All checks can be run with:

```bash
make check
```

This is ideal for CI pipelines and pre-commit hooks.
