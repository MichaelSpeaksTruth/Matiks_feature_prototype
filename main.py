import os
import sys

# Add backend subdirectory to path so imports work correctly
backend_path = os.path.join(os.path.dirname(__file__), "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Import the FastAPI application from backend/main.py
from backend.main import app
