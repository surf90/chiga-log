"""Open-MeteoとMarine API、JMAアメダスからデータを取得する。"""

from datetime import datetime, timedelta

from _common import http_get_json, http_get_text, load_json, load_site_config, now_jst, require_keys, save_json

_cfg = load_site_config()
_loc = _cfg.get("location", {})
LAT = _loc.get("lat", 35.3175)
LON = _loc.get("lon", 139.4151)
LOCATION_NAME = _loc.get("display_name", "茅ヶ崎ヘッドランド")

WEATHER_URL = (
    f"https://api.open-meteo.com/v1/forecast"
    f"?latitude={LAT}&longitude={LON}&current_weather=true"
    f"&timezone=Asia%2FTokyo&windspeed_unit=ms"
)
WIND_FORECAST_URL = (
    f"https://api.open-meteo.com/v1/forecast"
    f"?latitude={LAT}&longitude={LON}"
    f"&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m"
    f"&forecast_days=2&timezone=Asia%2FTokyo&windspeed_unit=ms"
)
# current(1点)だけだと Actions の発火が数時間遅れた際に「数時間前の波高」が
# そのまま表示され続ける。hourly 系列も併せて保存し、フロント側が
# 「現在時刻の行」を選べるようにする（ブラウザからの追加API取得を不要にする＝三原則3）。
_MARINE_BASE = (
    f"https://marine-api.open-meteo.com/v1/marine"
    f"?latitude={LAT}&longitude={LON}&current=wave_height,sea_surface_temperature"
    f"&timezone=Asia%2FTokyo"
)
MARINE_URL = _MARINE_BASE + "&hourly=wave_height,sea_surface_temperature&forecast_days=2"
# hourly 変数が仕様変更で弾かれた場合でも current だけは取得を続ける退避先。
MARINE_URL_CURRENT_ONLY = _MARINE_BASE
# Open-Meteo の time フィールドは timezone=Asia/Tokyo 指定時に JST だが
# 文字列には TZ オフセットが含まれない。フロントが new Date() で
# ブラウザTZ依存に解釈してしまうのを防ぐため、生成側で "+09:00" を付与する。
_JST_SUFFIX = "+09:00"


def _add_jst_tz(value):
    """JST想定のISO文字列にタイムゾーン表記が無い場合 +09:00 を付与する。"""
    if not isinstance(value, str) or not value:
        return value
    if value.endswith("Z") or "+" in value[10:] or value.count("-") >= 3:
        return value
    return value + _JST_SUFFIX

# 茅ヶ崎ヘッドランド最寄り官署: 辻堂 (46141)
JMA_AMEDAS_CODE = _cfg.get("jma", {}).get("amedas_code", "46141")
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
    """気象庁アメダス(辻堂)の最新観測値を取得する。

    ガイドライン遵守のため latest_time.txt を必ず参照してから map JSON を取得する。
    """
    # JMAは latest_time.txt 再生成中に一時的に404を返すため404もリトライ対象にする。
    latest = http_get_text(JMA_LATEST_TIME_URL, retry_on_404=True)
    if not latest:
        return None
    latest = latest.strip().lstrip("﻿")
    try:
        observed_dt = datetime.fromisoformat(latest)
    except ValueError as e:
        print(f"[error] latest_time parse: {e}")
        return None

    # map JSON のスロット生成タイミングずれ(404等)に備え、latest_time の
    # スロットで失敗した場合は1つ前の10分スロットでも再試行する。
    for slot_dt in (observed_dt, observed_dt - timedelta(minutes=10)):
        ymdhns = slot_dt.strftime("%Y%m%d%H%M%S")
        data = http_get_json(JMA_AMEDAS_MAP_URL.format(ymdhns=ymdhns), retry_on_404=True)
        if not data:
            continue
        point = data.get(JMA_AMEDAS_CODE)
        if not point:
            print(f"[error] amedas code {JMA_AMEDAS_CODE} not found")
            continue
        return {
            "observed_at": slot_dt.isoformat(),
            "amedas_code": JMA_AMEDAS_CODE,
            "temp": _qc_value(point.get("temp")),
            "wind": _qc_value(point.get("wind")),
            "windDirection": _qc_value(point.get("windDirection")),
            "humidity": _qc_value(point.get("humidity")),
            "precipitation1h": _qc_value(point.get("precipitation1h")),
        }
    return None


def _carry_forward_amedas(fresh: dict | None) -> dict | None:
    """アメダス取得失敗時に前回値を引き継ぐ。

    取得成功(fresh が非None)時はそのまま返す。失敗(None)時は既存の
    data/weather_marine.json から前回の jma_amedas を読み、stale 印を
    付けて返す(観測時刻 observed_at は実値を保持し誤読を防ぐ)。前回値も
    無ければ None。

    Args:
        fresh: 今回取得した jma_amedas 辞書。失敗時は None。

    Returns:
        引き継ぎ後の jma_amedas 辞書。利用可能な値が無ければ None。
    """
    if fresh is not None:
        return fresh
    prev = load_json("data/weather_marine.json")
    prev_amedas = prev.get("jma_amedas") if isinstance(prev, dict) else None
    if not isinstance(prev_amedas, dict):
        return None
    print("[warn] アメダス取得失敗。前回値を引き継ぎます。")
    return {**prev_amedas, "stale": True}


def _build_wind_items(hourly: dict) -> list[dict]:
    """Open-Meteoの時系列配列から風予報の整形済みアイテム配列を生成する。"""
    items = []
    times = hourly.get("time", [])
    speeds = hourly.get("wind_speed_10m") or []
    dirs = hourly.get("wind_direction_10m") or []
    gusts = hourly.get("wind_gusts_10m") or []
    for i, t in enumerate(times):
        items.append({
            "time": _add_jst_tz(t),
            "wind_speed_ms": speeds[i] if i < len(speeds) else None,
            "wind_direction_deg": dirs[i] if i < len(dirs) else None,
            "wind_gust_ms": gusts[i] if i < len(gusts) else None,
        })
    return items


def fetch_marine() -> dict | None:
    """Marine APIから現在値と時系列を取得する。

    hourly 付きURLで失敗した場合は current のみのURLで再試行する。
    hourly はフロントの鮮度対策のための追加情報であり、これが取れないことを
    理由に current まで落として更新を止めないための退避経路。
    """
    marine = http_get_json(MARINE_URL)
    if marine is not None:
        return marine
    print("[warn] marine(hourly付き)の取得に失敗。currentのみで再試行します。")
    return http_get_json(MARINE_URL_CURRENT_ONLY)


def _normalize_current_weather(cw: dict) -> dict:
    """current_weather オブジェクトの time に JST オフセットを付与する。"""
    if not isinstance(cw, dict):
        return cw
    out = dict(cw)
    if "time" in out:
        out["time"] = _add_jst_tz(out["time"])
    return out


def _normalize_marine(marine: dict) -> dict:
    """Marine API の current/hourly の time に JST オフセットを付与する。"""
    if not isinstance(marine, dict):
        return marine
    out = dict(marine)
    cur = out.get("current")
    if isinstance(cur, dict) and "time" in cur:
        cur = dict(cur)
        cur["time"] = _add_jst_tz(cur["time"])
        out["current"] = cur
    hourly = out.get("hourly")
    if isinstance(hourly, dict) and isinstance(hourly.get("time"), list):
        hourly = dict(hourly)
        hourly["time"] = [_add_jst_tz(t) for t in hourly["time"]]
        out["hourly"] = hourly
    return out


def main() -> None:
    """Open-Meteo + アメダスからデータを取得してJSONを生成する。"""
    print("Open-Meteo データの取得を開始します...")

    weather = http_get_json(WEATHER_URL)
    marine = fetch_marine()
    jma_amedas = _carry_forward_amedas(fetch_jma_amedas())
    wind_fc = http_get_json(WIND_FORECAST_URL)

    failed = [k for k, v in {"weather": weather, "marine": marine, "wind_fc": wind_fc}.items() if v is None]
    if failed:
        raise RuntimeError(f"必須データ取得失敗: {failed}")

    # スキーマ検証: 主要キーが揃っているか確認 (BFFやAPI仕様変更の早期検知)
    require_keys(weather, ["current_weather"], label="openmeteo.weather")
    require_keys(marine, ["current"], label="openmeteo.marine")
    require_keys(wind_fc, ["hourly"], label="openmeteo.wind_forecast")

    updated_at = now_jst().isoformat()

    save_json("data/weather_marine.json", {
        "updated_at": updated_at,
        "current_weather": _normalize_current_weather(weather.get("current_weather", {})),
        "marine": _normalize_marine(marine),
        "jma_amedas": jma_amedas,
    }, indent=2)
    print("保存完了: data/weather_marine.json")

    save_json("data/wind_forecast.json", {
        "source": "Open-Meteo",
        "location": {"name": LOCATION_NAME, "lat": LAT, "lon": LON},
        "updated_at": updated_at,
        "interval": "1h",
        "items": _build_wind_items(wind_fc.get("hourly", {})),
    }, indent=2)
    print("保存完了: data/wind_forecast.json")


if __name__ == "__main__":
    main()
