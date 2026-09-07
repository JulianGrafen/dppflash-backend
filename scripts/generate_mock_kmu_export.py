"""Generate mock_kmu_export.xlsx for testing POST /api/v1/kmu/upload-erp-export.

Usage:
    .venv-langgraph/bin/python scripts/generate_mock_kmu_export.py

Column names must match KMU_COLUMN_MAPPING in etl/dpp_flash/inbound/kmu_upload.py.
Row 3 has a missing weight (NaN) on purpose to exercise NaN→None handling.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "mock_kmu_export.xlsx"


def build_mock_frame() -> pd.DataFrame:
    """Three realistic KMU rows; one intentionally incomplete."""
    return pd.DataFrame(
        [
            {
                "Artikelnummer": "KMU-1001",
                "GTIN": "4006381333931",
                "Gewicht (kg)": "12.5",
                "Herstelleradresse": "Musterstraße 1, 12345 Berlin",
                "Entsorgungshinweise": "Restmüll",
            },
            {
                "Artikelnummer": "KMU-1002",
                "GTIN": "4012345678901",
                "Gewicht (kg)": "3.2",
                "Herstelleradresse": "Werkweg 7, 54321 Köln",
                "Entsorgungshinweise": "Wertstoffhof",
            },
            {
                "Artikelnummer": "KMU-1003",
                "GTIN": "4098765432109",
                "Gewicht (kg)": None,  # NaN in Excel — robustness test
                "Herstelleradresse": "Am Hafen 3, 20095 Hamburg",
                "Entsorgungshinweise": None,
            },
        ]
    )


def main() -> None:
    build_mock_frame().to_excel(OUTPUT_PATH, index=False)
    print(f"Wrote {OUTPUT_PATH}")
    print("\nUpload with:\n")
    print(
        "curl -X POST http://localhost:8000/api/v1/kmu/upload-erp-export \\\n"
        f'  -F "file=@{OUTPUT_PATH.name}"'
    )
    print(
        "\n# Production:\n"
        "curl -X POST https://dppflash-etl.onrender.com/api/v1/kmu/upload-erp-export \\\n"
        f'  -F "file=@{OUTPUT_PATH.name}"'
    )


if __name__ == "__main__":
    main()
