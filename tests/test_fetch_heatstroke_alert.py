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


def test_in_season_covers_operation_period_with_margin():
    from fetch_heatstroke_alert import in_season

    jst = ZoneInfo("Asia/Tokyo")
    assert in_season(datetime(2026, 4, 22, 5, tzinfo=jst))
    assert in_season(datetime(2026, 10, 21, 17, tzinfo=jst))
    assert in_season(datetime(2026, 10, 31, 23, tzinfo=jst))
    assert not in_season(datetime(2026, 11, 1, 0, tzinfo=jst))
    assert not in_season(datetime(2027, 1, 15, 12, tzinfo=jst))
    assert not in_season(datetime(2027, 4, 14, 12, tzinfo=jst))


def test_in_season_covers_any_year_without_edit():
    """固定範囲が、どの年の「4月第4水曜」開始・10月下旬終了も含むこと。"""
    from datetime import date, timedelta

    from fetch_heatstroke_alert import in_season

    jst = ZoneInfo("Asia/Tokyo")
    for year in range(2026, 2040):
        first = date(year, 4, 1)
        start = first + timedelta(days=(2 - first.weekday()) % 7 + 21)
        assert in_season(datetime(year, start.month, start.day, 5, tzinfo=jst))
        assert in_season(datetime(year, 10, 28, 17, tzinfo=jst))
