"""気象庁の固定長テキストデータから1年分の潮汐JSONを生成する。"""

import sys
from datetime import datetime

from _common import http_get_bytes, load_site_config, save_json

# 観測所コードD8 = 江の島。フォーク時は _data/site.json の jma.tide_station を変更。
TIDE_STATION = load_site_config().get("jma", {}).get("tide_station", "D8")
JMA_TIDE_URL = "https://www.data.jma.go.jp/kaiyou/data/db/tide/suisan/txt/{year}/{station}.txt"


def _extract_extremes(data_str: str, type_name: str, date_key: str) -> list[dict]:
    """固定長フィールドから最大4件の極値を抽出する。"""
    extremes = []
    for i in range(4):
        chunk = data_str[i * 7:(i + 1) * 7]
        if not chunk.strip() or chunk.startswith("9999"):
            continue
        hh = chunk[0:2].strip()
        mm = chunk[2:4].strip()
        level_cm_str = chunk[4:7].strip()
        if not (hh and mm and level_cm_str) or level_cm_str == "999":
            continue
        try:
            level_m = int(level_cm_str) / 100.0
        except ValueError:
            continue
        extremes.append({
            "time": f"{date_key}T{hh.zfill(2)}:{mm.zfill(2)}:00+09:00",
            "type": type_name,
            "height": level_m,
        })
    return extremes


def parse_jma_tide_text(text_data: str) -> dict:
    """気象庁の潮汐固定長テキストをパースして {date: [extremes]} 辞書を返す。"""
    tide_dict: dict = {}
    for line in text_data.splitlines():
        if len(line) < 136:
            continue
        yy_str = line[72:74]
        mm_str = line[74:76]
        dd_str = line[76:78]
        try:
            full_year = 2000 + int(yy_str)
        except ValueError:
            continue
        date_key = f"{full_year}-{mm_str.strip().zfill(2)}-{dd_str.strip().zfill(2)}"
        # 仕様: 満潮 = 81〜108文字目 (index 80:108), 干潮 = 109〜136文字目 (index 108:136)
        high_tides = _extract_extremes(line[80:108], "high", date_key)
        low_tides = _extract_extremes(line[108:136], "low", date_key)
        daily = high_tides + low_tides
        daily.sort(key=lambda x: x["time"])
        tide_dict[date_key] = daily
    return tide_dict


def fetch_and_parse(year: int, station_code: str = TIDE_STATION) -> dict | None:
    """気象庁のサイトから1年分のテキストを取得してパースする。"""
    url = JMA_TIDE_URL.format(year=year, station=station_code)
    raw = http_get_bytes(url, timeout=30)
    if raw is None:
        return None
    try:
        text = raw.decode("shift_jis")
    except UnicodeDecodeError as e:
        print(f"[error] テキストのデコードに失敗: {e}", file=sys.stderr)
        return None
    return parse_jma_tide_text(text)


def main() -> None:
    target_year = datetime.now().year
    print(f"気象庁から {target_year} 年の潮汐データを取得中...")
    result = fetch_and_parse(target_year)
    if not result:
        print("データの取得・解析に失敗しました。", file=sys.stderr)
        sys.exit(1)
    save_json("data/tidedata.json", result, indent=2)
    print(f"正常に data/tidedata.json を生成しました（{len(result)}日分）。")


if __name__ == "__main__":
    main()
