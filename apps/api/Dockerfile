FROM python:3.12-slim
WORKDIR /app
COPY apps/api/pyproject.toml ./pyproject.toml
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/alembic ./alembic
COPY apps/api/app ./app
RUN pip install --no-cache-dir .
ENV RELEASETRUTH_DATABASE_URL=postgresql+psycopg://releasetruth:releasetruth@postgres:5432/releasetruth
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
