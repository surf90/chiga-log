"""_common.py の save_json (atomic) と require_keys の単体テスト。"""

import json
import os
import tempfile

import pytest

import _common
from _common import http_get_json, http_get_text, require_keys, save_json


def test_save_json_writes_file_and_no_tempfile_leftover(tmp_path):
    """正常系: 指定パスに JSON が書き込まれ、一時ファイルは残らない。"""
    target = tmp_path / "out.json"
    save_json(str(target), {"a": 1, "b": "あ"})
    assert target.exists()
    assert json.loads(target.read_text(encoding="utf-8")) == {"a": 1, "b": "あ"}
    # 同ディレクトリに .tmp_ プレフィックスの残骸が無いこと
    leftovers = [p for p in tmp_path.iterdir() if p.name.startswith(".tmp_")]
    assert leftovers == []


def test_save_json_atomic_does_not_overwrite_on_serialization_error(tmp_path):
    """異常系: serialize 不可能なオブジェクトを渡したとき、
    既存ファイルが破壊されないこと。"""
    target = tmp_path / "out.json"
    target.write_text('{"keep": true}', encoding="utf-8")
    with pytest.raises(TypeError):
        save_json(str(target), {"bad": object()})
    # 既存内容は維持される
    assert json.loads(target.read_text(encoding="utf-8")) == {"keep": True}
    # 失敗時の一時ファイルも残らない
    leftovers = [p for p in tmp_path.iterdir() if p.name.startswith(".tmp_")]
    assert leftovers == []


def test_require_keys_passes_when_all_keys_present():
    require_keys({"a": 1, "b": 2}, ["a", "b"], label="test")


def test_require_keys_raises_on_missing_key():
    with pytest.raises(ValueError) as ei:
        require_keys({"a": 1}, ["a", "b"], label="test")
    assert "b" in str(ei.value)
    assert "test" in str(ei.value)


def test_require_keys_raises_on_non_dict():
    with pytest.raises(ValueError):
        require_keys([1, 2, 3], ["a"], label="test")


def test_require_keys_default_label():
    with pytest.raises(ValueError) as ei:
        require_keys({}, ["x"])
    assert "data" in str(ei.value)


# ─── retry_on_404 透過 ─────────────────────────────────────────
def test_http_get_text_passes_retry_on_404(monkeypatch):
    """http_get_text が retry_on_404 を http_get_bytes へ透過すること。"""
    captured = {}

    def fake_bytes(url, *, headers=None, timeout=None, retry_on_404=False):
        captured["retry_on_404"] = retry_on_404
        return b"ok"

    monkeypatch.setattr(_common, "http_get_bytes", fake_bytes)
    assert http_get_text("http://x", retry_on_404=True) == "ok"
    assert captured["retry_on_404"] is True


def test_http_get_text_defaults_retry_on_404_false(monkeypatch):
    captured = {}

    def fake_bytes(url, *, headers=None, timeout=None, retry_on_404=False):
        captured["retry_on_404"] = retry_on_404
        return b"ok"

    monkeypatch.setattr(_common, "http_get_bytes", fake_bytes)
    http_get_text("http://x")
    assert captured["retry_on_404"] is False


def test_http_get_json_passes_retry_on_404(monkeypatch):
    """http_get_json が retry_on_404 を http_get_text 経由で透過すること。"""
    captured = {}

    def fake_text(url, *, encoding="utf-8", headers=None, timeout=None, retry_on_404=False):
        captured["retry_on_404"] = retry_on_404
        return '{"a": 1}'

    monkeypatch.setattr(_common, "http_get_text", fake_text)
    assert http_get_json("http://x", retry_on_404=True) == {"a": 1}
    assert captured["retry_on_404"] is True
