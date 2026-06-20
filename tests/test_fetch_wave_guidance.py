"""fetch_wave_guidance.py の parse_csv の単体テスト。"""

from fetch_wave_guidance import parse_csv


def test_parse_csv_skips_header_and_parses_rows():
    csv_text = (
        "header,year,month,day,hour,period,wave_height\n"
        "X,2026,6,5,3,11.2,1.3\n"
        "X,2026,6,5,6,11.2,1.2\n"
    )
    rows = parse_csv(csv_text)
    assert len(rows) == 2
    assert rows[0]["time"].startswith("2026-06-05T03:00:00+09:00")
    assert rows[0]["period"] == 11.2
    assert rows[0]["wave_height"] == 1.3


def test_parse_csv_drops_short_rows():
    csv_text = "h\nX,2026,6,5,3,11.2\n"
    assert parse_csv(csv_text) == []


def test_parse_csv_drops_invalid_numbers():
    csv_text = (
        "h\n"
        "X,abc,6,5,3,11.2,1.3\n"
        "X,2026,6,5,6,11.2,1.2\n"
    )
    rows = parse_csv(csv_text)
    assert len(rows) == 1
    assert rows[0]["wave_height"] == 1.2
