import sys
from pathlib import Path

# Ensure ml-service root directory is on sys.path when running pytest from workspace root
ml_service_dir = Path(__file__).resolve().parent / "ml-service"
if str(ml_service_dir) not in sys.path:
    sys.path.insert(0, str(ml_service_dir))
