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

# 茅ヶ崎ヘッドランド最寄り官署: 辻堂 (46091)
JMA_AMEDAS_CODE = "46091"
JMA_LATEST_TIME_URL = "https://www.jma.go.jp/bosai/amedas/data/latest_time.txt"
JMA_AMEDAS_MAP_URL = "https://www.jma.go.jp/bosai/amedas/data/map/{ymdhns}.json"


def fetch_json(url: str) -> dict | None:
    """URLからJSONデータを取得する。"""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ChigaLog/1.0)"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[error] {url}: {e}")
        return None


def fetch_text(url: str) -> str | None:
    """URLからテキストデータを取得する。"""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ChigaLog/1.0)"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8")
    except Exception as e:
        print(f"[error] {url}: {e}")
        return None


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
    latest = fetch_text(JMA_LATEST_TIME_URL)
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
    data = fetch_json(JMA_AMEDAS_MAP_URL.format(ymdhns=ymdhns))
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

    weather = fetch_json(WEATHER_URL)
    marine = fetch_json(MARINE_URL)
    jma_amedas = fetch_jma_amedas()

    if weather is None or marine is None:
        raise RuntimeError("データの取得に失敗しました。")

    result = {
        "updated_at": datetime.now(timezone(timedelta(hours=9))).isoformat(),
        "current_weather": weather.get("current_weather", {}),
        "marine": marine,
        "jma_amedas": jma_amedas,
    }

    os.makedirs("data", exist_ok=True)
    output_path = "data/weather_marine.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"保存完了: {output_path}")


if __name__ == "__main__":
    main()
