"""毎日 JST 0:05 に実行し、当日分の月齢・潮汐データを小さなJSONとして出力する。"""

import os
import sys
from datetime import datetime, timedelta, timezone

from _common import JST, http_get_json, load_json, load_site_config, now_jst, save_json

_loc = load_site_config().get("location", {})
# 潮汐フォールバック(Stormglass)用座標。表示基準とは別値（現状維持）。
TIDE_LAT = _loc.get("tide_lat", 35.318)
TIDE_LON = _loc.get("tide_lon", 139.410)


def extract_moon_today() -> dict | None:
    """NASA SVSの年間JSONから当日JST正午の月齢エントリを抽出して返す。"""
    n = now_jst()
    year = n.year
    moon_file = f"data/mooninfo_{year}.json"

    moon_data = load_json(moon_file)
    if moon_data is None:
        return None

    target_utc = datetime(n.year, n.month, n.day, 3, 0, 0, tzinfo=timezone.utc)
    year_start = datetime(year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    hour_index = int((target_utc - year_start).total_seconds() / 3600)

    if hour_index < 0 or hour_index >= len(moon_data):
        print(f"[moon] hourIndex={hour_index} が範囲外です。", file=sys.stderr)
        return None

    entry = moon_data[hour_index]
    result = {
        "date": n.strftime("%Y-%m-%d"),
        "age": round(entry["age"], 3),
        "phase": round(entry["phase"], 1),
    }
    save_json("data/moon_today.json", result)
    print(f"[moon] {result['date']} age={result['age']} phase={result['phase']}")
    return result


def extract_tide_today(all_tides: dict) -> bool:
    """気象庁の年間潮汐JSONから当日のエントリを抽出する。"""
    date_str = now_jst().strftime("%Y-%m-%d")
    today_tides = all_tides.get(date_str, [])
    save_json("data/tide_today.json", {"date": date_str, "tides": today_tides})
    print(f"[tide] {date_str} {len(today_tides)} エントリを保存しました。")
    return True


def extract_tide_3day(all_tides: dict) -> bool:
    """気象庁の年間潮汐JSONから本日〜翌々日のエントリを出力する。"""
    n = now_jst()
    days = []
    for delta in range(3):
        d = n + timedelta(days=delta)
        ds = d.strftime("%Y-%m-%d")
        days.append({"date": ds, "tides": all_tides.get(ds, [])})
    save_json("data/tide_3day.json", {"generated": n.isoformat(), "days": days})
    print(f"[tide3day] {days[0]['date']}〜{days[-1]['date']} を保存しました。")
    return True


def fetch_stormglass_tides() -> list[dict] | None:
    """気象庁データ欠損時のフォールバック: Stormglass APIから3日分の潮汐を取得する。"""
    api_key = os.environ.get("STORMGLASS_API_KEY")
    if not api_key:
        print("[stormglass] STORMGLASS_API_KEY が未設定のためスキップします。", file=sys.stderr)
        return None

    lat, lon = TIDE_LAT, TIDE_LON
    n = now_jst()
    start = int(n.replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
    end = int((n.replace(hour=23, minute=59, second=59, microsecond=0) + timedelta(days=2)).timestamp())

    url = (
        f"https://api.stormglass.io/v2/tide/extremes/point"
        f"?lat={lat}&lng={lon}&start={start}&end={end}"
    )
    sg = http_get_json(url, headers={"Authorization": api_key}, timeout=20)
    if sg is None:
        return None
    print("[stormglass] フォールバック取得成功。")
    return sg.get("data", [])


def _normalize_stormglass_item(item: dict) -> dict:
    """Stormglassの極値1件をapp.js互換形式に正規化する。

    app.jsは ``time`` をISO日時として ``new Date()`` でパースし、
    ``type`` を ``"high"``/``"low"`` で判定する。
    """
    dt_utc = datetime.fromisoformat(item["time"].replace("Z", "+00:00"))
    dt_jst = dt_utc.astimezone(JST)
    return {
        "time": dt_jst.isoformat(timespec="seconds"),
        "height": item.get("height"),
        "type": "high" if item.get("type") == "high" else "low",
    }


def build_tide_widget(all_tides: dict | None, moon_result: dict | None) -> None:
    """tide_widget.json を生成する。気象庁データ欠損時はStormglassでフォールバック。"""
    n = now_jst()
    date_str = n.strftime("%Y-%m-%d")
    forecast: dict[str, list] = {}
    source = "気象庁"

    if all_tides:
        for delta in range(3):
            d = n + timedelta(days=delta)
            ds = d.strftime("%Y-%m-%d")
            forecast[ds] = all_tides.get(ds, [])
    else:
        sg_tides = fetch_stormglass_tides()
        if sg_tides:
            source = "Stormglass"
            for item in sg_tides:
                normalized = _normalize_stormglass_item(item)
                ds = normalized["time"][:10]
                forecast.setdefault(ds, []).append(normalized)

    today_tides = forecast.get(date_str, [])

    moon_entry: dict | None = None
    if moon_result:
        moon_entry = {"age": moon_result["age"], "phase": moon_result["phase"]}
    else:
        existing = load_json("data/moon_today.json")
        if existing:
            moon_entry = {"age": existing.get("age"), "phase": existing.get("phase")}

    result = {
        "updated_at": n.isoformat(),
        "source": source,
        "today": today_tides,
        "forecast": forecast,
        "moon": moon_entry,
    }
    save_json("data/tide_widget.json", result, indent=2)
    print(f"[tide_widget] 保存完了 (source={source}, today={len(today_tides)}件)")


if __name__ == "__main__":
    moon_result = extract_moon_today()
    tide_data = load_json("data/tidedata.json")

    if tide_data is not None:
        ok_tide = extract_tide_today(tide_data) and extract_tide_3day(tide_data)
    else:
        ok_tide = False

    build_tide_widget(tide_data, moon_result)

    if not moon_result or not ok_tide:
        sys.exit(1)
