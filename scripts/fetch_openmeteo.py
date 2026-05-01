import json
import urllib.request
import os
from datetime import datetime, timezone, timedelta

LAT = 35.3175
LON = 139.4151

WEATHER_URL = (
    f"https://api.open-meteo.com/v1/forecast"
    f"?latitude={LAT}&longitude={LON}&current_weather=true&windspeed_unit=ms"
)
MARINE_URL = (
    f"https://marine-api.open-meteo.com/v1/marine"
    f"?latitude={LAT}&longitude={LON}&current=wave_height,sea_surface_temperature"
)


def fetch_json(url: str) -> dict | None:
    """URLからJSONデータを取得する。"""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ChigaLog/1.0)"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[error] {url}: {e}")
        return None


def main() -> None:
    """Open-MeteoとMarine APIからデータを取得してweather_marine.jsonを生成する。"""
    print("Open-Meteo データの取得を開始します...")

    weather = fetch_json(WEATHER_URL)
    marine = fetch_json(MARINE_URL)

    if weather is None or marine is None:
        raise RuntimeError("データの取得に失敗しました。")

    result = {
        "updated_at": datetime.now(timezone(timedelta(hours=9))).isoformat(),
        "current_weather": weather.get("current_weather", {}),
        "marine": marine,
    }

    os.makedirs("data", exist_ok=True)
    output_path = "data/weather_marine.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"保存完了: {output_path}")


if __name__ == "__main__":
    main()
