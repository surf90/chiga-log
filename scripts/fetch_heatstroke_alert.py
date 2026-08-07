"""環境省の公式CSVから神奈川県の熱中症警戒情報を取得する。"""

import csv
import io
from datetime import datetime, timedelta

from _common import http_get_text, now_jst, save_json

PREFECTURE_CODE = "14"
OUTPUT_PATH = "data/heatstroke_alert.json"
BASE_URL = "https://www.wbgt.env.go.jp/alert/dl"
SCHEDULE_HOURS = (5, 10, 14, 17)
HEADER_MARKER = "府県予報区"


def candidate_urls(now: datetime) -> list[str]:
    """新しい順に、発表30分前を迎えたCSVのURLを返す。"""
    candidates = []
    for offset in (0, -1):
        day = (now + timedelta(days=offset)).date()
        for hour in SCHEDULE_HOURS:
            scheduled = datetime.combine(day, datetime.min.time(), tzinfo=now.tzinfo).replace(hour=hour)
            # 公式CSVは発表時刻のおよそ30分前に生成される。先に取得しておき、
            # 表示開始はpublishedAtで制御してActionsの遅延を吸収する。
            if scheduled <= now + timedelta(minutes=30):
                name = f"alert_{day:%Y%m%d}_{hour:02d}.csv"
                candidates.append((scheduled, f"{BASE_URL}/{day:%Y}/{name}"))
    return [url for _, url in sorted(candidates, reverse=True)]


def parse_alert_csv(text: str, source: str) -> dict:
    """公式CSVを表示用の小さなJSON構造へ変換する。"""
    rows = list(csv.reader(io.StringIO(text.lstrip("\ufeff"))))
    header_index = next((i for i, row in enumerate(rows) if row and row[0] == HEADER_MARKER), None)
    if header_index is None:
        raise ValueError("熱中症情報CSVのヘッダーが見つかりません")

    metadata = {row[0]: row[1] for row in rows[:header_index] if len(row) >= 2 and row[0]}
    headers = rows[header_index]
    data_rows = (dict(zip(headers, row)) for row in rows[header_index + 1 :])
    area = next((row for row in data_rows if row.get("都道府県コード") == PREFECTURE_CODE), None)
    if area is None:
        raise ValueError("神奈川県の行が見つかりません")

    report_date = metadata.get("ReportDate", "").replace("/", "-")
    report_time = metadata.get("ReportTime", "")
    alerts = []
    for suffix in ("1", "2"):
        flag = area.get(f"TargetDate{suffix}フラグ", "")
        if flag not in {"1", "3"}:
            continue
        target_date = metadata.get(f"TargetDate{suffix}", "").replace("/", "-")
        level = "special" if flag == "3" else "warning"
        if level == "special":
            published_day = datetime.fromisoformat(target_date).date() - timedelta(days=1)
            published_at = f"{published_day.isoformat()}T14:00:00+09:00"
        elif target_date == report_date:
            published_at = f"{target_date}T05:00:00+09:00"
        else:
            published_at = f"{report_date}T17:00:00+09:00"
        alerts.append({"date": target_date, "level": level, "publishedAt": published_at})

    return {
        "fetchedAt": now_jst().isoformat(timespec="seconds"),
        "reportDateTime": f"{report_date}T{report_time}+09:00" if report_date and report_time else "",
        "source": source,
        "area": "神奈川県",
        "prefectureCode": PREFECTURE_CODE,
        "alerts": alerts,
    }


def main() -> None:
    """CSVを取得し書き出す。取得失敗時は既存ファイルを保持する。"""
    now = now_jst()
    for url in candidate_urls(now):
        text = http_get_text(url)
        if text is None:
            continue
        try:
            output = parse_alert_csv(text, url)
        except ValueError as exc:
            print(f"[heatstroke] {url}: {exc}")
            continue
        save_json(OUTPUT_PATH, output, indent=2)
        print(f"[heatstroke] {len(output['alerts'])}件: {output['alerts']}")
        return
    print("[heatstroke] 取得失敗。既存ファイルを保持します。")


if __name__ == "__main__":
    main()
