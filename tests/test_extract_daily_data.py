"""extract_daily_data の単体テスト。"""

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import extract_daily_data
from extract_daily_data import _normalize_stormglass_item, extract_moon_today


class TestNormalizeStormglassItem(unittest.TestCase):
    """Stormglass形式 → app.js互換形式への正規化を検証する。"""

    def test_high(self):
        """'high' エントリが正しく正規化される。"""
        item = {"time": "2026-05-13T00:30:00+00:00", "height": 1.23, "type": "high"}
        out = _normalize_stormglass_item(item)
        # UTC 00:30 = JST 09:30
        self.assertTrue(out["time"].startswith("2026-05-13T09:30:00"))
        self.assertEqual(out["type"], "high")
        self.assertAlmostEqual(out["height"], 1.23)

    def test_low_with_z_suffix(self):
        """Zサフィックス形式のUTCも正しくパースされる。"""
        item = {"time": "2026-05-13T15:00:00Z", "height": 0.4, "type": "low"}
        out = _normalize_stormglass_item(item)
        # UTC 15:00 = JST 翌日 00:00
        self.assertTrue(out["time"].startswith("2026-05-14T00:00:00"))
        self.assertEqual(out["type"], "low")

    def test_unknown_type_falls_back_to_low(self):
        """typeが想定外でも 'low' にフォールバックする（app.jsで干潮側に分類される）。"""
        item = {"time": "2026-05-13T00:00:00Z", "height": 0.5, "type": "unknown"}
        out = _normalize_stormglass_item(item)
        self.assertEqual(out["type"], "low")


class TestExtractMoonToday(unittest.TestCase):
    """NASA月齢JSONの読み出しと、不正エントリ時のフォールバックを検証する。"""

    def _run(self, entry):
        """当日JST正午のエントリが entry になる年間配列を組み立てて実行する。"""
        n = extract_daily_data.now_jst()
        year_start = extract_daily_data.datetime(n.year, 1, 1, tzinfo=extract_daily_data.timezone.utc)
        target = extract_daily_data.datetime(n.year, n.month, n.day, 3, tzinfo=extract_daily_data.timezone.utc)
        idx = int((target - year_start).total_seconds() / 3600)
        moon_data = [{"age": 0.0, "phase": 0.0}] * (idx + 1)
        moon_data[idx] = entry
        with mock.patch.object(extract_daily_data, "load_json", return_value=moon_data), mock.patch.object(
            extract_daily_data, "save_json"
        ) as saver:
            return extract_moon_today(), saver

    def test_valid_entry(self):
        """正常なエントリは丸めて返され、保存される。"""
        result, saver = self._run({"age": 14.56789, "phase": 99.44})
        self.assertEqual(result["age"], 14.568)
        self.assertEqual(result["phase"], 99.4)
        saver.assert_called_once()

    def test_missing_age_returns_none(self):
        """ageキー欠落でも例外を投げずNoneを返す（潮汐生成を巻き添えにしない）。"""
        result, saver = self._run({"phase": 50.0})
        self.assertIsNone(result)
        saver.assert_not_called()

    def test_non_numeric_age_returns_none(self):
        """ageが非数値でも例外を投げずNoneを返す。"""
        result, saver = self._run({"age": "N/A", "phase": 50.0})
        self.assertIsNone(result)
        saver.assert_not_called()


if __name__ == "__main__":
    unittest.main()
