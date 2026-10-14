"""fetch_warning.py の取得失敗・仕様変更時の挙動テスト。"""

import json
from unittest import mock

import fetch_warning

FEED = {
    "reportDateTime": "2026/10/14 20:20",
    "itemArea4": [
        {"area": {"code": "1420700"}, "kind": [{"code": "15", "name": "強風注意報"}]},
        {"area": {"code": "1420100"}, "kind": [{"code": "03", "name": "大雨警報"}]},
    ],
}


def _run(tmp_path, monkeypatch, feed, existing=None):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    out = tmp_path / fetch_warning.OUTPUT_PATH
    if existing is not None:
        out.write_text(json.dumps(existing), encoding="utf-8")
    with mock.patch.object(fetch_warning, "http_get_json", return_value=feed):
        fetch_warning.main()
    return json.loads(out.read_text(encoding="utf-8")) if out.exists() else None


def test_extracts_only_chigasaki(tmp_path, monkeypatch):
    out = _run(tmp_path, monkeypatch, FEED)
    assert out["warnings"] == [{"code": "15", "name": "強風注意報"}]
    assert out["fetchedAt"]


def test_schema_change_keeps_existing_file(tmp_path, monkeypatch):
    existing = {"fetchedAt": "2026-10-14T20:00:00+09:00", "warnings": [{"code": "15", "name": "強風注意報"}]}
    out = _run(tmp_path, monkeypatch, {"reportDateTime": "x"}, existing=existing)
    assert out == existing


def test_failure_without_existing_is_marked_unconfirmed(tmp_path, monkeypatch):
    out = _run(tmp_path, monkeypatch, None)
    assert out["warnings"] == []
    # 空の fetchedAt はフロントで「未確認」扱いになり「警報なし」と断定しない
    assert out["fetchedAt"] == ""
