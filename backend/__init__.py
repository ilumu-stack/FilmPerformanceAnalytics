"""
FilmIQ backend package.

Adds the project root to sys.path so the 'ml' package is importable
regardless of how the application is launched (uvicorn, pytest, Docker).

Strategy:
  - Locally: backend/ is CWD, ml/ is at ../ml/ → add parent of backend/
  - Docker:  /app is CWD, ml/ is at /app/ml/ → add /app (same as CWD)

We detect Docker by checking if we're running from /app.
"""
import sys
import os

_here = os.path.dirname(os.path.abspath(__file__))  # .../backend/ or /app

# The project root is parent of the backend/ directory
_project_root = os.path.dirname(_here)

# In Docker, _here = /app and _project_root = /  (wrong)
# Detect this: if _here ends with 'backend' locally but IS /app in Docker
# Safe fix: add BOTH _here and _project_root; duplicates are filtered by Python
for _path in (_project_root, _here):
    if _path and _path not in sys.path:
        sys.path.insert(0, _path)
