"""extract_daily_data の単体テスト。"""

import os
import sys
import unittest
from datetime import datetime
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
        moon_data = [{"age": 29.0, "phase": 0.0} for _ in range(idx + 1)]
        reset_idx = idx - 24
        moon_data[reset_idx - 1]["age"] = 29.5
        moon_data[reset_idx]["age"] = 0.0
        for i in range(reset_idx + 1, idx):
            moon_data[i]["age"] = (i - reset_idx) / 24
        moon_data[idx] = entry
        with mock.patch.object(extract_daily_data, "load_json", return_value=moon_data), mock.patch.object(
            extract_daily_data, "save_json"
        ) as saver:
            return extract_moon_today(), saver

    def test_valid_entry(self):
        """正常なエントリは丸めて返され、保存される。"""
        result, saver = self._run({
            "time": extract_daily_data.now_jst().strftime("%d %b %Y 03:00 UT"),
            "age": 14.56789,
            "phase": 99.44,
        })
        self.assertEqual(result["age"], 14.568)
        self.assertEqual(result["phase"], 99.4)
        saver.assert_called_once()

    def test_tide_type_uses_lunar_day_not_rounded_moon_age(self):
        """月齢11.4前後は若潮ではなく、陰暦12日相当の中潮になる。"""
        n = extract_daily_data.now_jst()
        year_start = extract_daily_data.datetime(n.year, 1, 1, tzinfo=extract_daily_data.timezone.utc)
        target = extract_daily_data.datetime(n.year, n.month, n.day, 3, tzinfo=extract_daily_data.timezone.utc)
        idx = int((target - year_start).total_seconds() / 3600)
        moon_data = [{"age": 29.0, "phase": 1.0}] * (idx + 1)
        reset_idx = idx - (11 * 24 + 9)
        moon_data[reset_idx - 1] = {"age": 29.5, "phase": 0.1}
        moon_data[reset_idx] = {"age": 0.01, "phase": 0.0}
        for i in range(reset_idx + 1, idx + 1):
            moon_data[i] = {"age": 0.01 + (i - reset_idx) / 24, "phase": 50.0}
        moon_data[idx]["time"] = target.strftime("%d %b %Y %H:%M UT")

        with mock.patch.object(extract_daily_data, "load_json", return_value=moon_data), mock.patch.object(
            extract_daily_data, "save_json"
        ):
            result = extract_moon_today()

        self.assertEqual(result["lunar_day"], 12)
        self.assertEqual(result["tide_type"], "中潮")

    def test_mismatched_nasa_timestamp_returns_none(self):
        """配列位置とNASAの時刻が不一致なら誤った日付として採用しない。"""
        result, saver = self._run({"time": "01 Jan 2000 00:00 UT", "age": 1.0, "phase": 2.0})
        self.assertIsNone(result)
        saver.assert_not_called()

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

    def test_non_finite_age_returns_none(self):
        """NaN月齢を受理して日付計算で例外にしない。"""
        result, saver = self._run({
            "time": extract_daily_data.now_jst().strftime("%d %b %Y 03:00 UT"),
            "age": float("nan"),
            "phase": 50.0,
        })
        self.assertIsNone(result)
        saver.assert_not_called()

    def test_non_list_moon_data_returns_none(self):
        """NASA元データが配列でなければ例外を投げず失敗扱いにする。"""
        n = extract_daily_data.now_jst()
        target = extract_daily_data.datetime(n.year, n.month, n.day, 3, tzinfo=extract_daily_data.timezone.utc)
        year_start = extract_daily_data.datetime(n.year, 1, 1, tzinfo=extract_daily_data.timezone.utc)
        idx = int((target - year_start).total_seconds() / 3600)
        invalid_data = {i: {"age": 1.0, "phase": 2.0} for i in range(idx + 1)}
        invalid_data[idx]["time"] = target.strftime("%d %b %Y %H:%M UT")
        with mock.patch.object(extract_daily_data, "load_json", return_value=invalid_data), mock.patch.object(
            extract_daily_data, "save_json"
        ) as saver:
            result = extract_moon_today()
        self.assertIsNone(result)
        saver.assert_not_called()

    def test_writes_tide_calendar_for_stale_data_fallback(self):
        """日次更新が遅れても翌日の潮回りをNASA値から参照できるようにする。"""
        n = extract_daily_data.now_jst()
        year_start = extract_daily_data.datetime(n.year, 1, 1, tzinfo=extract_daily_data.timezone.utc)
        target = extract_daily_data.datetime(n.year, n.month, n.day, 3, tzinfo=extract_daily_data.timezone.utc)
        idx = int((target - year_start).total_seconds() / 3600)
        moon_data = [{"age": 0.0, "phase": 0.0} for _ in range(idx + 25)]
        for delta, age in ((0, 12.391), (1, 13.391)):
            dt = target + extract_daily_data.timedelta(days=delta)
            moon_data[idx + delta * 24] = {
                "time": dt.strftime("%d %b %Y %H:%M UT"),
                "age": age,
                "phase": 80.0,
            }

        with mock.patch.object(extract_daily_data, "load_json", return_value=moon_data), mock.patch.object(
            extract_daily_data, "save_json"
        ):
            result = extract_moon_today()

        tomorrow = (n + extract_daily_data.timedelta(days=1)).strftime("%Y-%m-%d")
        self.assertEqual(result["tide_calendar"][tomorrow]["lunar_day"], 14)
        self.assertEqual(result["tide_calendar"][tomorrow]["tide_type"], "大潮")

    def test_new_moon_after_noon_is_lunar_day_one(self):
        """JST正午より後に朔が来る日も、その日全体を陰暦1日とする。"""
        n = extract_daily_data.now_jst()
        year_start = extract_daily_data.datetime(n.year, 1, 1, tzinfo=extract_daily_data.timezone.utc)
        target = extract_daily_data.datetime(n.year, n.month, n.day, 3, tzinfo=extract_daily_data.timezone.utc)
        idx = int((target - year_start).total_seconds() / 3600)
        moon_data = [{"age": 29.0, "phase": 0.0} for _ in range(idx + 13)]
        moon_data[idx] = {
            "time": target.strftime("%d %b %Y %H:%M UT"),
            "age": 29.3,
            "phase": 0.5,
        }
        for offset in range(1, 7):
            probe = target + extract_daily_data.timedelta(hours=offset)
            moon_data[idx + offset] = {
                "time": probe.strftime("%d %b %Y %H:%M UT"),
                "age": 29.3 + offset / 24,
                "phase": 0.1,
            }
        reset = target + extract_daily_data.timedelta(hours=7)
        moon_data[idx + 7] = {
            "time": reset.strftime("%d %b %Y %H:%M UT"),
            "age": 0.01,
            "phase": 0.0,
        }

        with mock.patch.object(extract_daily_data, "load_json", return_value=moon_data), mock.patch.object(
            extract_daily_data, "save_json"
        ):
            result = extract_moon_today()

        self.assertEqual(result["lunar_day"], 1)
        self.assertEqual(result["tide_type"], "大潮")

    def test_tide_calendar_crosses_year_when_next_file_exists(self):
        """年末の日次JSONにも翌年ぶんの潮回りを含める。"""
        n = datetime(2026, 12, 31, 0, 5, tzinfo=extract_daily_data.JST)
        current_target = datetime(2026, 12, 31, 3, tzinfo=extract_daily_data.timezone.utc)
        next_target = datetime(2027, 1, 1, 3, tzinfo=extract_daily_data.timezone.utc)
        current_index = 364 * 24 + 3
        current_data = [None] * (current_index + 1)
        current_data[current_index] = {
            "time": current_target.strftime("%d %b %Y %H:%M UT"),
            "age": 5.0,
            "phase": 30.0,
        }
        next_data = [None] * 4
        next_data[3] = {
            "time": next_target.strftime("%d %b %Y %H:%M UT"),
            "age": 6.0,
            "phase": 40.0,
        }

        def load_year(path):
            return next_data if "2027" in path else current_data

        with mock.patch.object(extract_daily_data, "now_jst", return_value=n), mock.patch.object(
            extract_daily_data, "load_json", side_effect=load_year
        ), mock.patch.object(extract_daily_data, "save_json"):
            result = extract_moon_today()

        self.assertIn("2027-01-01", result["tide_calendar"])


class TestTideTypeForLunarDay(unittest.TestCase):
    """陰暦日から潮回りへの境界を検証する。"""

    def test_standard_boundaries(self):
        """大潮・小潮・長潮・若潮の切替日が1日ずれない。"""
        expected = {
            2: "大潮",
            3: "中潮",
            7: "小潮",
            10: "長潮",
            11: "若潮",
            12: "中潮",
            14: "大潮",
            17: "大潮",
            18: "中潮",
            22: "小潮",
            25: "長潮",
            26: "若潮",
            27: "中潮",
            29: "大潮",
        }
        for lunar_day, tide_type in expected.items():
            with self.subTest(lunar_day=lunar_day):
                self.assertEqual(extract_daily_data.tide_type_for_lunar_day(lunar_day), tide_type)

    def test_january_can_use_previous_year_new_moon(self):
        """年初でも月齢から前年12月の朔日を復元できる。"""
        target_utc = datetime(2026, 1, 1, 3, 0, tzinfo=extract_daily_data.timezone.utc)
        n = target_utc.astimezone(extract_daily_data.JST)
        lunar_day = extract_daily_data._lunar_day_from_age(11.928, target_utc, n)
        self.assertEqual(lunar_day, 13)


class TestBuildTideWidget(unittest.TestCase):
    """気象庁潮汐の当日欠落時にフォールバックへ抜けるかを検証する。"""

    def _build(self, all_tides, sg_tides=None, existing_moon=None, moon_result=None):
        """save_json/Stormglass をモックして tide_widget の出力dictを返す。"""
        with mock.patch.object(extract_daily_data, "save_json") as saver, mock.patch.object(
            extract_daily_data, "load_json", return_value=existing_moon
        ), mock.patch.object(
            extract_daily_data, "fetch_stormglass_tides", return_value=sg_tides
        ) as sg:
            build_tide_widget(
                all_tides,
                moon_result if moon_result is not None else {"age": 1.0, "phase": 2.0},
            )
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

    def test_stale_existing_moon_is_not_reused(self):
        """当日抽出失敗時に前日以前の月齢を潮汐JSONへ混入させない。"""
        today = extract_daily_data.now_jst().strftime("%Y-%m-%d")
        tides = [{"time": f"{today}T03:50:00+09:00", "type": "low", "height": 0.47}]
        result, _ = self._build(
            {today: tides},
            existing_moon={"date": "2000-01-01", "age": 10.0, "phase": 50.0},
            moon_result={},
        )
        self.assertIsNone(result["moon"])


class TestWarnIfNextYearMoonMissing(unittest.TestCase):
    """翌年ぶん月齢データの未配置警告を検証する。"""

    def _run(self, month, exists):
        fake_now = datetime(2026, month, 15, 0, 5, tzinfo=extract_daily_data.JST)
        with mock.patch.object(
            extract_daily_data, "now_jst", return_value=fake_now
        ), mock.patch.object(extract_daily_data.os.path, "exists", return_value=exists):
            return extract_daily_data.warn_if_next_year_moon_missing()

    def test_warns_in_december_when_missing(self):
        """12月に翌年ファイルが無ければ警告する。"""
        self.assertTrue(self._run(12, exists=False))

    def test_silent_in_december_when_present(self):
        """12月でも翌年ファイルがあれば警告しない。"""
        self.assertFalse(self._run(12, exists=True))

    def test_silent_outside_december(self):
        """12月以外は（未配置でも）警告しない。"""
        self.assertFalse(self._run(8, exists=False))


if __name__ == "__main__":
    unittest.main()
