"""extract_daily_data の単体テスト。"""

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import extract_daily_data
from extract_daily_data import _normalize_stormglass_item, build_tide_widget, extract_moon_today


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


class TestBuildTideWidget(unittest.TestCase):
    """気象庁潮汐の当日欠落時にフォールバックへ抜けるかを検証する。"""

    def _build(self, all_tides, sg_tides=None):
        """save_json/Stormglass をモックして tide_widget の出力dictを返す。"""
        with mock.patch.object(extract_daily_data, "save_json") as saver, mock.patch.object(
            extract_daily_data, "load_json", return_value=None
        ), mock.patch.object(
            extract_daily_data, "fetch_stormglass_tides", return_value=sg_tides
        ) as sg:
            build_tide_widget(all_tides, {"age": 1.0, "phase": 2.0})
            return saver.call_args[0][1], sg

    def test_uses_jma_when_today_present(self):
        """当日分がある通常時は気象庁データをそのまま使う。"""
        today = extract_daily_data.now_jst().strftime("%Y-%m-%d")
        tides = [{"time": f"{today}T03:50:00+09:00", "type": "low", "height": 0.47}]
        result, sg = self._build({today: tides})
        self.assertEqual(result["source"], "気象庁")
        self.assertEqual(result["today"], tides)
        sg.assert_not_called()

    def test_falls_back_when_today_missing(self):
        """年跨ぎ等で当日キーが引けない場合はStormglassへフォールバックする。

        ここを素通しすると today/forecast が空のウィジェットになり、
        フロントが「取得失敗」表示になる（三原則1）。
        """
        result, sg = self._build(
            {"2000-01-01": [{"time": "2000-01-01T00:00:00+09:00", "type": "low", "height": 0.1}]},
            sg_tides=[{"time": "2026-05-13T00:30:00+00:00", "height": 1.23, "type": "high"}],
        )
        sg.assert_called_once()
        self.assertEqual(result["source"], "Stormglass")
        self.assertIn("2026-05-13", result["forecast"])

    def test_empty_tide_data_still_falls_back(self):
        """潮汐ファイル自体が空/欠損でも従来どおりフォールバックする。"""
        _, sg = self._build(None, sg_tides=None)
        sg.assert_called_once()


if __name__ == "__main__":
    unittest.main()
