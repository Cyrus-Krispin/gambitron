"""Application configuration."""
import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")
if ALLOWED_ORIGINS and ALLOWED_ORIGINS != "*":
    ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS.split(",")]
else:
    ALLOWED_ORIGINS = ["*"]
