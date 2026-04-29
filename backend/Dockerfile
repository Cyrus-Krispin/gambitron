FROM python:3.12-slim

WORKDIR /app

# Create non-root user before copying files
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser

# Install dependencies in a separate layer for cache efficiency
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Create PGN storage dir and hand ownership to non-root user
RUN mkdir -p data/games && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# In-process WebSocket state (connection_manager, timer loop) requires a single worker.
# Do NOT add --workers > 1 without first moving that state out-of-process.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
