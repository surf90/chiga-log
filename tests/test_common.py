"""_common.py の save_json (atomic) と require_keys の単体テスト。"""

import json
import os
import tempfile

import pytest

from _common import require_keys, save_json


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
