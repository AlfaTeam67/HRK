FROM python:3.13-slim
WORKDIR /app
RUN pip install fastapi uvicorn sqlalchemy psycopg2-binary
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
