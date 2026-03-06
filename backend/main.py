"""
Gambitron backend - bridges to lambda-backend for now.
Adds /health for deployment checks.
"""
import sys
from pathlib import Path

# Allow importing from lambda-backend (hyphen in path)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "lambda-backend"))

from backend import app  # noqa: E402


@app.get("/health")
def health():
    return {"status": "ok"}
