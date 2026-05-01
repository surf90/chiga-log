"""
GitHub Actionsから毎日 JST 0:05 に実行し、
当日分の月齢・潮汐データを小さなJSONとして出力するスクリプト。
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))


def load_json(filepath: str) -> dict | list | None:
    """JSONファイルを安全に読み込むヘルパー関数"""
    if not os.path.exists(filepath):
        print(f"[error] {filepath} が見つかりません。", file=sys.stderr)
        return None
    try:
        with open(filepath, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"[error] {filepath} の読み込みに失敗しました: {e}", file=sys.stderr)
        return None


def extract_moon_today() -> dict | None:
    """NASA SVSの年間JSONから当日JST正午の月齢エントリを抽出して返す。"""
    now_jst = datetime.now(JST)
    year = now_jst.year
    moon_file = f"data/mooninfo_{year}.json"

    moon_data = load_json(moon_file)
    if moon_data is None:
        return None

    target_utc = datetime(now_jst.year, now_jst.month, now_jst.day, 3, 0, 0, tzinfo=timezone.utc)
    year_start = datetime(year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    hour_index = int((target_utc - year_start).total_seconds() / 3600)

    if hour_index < 0 or hour_index >= len(moon_data):
        print(f"[moon] hourIndex={hour_index} が範囲外です。", file=sys.stderr)
        return None

    entry = moon_data[hour_index]
    result = {
        "date": now_jst.strftime("%Y-%m-%d"),
        "age": round(entry["age"], 3),
        "phase": round(entry["phase"], 1),
    }

    os.makedirs("data", exist_ok=True)
    with open("data/moon_today.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    print(f"[moon] {result['date']} age={result['age']} phase={result['phase']}")
    return result


def extract_tide_today(all_tides: dict) -> bool:
    """気象庁の年間潮汐JSONから当日のエントリを抽出する。"""
    date_str = datetime.now(JST).strftime("%Y-%m-%d")
    today_tides = all_tides.get(date_str, [])

    result = {
        "date": date_str,
        "tides": today_tides,
    }

    os.makedirs("data", exist_ok=True)
    with open("data/tide_today.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    print(f"[tide] {date_str} {len(today_tides)} エントリを保存しました。")
    return True


def extract_tide_3day(all_tides: dict) -> bool:
    """気象庁の年間潮汐JSONから本日〜翌々日のエントリを出力する。"""
    now_jst = datetime.now(JST)
    days = []

    for delta in range(3):
        d = now_jst + timedelta(days=delta)
        date_str = d.strftime("%Y-%m-%d")
        days.append({"date": date_str, "tides": all_tides.get(date_str, [])})

    result = {"generated": now_jst.isoformat(), "days": days}

    os.makedirs("data", exist_ok=True)
    with open("data/tide_3day.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    print(f"[tide3day] {days[0]['date']}〜{days[-1]['date']} を保存しました。")
    return True


def fetch_stormglass_tides() -> list[dict] | None:
    """気象庁データ欠損時のフォールバック: Stormglass APIから3日分の潮汐を取得する。"""
    api_key = os.environ.get("STORMGLASS_API_KEY")
    if not api_key:
        print("[stormglass] STORMGLASS_API_KEY が未設定のためスキップします。", file=sys.stderr)
        return None

    lat, lon = 35.318, 139.410
    jst_now = datetime.now(JST)
    start = int(jst_now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
    end   = int((jst_now.replace(hour=23, minute=59, second=59, microsecond=0) + timedelta(days=2)).timestamp())

    url = (
        f"https://api.stormglass.io/v2/tide/extremes/point"
        f"?lat={lat}&lng={lon}&start={start}&end={end}"
    )
    req = urllib.request.Request(url)
    req.add_header("Authorization", api_key)

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            sg = json.loads(resp.read().decode())
            print("[stormglass] フォールバック取得成功。")
            return sg.get("data", [])
    except urllib.error.URLError as e:
        code = getattr(e, "code", None)
        print(f"[stormglass] 取得失敗: {e} (HTTP {code})", file=sys.stderr)
        return None


def build_tide_widget(
    all_tides: dict | None,
    moon_result: dict | None,
) -> None:
    """tide_widget.json を生成する。気象庁データ欠損時はStormglassでフォールバック。"""
    now_jst = datetime.now(JST)
    date_str = now_jst.strftime("%Y-%m-%d")

    forecast: dict[str, list] = {}
    source = "気象庁"

    if all_tides:
        for delta in range(3):
            d = now_jst + timedelta(days=delta)
            ds = d.strftime("%Y-%m-%d")
            forecast[ds] = all_tides.get(ds, [])
    else:
        # 気象庁データ欠損 → Stormglassフォールバック
        sg_tides = fetch_stormglass_tides()
        if sg_tides:
            source = "Stormglass"
            for item in sg_tides:
                # Stormglass: {"time": "...", "height": ..., "type": "high"/"low"}
                dt_utc = datetime.fromisoformat(item["time"].replace("Z", "+00:00"))
                dt_jst = dt_utc.astimezone(JST)
                ds = dt_jst.strftime("%Y-%m-%d")
                forecast.setdefault(ds, []).append({
                    "time": dt_jst.strftime("%H:%M"),
                    "height": item.get("height"),
                    "type": "H" if item.get("type") == "high" else "L",
                })

    today_tides = forecast.get(date_str, [])

    # 月齢: moon_today.json から取得（なければNULL）
    moon_entry: dict | None = None
    if moon_result:
        moon_entry = {"age": moon_result["age"], "phase": moon_result["phase"]}
    else:
        existing = load_json("data/moon_today.json")
        if existing:
            moon_entry = {"age": existing.get("age"), "phase": existing.get("phase")}

    result = {
        "updated_at": now_jst.isoformat(),
        "source": source,
        "today": today_tides,
        "forecast": forecast,
        "moon": moon_entry,
    }

    os.makedirs("data", exist_ok=True)
    with open("data/tide_widget.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"[tide_widget] 保存完了 (source={source}, today={len(today_tides)}件)")


if __name__ == "__main__":
    moon_result = extract_moon_today()

    tide_data = load_json("data/tidedata.json")

    if tide_data is not None:
        ok_tide_today = extract_tide_today(tide_data)
        ok_tide_3day  = extract_tide_3day(tide_data)
        ok_tide = ok_tide_today and ok_tide_3day
    else:
        ok_tide = False

    build_tide_widget(tide_data, moon_result)

    if not moon_result or not ok_tide:
        sys.exit(1)
