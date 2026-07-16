from datetime import datetime
from zoneinfo import ZoneInfo

from fetch_heatstroke_alert import candidate_urls, parse_alert_csv


def sample_csv(today_flag="1", tomorrow_flag="3"):
    return f"""Title,熱中症特別警戒情報・熱中症警戒情報,,,,,,,,,
ReportDate,2026/07/16,,,,,,,,,
ReportTime,14:00:00,,,,,,,,,
TargetDate1,2026/07/16,,,,,,,,,
TargetDate2,2026/07/17,,,,,,,,,
府県予報区,都府県・振興局表示番号,都府県・振興局表示番号サブ,府県予報区等コード,都道府県名,都道府県コード,TargetDate1フラグ,TargetDate2フラグ,日最高WBGT（10:00）,日最高WBGT（17:00）,日最高WBGT（5:00）
東京都,44,0,130000,東京,13,0,0,,,
神奈川県,46,0,140000,神奈川,14,{today_flag},{tomorrow_flag},海老名:34,,
"""


def test_parse_alert_csv_extracts_only_formal_alerts():
    data = parse_alert_csv(sample_csv(), "https://example.test/alert.csv")
    assert data["alerts"] == [
        {
            "date": "2026-07-16",
            "level": "warning",
            "publishedAt": "2026-07-16T05:00:00+09:00",
        },
        {
            "date": "2026-07-17",
            "level": "special",
            "publishedAt": "2026-07-16T14:00:00+09:00",
        },
    ]


def test_parse_alert_csv_ignores_preliminary_special_judgement():
    data = parse_alert_csv(sample_csv(today_flag="0", tomorrow_flag="2"), "source")
    assert data["alerts"] == []


def test_candidate_urls_uses_previous_day_before_five_am():
    now = datetime(2026, 7, 17, 0, 30, tzinfo=ZoneInfo("Asia/Tokyo"))
    urls = candidate_urls(now)
    assert urls[0].endswith("/2026/alert_20260716_17.csv")


def test_candidate_urls_prefetches_csv_during_thirty_minute_lead():
    now = datetime(2026, 7, 16, 13, 35, tzinfo=ZoneInfo("Asia/Tokyo"))
    urls = candidate_urls(now)
    assert urls[0].endswith("/2026/alert_20260716_14.csv")
