FROM git.hrk.pl:3000/pypi-local/python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
ENV PIP_INDEX_URL=https://git.hrk.pl:3000/api/packages/pypi-local/pypi/simple/
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8002

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
