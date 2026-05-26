FROM python:3.12-slim

WORKDIR /app

# Increase pip timeout and retries for slow/flaky network environments
ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=5

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app /app/app

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
