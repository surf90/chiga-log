"""気象庁波浪ガイダンス（area=20）CSVを取得してJSONに保存する。"""

import csv
import io
import os
from datetime import datetime

from _common import JST, http_get_bytes, load_site_config, now_jst, save_json

# 注: 気象庁サイト側の不具合により wave_guid.html?area=19 がエリア20（関東地方南部）のデータを配信している。
# 正しいエリアコードは20のため、CSVは wave_guid_20.csv を使用する。
# フォーク時は _data/site.json の jma.wave_guid_area を変更（URL・出力名・areaフィールドに伝播）。
WAVE_AREA = str(load_site_config().get("jma", {}).get("wave_guid_area", "20"))
URL = f"https://www.data.jma.go.jp/waveinf/data/Guid/csv/wave_guid_{WAVE_AREA}.csv"


def fetch_csv(url: str) -> str | None:
    """CSVデータをURLから取得してデコードする。"""
    raw = http_get_bytes(url, retry_on_404=True)
    if raw is None:
        return None
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("shift_jis")


def parse_csv(csv_text: str) -> list[dict]:
    """CSVを解析して時刻・周期・波高のリストを返す。"""
    reader = csv.reader(io.StringIO(csv_text))
    next(reader, None)
    result = []
    for row in reader:
        if len(row) < 7:
            continue
        _, year, month, day, hour, period, wave_height = row[:7]
        try:
            dt = datetime(int(year), int(month), int(day), int(hour), tzinfo=JST)
            result.append({
                "time": dt.isoformat(),
                "period": float(period),
                "wave_height": float(wave_height),
            })
        except (ValueError, IndexError):
            continue
    return result


def main() -> None:
    print(f"気象庁 波浪ガイダンス（area={WAVE_AREA}）の取得を開始します...")
    csv_text = fetch_csv(URL)
    if csv_text is None:
        raise RuntimeError("波浪CSVの取得に失敗しました。")
    data = parse_csv(csv_text)
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_path = os.path.join(repo_root, "data", f"wave_guid_{WAVE_AREA}.json")
    save_json(output_path, {
        "updated_at": now_jst().isoformat(),
        "area": int(WAVE_AREA) if WAVE_AREA.isdigit() else WAVE_AREA,
        "data": data,
    }, indent=2)
    print(f"保存完了: {output_path}（{len(data)}件）")


if __name__ == "__main__":
    main()
