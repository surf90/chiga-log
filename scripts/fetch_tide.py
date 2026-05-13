"""Stormglass APIから3日分の潮汐extremesを取得し data/tide_data.json として保存する。

extract_daily_data.py のフォールバック経路とは別に、生データのバックアップを残す目的。
"""

import os
import sys
from datetime import timedelta

from _common import http_get_json, now_jst, save_json


def main() -> None:
    api_key = os.environ.get("STORMGLASS_API_KEY")
    if not api_key:
        print("Error: STORMGLASS_API_KEY is not set.", file=sys.stderr)
        sys.exit(1)

    lat, lon = 35.318, 139.410
    n = now_jst()
    start = int(n.replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
    end = int((n.replace(hour=23, minute=59, second=59, microsecond=0) + timedelta(days=2)).timestamp())

    url = (
        f"https://api.stormglass.io/v2/tide/extremes/point"
        f"?lat={lat}&lng={lon}&start={start}&end={end}"
    )
    data = http_get_json(url, headers={"Authorization": api_key}, timeout=20)
    if data is None:
        print("Error fetching Stormglass data.", file=sys.stderr)
        sys.exit(1)

    save_json("data/tide_data.json", data, indent=2)
    print("Successfully fetched and saved tide_data.json")


if __name__ == "__main__":
    main()
