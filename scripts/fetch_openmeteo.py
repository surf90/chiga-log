import json
import time
import urllib.error
import urllib.request
import os
from datetime import datetime, timezone, timedelta

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


_MAX_ATTEMPTS = 3
_BACKOFF_SECONDS = (2, 4)


def _fetch_with_retry(url: str, label: str, parse_json: bool):
    """URL取得を最大3回試行する。一時的な失敗はバックオフでリトライする。"""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ChigaLog/1.0)"})
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if parse_json else raw
        except urllib.error.HTTPError as e:
            # 4xx (429除く) はリトライしても無駄
            if 400 <= e.code < 500 and e.code != 429:
                print(f"[error] {label} {url}: HTTP {e.code} {e.reason}")
                return None
            last_err = f"HTTP {e.code} {e.reason}"
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last_err = repr(e)
        except Exception as e:
            print(f"[error] {label} {url}: {e}")
            return None

        if attempt < _MAX_ATTEMPTS:
            wait = _BACKOFF_SECONDS[attempt - 1]
            print(f"[warn] {label} attempt {attempt}/{_MAX_ATTEMPTS} failed: {url}: {last_err} (retry in {wait}s)")
            time.sleep(wait)
        else:
            print(f"[error] {label} giving up after {_MAX_ATTEMPTS} attempts: {url}: {last_err}")
    return None


def fetch_json(url: str, label: str) -> dict | None:
    """URLからJSONデータを取得する。失敗時は最大3回までリトライする。"""
    return _fetch_with_retry(url, label, parse_json=True)


def fetch_text(url: str, label: str) -> str | None:
    """URLからテキストデータを取得する。失敗時は最大3回までリトライする。"""
    return _fetch_with_retry(url, label, parse_json=False)


def _qc_value(field):
    """品質管理フラグ付き配列から値を抽出する。フラグ0(正常)以外はNoneを返す。"""
    if not isinstance(field, list) or len(field) < 2:
        return None
    value, flag = field[0], field[1]
    if flag != 0 or value is None:
        return None
    return value


def fetch_jma_amedas() -> dict | None:
    """気象庁アメダス(辻堂)の最新観測値を取得する。

    ガイドライン遵守のため latest_time.txt を必ず参照してから map JSON を取得する。
    """
    latest = fetch_text(JMA_LATEST_TIME_URL, "jma_latest_time")
    if not latest:
        return None
    latest = latest.strip().lstrip("﻿")
    try:
        # 例: 2026-03-19T16:10:00+09:00
        observed_dt = datetime.fromisoformat(latest)
    except ValueError as e:
        print(f"[error] latest_time parse: {e}")
        return None

    ymdhns = observed_dt.strftime("%Y%m%d%H%M%S")
    data = fetch_json(JMA_AMEDAS_MAP_URL.format(ymdhns=ymdhns), "jma_amedas_map")
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


def main() -> None:
    """Open-MeteoとMarine APIからデータを取得してweather_marine.jsonを生成する。"""
    print("Open-Meteo データの取得を開始します...")

    weather = fetch_json(WEATHER_URL, "weather")
    marine = fetch_json(MARINE_URL, "marine")
    jma_amedas = fetch_jma_amedas()
    wind_fc = fetch_json(WIND_FORECAST_URL, "wind_forecast")

    failed = [k for k, v in {"weather": weather, "marine": marine, "wind_fc": wind_fc}.items() if v is None]
    if failed:
        raise RuntimeError(f"必須データ取得失敗: {failed}")

    result = {
        "updated_at": datetime.now(timezone(timedelta(hours=9))).isoformat(),
        "current_weather": weather.get("current_weather", {}),
        "marine": marine,
        "jma_amedas": jma_amedas,
    }

    wind_hourly = wind_fc.get("hourly", {})
    wind_items = []
    for i, t in enumerate(wind_hourly.get("time", [])):
        ws = (wind_hourly.get("wind_speed_10m") or [None])[i] if i < len(wind_hourly.get("wind_speed_10m", [])) else None
        wd = (wind_hourly.get("wind_direction_10m") or [None])[i] if i < len(wind_hourly.get("wind_direction_10m", [])) else None
        wg = (wind_hourly.get("wind_gusts_10m") or [None])[i] if i < len(wind_hourly.get("wind_gusts_10m", [])) else None
        wind_items.append({"time": t, "wind_speed_ms": ws, "wind_direction_deg": wd, "wind_gust_ms": wg})

    os.makedirs("data", exist_ok=True)
    output_path = "data/weather_marine.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"保存完了: {output_path}")

    wind_path = "data/wind_forecast.json"
    wind_result = {
        "source": "Open-Meteo",
        "location": {"name": "茅ヶ崎ヘッドランド", "lat": LAT, "lon": LON},
        "updated_at": result["updated_at"],
        "interval": "1h",
        "items": wind_items,
    }
    with open(wind_path, "w", encoding="utf-8") as f:
        json.dump(wind_result, f, ensure_ascii=False, indent=2)
    print(f"保存完了: {wind_path}")


if __name__ == "__main__":
    main()
