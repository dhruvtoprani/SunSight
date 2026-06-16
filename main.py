from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"

sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("STATIC_DIR", str(ROOT / "backend" / "static"))

from app.main import app  # noqa: E402
