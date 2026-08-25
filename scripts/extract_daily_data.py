"""毎日 JST 0:05 に実行し、当日分の月齢・潮汐データを小さなJSONとして出力する。"""

import math
import os
import sys
from datetime import datetime, timedelta, timezone

from _common import JST, http_get_json, load_json, load_site_config, now_jst, save_json

_loc = load_site_config().get("location", {})
# 潮汐フォールバック(Stormglass)用座標。表示基準とは別値（現状維持）。
TIDE_LAT = _loc.get("tide_lat", 35.318)
TIDE_LON = _loc.get("tide_lon", 139.410)
MOON_CALENDAR_DAYS = 35


def tide_type_for_lunar_day(lunar_day: int) -> str:
    """陰暦日を一般的な潮回り（大潮〜若潮）へ変換する。"""
    if lunar_day in (1, 2, 14, 15, 16, 17, 29, 30):
        return "大潮"
    if lunar_day in (*range(3, 7), 12, 13, *range(18, 22), 27, 28):
        return "中潮"
    if lunar_day in (*range(7, 10), *range(22, 25)):
        return "小潮"
    if lunar_day in (10, 25):
        return "長潮"
    if lunar_day in (11, 26):
        return "若潮"
    return "不明"


def _lunar_day_from_age(age: float, target_utc: datetime, n: datetime) -> int | None:
    """NASA月齢から直前の朔を戻し、JST基準の陰暦日を求める。"""
    if not isinstance(age, (int, float)) or isinstance(age, bool) or not math.isfinite(age):
        return None
    reset_date_jst = (target_utc - timedelta(days=age)).astimezone(JST).date()
    lunar_day = (n.date() - reset_date_jst).days + 1
    return lunar_day if 1 <= lunar_day <= 30 else None


def _extract_moon_for_date(
    moon_data: object, n: datetime, *, log_errors: bool = True
) -> dict | None:
    """NASA年間配列から指定JST日の正午エントリを検証して抽出する。"""
    if not isinstance(moon_data, list):
        if log_errors:
            print("[moon] 年間データが配列ではありません。", file=sys.stderr)
        return None

    target_utc = datetime(n.year, n.month, n.day, 3, 0, 0, tzinfo=timezone.utc)
    year_start = datetime(n.year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    hour_index = int((target_utc - year_start).total_seconds() / 3600)
    if hour_index < 0 or hour_index >= len(moon_data):
        if log_errors:
            print(f"[moon] hourIndex={hour_index} が範囲外です。", file=sys.stderr)
        return None

    entry = moon_data[hour_index]
    if not isinstance(entry, dict):
        if log_errors:
            print(f"[moon] hourIndex={hour_index} のエントリが辞書ではありません。", file=sys.stderr)
        return None

    age = entry.get("age")
    phase = entry.get("phase")
    values_are_valid = all(
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
        for value in (age, phase)
    )
    if not values_are_valid or not (0 <= age < 30) or not (0 <= phase <= 100):
        if log_errors:
            print(f"[moon] hourIndex={hour_index} の数値が不正です。", file=sys.stderr)
        return None

    expected_time = target_utc.strftime("%d %b %Y %H:%M UT")
    if entry.get("time") != expected_time:
        if log_errors:
            actual_time = str(entry.get("time"))[:80]
            print(
                f"[moon] hourIndex={hour_index} の時刻が不一致です "
                f"(expected={expected_time}, actual={actual_time})。",
                file=sys.stderr,
            )
        return None

    lunar_day = _lunar_day_from_age(age, target_utc, n)
    if lunar_day is None:
        if log_errors:
            print(f"[moon] hourIndex={hour_index} から陰暦日を算出できません。", file=sys.stderr)
        return None

    # 朔がJST正午より後でも、陰暦ではその日の0時から1日。正午月齢だけを
    # 戻すと前月30日になるため、当日末までの月齢リセットも確認する。
    day_end_utc = (
        datetime(n.year, n.month, n.day, tzinfo=JST) + timedelta(days=1)
    ).astimezone(timezone.utc)
    previous_age = age
    probe_utc = target_utc + timedelta(hours=1)
    probe_index = hour_index + 1
    while probe_utc < day_end_utc and probe_index < len(moon_data):
        probe_entry = moon_data[probe_index]
        if not isinstance(probe_entry, dict):
            break
        probe_age = probe_entry.get("age")
        if (
            not isinstance(probe_age, (int, float))
            or isinstance(probe_age, bool)
            or not math.isfinite(probe_age)
            or probe_entry.get("time")
            != probe_utc.strftime("%d %b %Y %H:%M UT")
        ):
            break
        if probe_age < previous_age:
            lunar_day = 1
            break
        previous_age = probe_age
        probe_utc += timedelta(hours=1)
        probe_index += 1

    return {
        "date": n.strftime("%Y-%m-%d"),
        "age": round(age, 3),
        "phase": round(phase, 1),
        "lunar_day": lunar_day,
        "tide_type": tide_type_for_lunar_day(lunar_day),
    }


def warn_if_next_year_moon_missing() -> bool:
    """12月に入っても翌年の月齢元データが未配置なら警告を出す。

    ``mooninfo_YYYY.json`` は NASA SVS からの手動取得（README参照）。配置を
    忘れると 1/1 以降このジョブが失敗し、フロントは月齢を "計算値"
    フォールバックへ落とす。年明けに気付くのでは遅いため、cron を増やさず
    既存の日次ジョブから 12 月中の未配置をアノテーションとして通知する。

    :returns: 警告を出したら True
    """
    n = now_jst()
    if n.month != 12:
        return False
    next_file = f"data/mooninfo_{n.year + 1}.json"
    if os.path.exists(next_file):
        return False
    print(
        f"::warning::{next_file} が未配置です。"
        f"{n.year + 1}/1/1 以降、月齢が計算値フォールバックになります。"
        "README『月齢データの年間更新手順』に従い NASA SVS から取得してください。"
    )
    return True


def extract_moon_today() -> dict | None:
    """NASA SVSの年間JSONから当日JST正午の月齢エントリを抽出して返す。"""
    n = now_jst()
    data_by_year: dict[int, object] = {}

    def moon_data_for_year(year: int) -> object:
        if year not in data_by_year:
            data_by_year[year] = load_json(f"data/mooninfo_{year}.json")
        return data_by_year[year]

    result = _extract_moon_for_date(moon_data_for_year(n.year), n)
    if result is None:
        return None

    # 日次Actionsの遅延・一時停止中も潮回りだけはNASA由来で保てるよう、
    # 当日から1朔望月を超える日数を小さな日付辞書として同梱する。
    tide_calendar = {}
    for delta in range(MOON_CALENDAR_DAYS):
        day = n + timedelta(days=delta)
        day_result = _extract_moon_for_date(
            moon_data_for_year(day.year), day, log_errors=False
        )
        if day_result:
            tide_calendar[day_result["date"]] = {
                "lunar_day": day_result["lunar_day"],
                "tide_type": day_result["tide_type"],
            }
    result["tide_calendar"] = tide_calendar
    save_json("data/moon_daily.json", result)
    print(f"[moon] {result['date']} age={result['age']} phase={result['phase']}")
    return result


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

    # 「ファイルがある」ではなく「当日分の極値がある」で判定する。
    # tide_data.json は年単位のため、年明け直後は前年ぶんしか無く
    # all_tides は真だが当日キーが引けない。ここを素通しすると
    # today/forecast が空のウィジェットを出力し、フロントが
    # 「潮汐データの取得に失敗しました」になる（三原則1に反する空表示）。
    if all_tides and all_tides.get(date_str):
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
        moon_entry = {
            key: moon_result[key]
            for key in ("date", "age", "phase", "lunar_day", "tide_type")
            if key in moon_result
        }
    else:
        existing = load_json("data/moon_daily.json")
        if isinstance(existing, dict) and existing.get("date") == date_str:
            moon_entry = {
                key: existing[key]
                for key in ("date", "age", "phase", "lunar_day", "tide_type")
                if key in existing
            }

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
    warn_if_next_year_moon_missing()
    moon_result = extract_moon_today()
    tide_data = load_json("data/tide_data.json")
    # 当日キーが引けるかまで見る。年跨ぎで前年ぶんしか無い状態を
    # 「取得成功」と報告すると、フォールバックしたことに気付けない。
    ok_tide = isinstance(tide_data, dict) and bool(
        tide_data.get(now_jst().strftime("%Y-%m-%d"))
    )

    build_tide_widget(tide_data, moon_result)

    if not moon_result or not ok_tide:
        sys.exit(1)
