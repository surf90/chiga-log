"""Stormglass APIから3日分の潮汐extremesを取得し data/tide_data.json として保存する。

extract_daily_data.py のフォールバック経路とは別に、生データのバックアップを残す目的。
"""

import os
import sys
from datetime import timedelta

from _common import http_get_json, load_site_config, now_jst, save_json

_loc = load_site_config().get("location", {})
# 潮汐(Stormglass)用座標。表示基準とは別値（現状維持）。
TIDE_LAT = _loc.get("tide_lat", 35.318)
TIDE_LON = _loc.get("tide_lon", 139.410)


def main() -> None:
    api_key = os.environ.get("STORMGLASS_API_KEY")
    if not api_key:
        print("Error: STORMGLASS_API_KEY is not set.", file=sys.stderr)
        sys.exit(1)

    lat, lon = TIDE_LAT, TIDE_LON
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
