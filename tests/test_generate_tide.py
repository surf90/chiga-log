"""generate_tide.parse_jma_tide_text の単体テスト。"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from generate_tide import _extract_extremes, parse_jma_tide_text


class TestExtractExtremes(unittest.TestCase):
    """_extract_extremes の挙動を検証する。"""

    def test_basic(self):
        """4組の(HHMM+潮位cm)から正しく極値が抽出される。"""
        # 7文字 x 4 = 28文字。 例: 0530142 (05:30, 142cm)
        data_str = "0530142" + "1145032" + "1715150" + "2330040"
        result = _extract_extremes(data_str, "high", "2026-01-15")
        self.assertEqual(len(result), 4)
        self.assertEqual(result[0], {
            "time": "2026-01-15T05:30:00+09:00",
            "type": "high",
            "height": 1.42,
        })
        self.assertAlmostEqual(result[3]["height"], 0.40)

    def test_skips_missing(self):
        """欠測（9999開始）と空白チャンクはスキップされる。"""
        data_str = "0530142" + "9999000" + "       " + "2330040"
        result = _extract_extremes(data_str, "low", "2026-01-15")
        self.assertEqual(len(result), 2)
        self.assertTrue(result[0]["time"].endswith("T05:30:00+09:00"))
        self.assertAlmostEqual(result[1]["height"], 0.40)

    def test_skips_999_level(self):
        """潮位999（データなしマーカー）はスキップ。"""
        data_str = "0530999" + "1145032" + "       " + "       "
        result = _extract_extremes(data_str, "high", "2026-01-15")
        self.assertEqual(len(result), 1)
        self.assertAlmostEqual(result[0]["height"], 0.32)


class TestParseJmaTideText(unittest.TestCase):
    """parse_jma_tide_text のラインパース挙動を検証する。"""

    def test_short_line_skipped(self):
        """136文字未満の行はスキップされる。"""
        short_line = "abc" * 10
        self.assertEqual(parse_jma_tide_text(short_line), {})

    def test_full_line(self):
        """仕様通りの1行を構築してパースが成立することを確認。"""
        # 0-71: 任意の72文字、72-78: 年月日(YYMMDD)、78-80: ?, 80-108: 高潮28文字, 108-136: 低潮28文字
        head = "X" * 72
        date_part = "260115"  # 2026-01-15
        gap = "??"  # 78-80
        high = "0530142" + "1715150" + "       " + "       "  # 28文字
        low = "1145032" + "2330040" + "       " + "       "
        line = head + date_part + gap + high + low
        self.assertGreaterEqual(len(line), 136)
        parsed = parse_jma_tide_text(line)
        self.assertIn("2026-01-15", parsed)
        day = parsed["2026-01-15"]
        self.assertEqual(len(day), 4)
        # 時刻順にソートされているはず
        self.assertEqual([e["time"][11:16] for e in day], ["05:30", "11:45", "17:15", "23:30"])
        types = [e["type"] for e in day]
        self.assertEqual(types.count("high"), 2)
        self.assertEqual(types.count("low"), 2)


if __name__ == "__main__":
    unittest.main()
