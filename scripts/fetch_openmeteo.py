"""Open-MeteoとMarine API、JMAアメダスからデータを取得する。"""

from datetime import datetime

from _common import JST, http_get_json, http_get_text, now_jst, save_json

LAT = 35.3175
LON = 139.4151

WEATHER_URL = (
    f"https://api.open-meteo.com/v1/forecast"
    f"?latitude={LAT}&longitude={LON}&current_weather=true&windspeed_unit=ms"
)
WIND_FORECAST_URL = (
    f"https://api.open-meteo.com/v1/forecast"
    f"?latitude={LAT}&longitude={LON}"
    f"&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m"
    f"&forecast_days=2&timezone=Asia%2FTokyo&windspeed_unit=ms"
)
MARINE_URL = (
    f"https://marine-api.open-meteo.com/v1/marine"
    f"?latitude={LAT}&longitude={LON}&current=wave_height,sea_surface_temperature"
)

# 茅ヶ崎ヘッドランド最寄り官署: 辻堂 (46091)
JMA_AMEDAS_CODE = "46091"
JMA_LATEST_TIME_URL = "https://www.jma.go.jp/bosai/amedas/data/latest_time.txt"
JMA_AMEDAS_MAP_URL = "https://www.jma.go.jp/bosai/amedas/data/map/{ymdhns}.json"


def _qc_value(field):
    """品質管理フラグ付き配列から値を抽出する。フラグ0(正常)以外はNoneを返す。"""
    if not isinstance(field, list) or len(field) < 2:
        return None
    value, flag = field[0], field[1]
    if flag != 0 or value is None:
        return None
    return value


def fetch_jma_amedas() -> dict | None:
    """気象庁アメダス(辻堂)の最新観測値を取得する。"""
    latest = http_get_text(JMA_LATEST_TIME_URL)
    if not latest:
        return None
    latest = latest.strip().lstrip("﻿")
    try:
        observed_dt = datetime.fromisoformat(latest)
    except ValueError as e:
        print(f"[error] latest_time parse: {e}")
        return None

    ymdhns = observed_dt.strftime("%Y%m%d%H%M%S")
    data = http_get_json(JMA_AMEDAS_MAP_URL.format(ymdhns=ymdhns))
    if not data:
        return None
    point = data.get(JMA_AMEDAS_CODE)
    if not point:
        print(f"[error] amedas code {JMA_AMEDAS_CODE} not found")
        return None

    return {
        "observed_at": observed_dt.isoformat(),
        "amedas_code": JMA_AMEDAS_CODE,
        "temp": _qc_value(point.get("temp")),
        "wind": _qc_value(point.get("wind")),
        "windDirection": _qc_value(point.get("windDirection")),
        "humidity": _qc_value(point.get("humidity")),
        "precipitation1h": _qc_value(point.get("precipitation1h")),
    }


def _build_wind_items(hourly: dict) -> list[dict]:
    """Open-Meteoの時系列配列から風予報の整形済みアイテム配列を生成する。"""
    items = []
    times = hourly.get("time", [])
    speeds = hourly.get("wind_speed_10m") or []
    dirs = hourly.get("wind_direction_10m") or []
    gusts = hourly.get("wind_gusts_10m") or []
    for i, t in enumerate(times):
        items.append({
            "time": t,
            "wind_speed_ms": speeds[i] if i < len(speeds) else None,
            "wind_direction_deg": dirs[i] if i < len(dirs) else None,
            "wind_gust_ms": gusts[i] if i < len(gusts) else None,
        })
    return items


def main() -> None:
    """Open-Meteo + アメダスからデータを取得してJSONを生成する。"""
    print("Open-Meteo データの取得を開始します...")

    weather = http_get_json(WEATHER_URL)
    marine = http_get_json(MARINE_URL)
    jma_amedas = fetch_jma_amedas()
    wind_fc = http_get_json(WIND_FORECAST_URL)

    if weather is None or marine is None or wind_fc is None:
        raise RuntimeError("データの取得に失敗しました。")

    updated_at = now_jst().isoformat()

    save_json("data/weather_marine.json", {
        "updated_at": updated_at,
        "current_weather": weather.get("current_weather", {}),
        "marine": marine,
        "jma_amedas": jma_amedas,
    }, indent=2)
    print("保存完了: data/weather_marine.json")

    save_json("data/wind_forecast.json", {
        "source": "Open-Meteo",
        "location": {"name": "茅ヶ崎ヘッドランド", "lat": LAT, "lon": LON},
        "updated_at": updated_at,
        "interval": "1h",
        "items": _build_wind_items(wind_fc.get("hourly", {})),
    }, indent=2)
    print("保存完了: data/wind_forecast.json")


if __name__ == "__main__":
    main()
