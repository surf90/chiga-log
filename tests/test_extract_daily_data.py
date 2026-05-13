"""extract_daily_data の単体テスト。"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from extract_daily_data import _normalize_stormglass_item


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


if __name__ == "__main__":
    unittest.main()
