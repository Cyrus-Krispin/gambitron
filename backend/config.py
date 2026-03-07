"""Application configuration."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend directory (works regardless of cwd)
load_dotenv(Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")
if ALLOWED_ORIGINS and ALLOWED_ORIGINS != "*":
    ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS.split(",")]
else:
    ALLOWED_ORIGINS = ["*"]
