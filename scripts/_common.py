"""共通ユーティリティ: HTTP取得、JSON入出力、JST日時。

GitHub Actionsから実行される各データ取得スクリプトで共有する。
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

JST = timezone(timedelta(hours=9), "JST")
USER_AGENT = "Mozilla/5.0 (ChigaLog/1.0)"
DEFAULT_TIMEOUT = 15


def http_get_bytes(url: str, *, headers: dict[str, str] | None = None, timeout: int = DEFAULT_TIMEOUT) -> bytes | None:
    """URLからバイト列を取得する。失敗時はNone。"""
    h = {"User-Agent": USER_AGENT}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except urllib.error.URLError as e:
        code = getattr(e, "code", None)
        print(f"[http] {url}: {e} (HTTP {code})", file=sys.stderr)
        return None
    except Exception as e:
        print(f"[http] {url}: {e}", file=sys.stderr)
        return None


def http_get_text(url: str, *, encoding: str = "utf-8", headers: dict[str, str] | None = None, timeout: int = DEFAULT_TIMEOUT) -> str | None:
    """URLからテキストデータを取得する。"""
    raw = http_get_bytes(url, headers=headers, timeout=timeout)
    if raw is None:
        return None
    return raw.decode(encoding)


def http_get_json(url: str, *, headers: dict[str, str] | None = None, timeout: int = DEFAULT_TIMEOUT) -> dict | list | None:
    """URLからJSONデータを取得する。"""
    text = http_get_text(url, headers=headers, timeout=timeout)
    if text is None:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"[http] JSON decode failed for {url}: {e}", file=sys.stderr)
        return None


def load_json(filepath: str) -> dict | list | None:
    """ローカルJSONファイルを安全に読み込む。"""
    if not os.path.exists(filepath):
        print(f"[error] {filepath} が見つかりません。", file=sys.stderr)
        return None
    try:
        with open(filepath, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"[error] {filepath} の読み込みに失敗しました: {e}", file=sys.stderr)
        return None


def save_json(filepath: str, data, *, indent: int | None = None) -> None:
    """JSONファイルとして保存する。親ディレクトリは自動作成。"""
    os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)


def now_jst() -> datetime:
    """JSTの現在日時を返す。"""
    return datetime.now(JST)
