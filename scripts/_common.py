"""共通ユーティリティ: HTTP取得（リトライ付き）、JSON入出力、JST日時。

GitHub Actionsから実行される各データ取得スクリプトで共有する。
"""

import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

JST = timezone(timedelta(hours=9), "JST")
USER_AGENT = "Mozilla/5.0 (ChigaLog/1.0)"
DEFAULT_TIMEOUT = 15
_MAX_ATTEMPTS = 3
_BACKOFF_SECONDS = (2, 4)


def _http_request(url: str, *, headers: dict[str, str] | None, timeout: int, retry_on_404: bool = False,
                  backoff: tuple[int, ...] | None = None) -> bytes | None:
    """指定URLに対してリトライ付きでHTTPリクエストを送り、本文バイト列を返す。

    一時的な失敗（5xx, 429, ネットワーク例外）はバックオフでリトライする。
    4xx (429除く) は即時にNone。
    retry_on_404=True の場合、404も一時障害とみなしリトライ対象にする
    （JMAガイダンスCSVの再生成時の瞬断対策）。
    backoff で待機秒数の並びを上書きでき、試行回数は len(backoff) + 1 になる。
    """
    waits = backoff if backoff is not None else _BACKOFF_SECONDS
    max_attempts = len(waits) + 1
    h = {"User-Agent": USER_AGENT}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    label = url
    last_err = ""
    for attempt in range(1, max_attempts + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            transient = e.code == 429 or (retry_on_404 and e.code == 404)
            if 400 <= e.code < 500 and not transient:
                print(f"[http] {label}: HTTP {e.code} {e.reason}", file=sys.stderr)
                return None
            last_err = f"HTTP {e.code} {e.reason}"
        except (urllib.error.URLError, TimeoutError) as e:
            last_err = repr(e)
        except Exception as e:
            print(f"[http] {label}: {e}", file=sys.stderr)
            return None

        if attempt < max_attempts:
            wait = waits[attempt - 1]
            print(f"[http] attempt {attempt}/{max_attempts} failed: {label}: {last_err} (retry in {wait}s)", file=sys.stderr)
            time.sleep(wait)
        else:
            print(f"[http] giving up after {max_attempts} attempts: {label}: {last_err}", file=sys.stderr)
    return None


def http_get_bytes(url: str, *, headers: dict[str, str] | None = None, timeout: int = DEFAULT_TIMEOUT, retry_on_404: bool = False,
                   backoff: tuple[int, ...] | None = None) -> bytes | None:
    """URLからバイト列を取得する。既定は最大3回までリトライ。失敗時はNone。

    retry_on_404=True で404も一時障害とみなしリトライする。
    backoff で待機秒数の並び（＝リトライ回数）を上書きできる。
    """
    return _http_request(url, headers=headers, timeout=timeout, retry_on_404=retry_on_404, backoff=backoff)


def http_get_text(url: str, *, encoding: str = "utf-8", headers: dict[str, str] | None = None, timeout: int = DEFAULT_TIMEOUT, retry_on_404: bool = False) -> str | None:
    """URLからテキストデータを取得する。

    retry_on_404=True で404も一時障害とみなしリトライする
    (JMAエンドポイントの再生成時の瞬断対策)。
    """
    raw = http_get_bytes(url, headers=headers, timeout=timeout, retry_on_404=retry_on_404)
    if raw is None:
        return None
    return raw.decode(encoding)


def http_get_json(url: str, *, headers: dict[str, str] | None = None, timeout: int = DEFAULT_TIMEOUT, retry_on_404: bool = False) -> dict | list | None:
    """URLからJSONデータを取得する。

    retry_on_404=True で404も一時障害とみなしリトライする
    (JMAエンドポイントの再生成時の瞬断対策)。
    """
    text = http_get_text(url, headers=headers, timeout=timeout, retry_on_404=retry_on_404)
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


_SITE_CONFIG_CACHE: dict | None = None


def load_site_config() -> dict:
    """フォーク用の地点設定 `_data/site.json` を読み込む。

    リポジトリルート（このファイルの2階層上）基準で解決するため、
    実行時のカレントディレクトリに依存しない。ファイルが無い・壊れている
    場合は空dictを返し、呼び出し側が現行リテラルへフォールバックできる。

    Returns:
        設定dict。読み込み失敗時は空dict。
    """
    global _SITE_CONFIG_CACHE
    if _SITE_CONFIG_CACHE is not None:
        return _SITE_CONFIG_CACHE
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg_path = os.path.join(repo_root, "_data", "site.json")
    cfg = load_json(cfg_path) if os.path.exists(cfg_path) else None
    _SITE_CONFIG_CACHE = cfg if isinstance(cfg, dict) else {}
    return _SITE_CONFIG_CACHE


def save_json(filepath: str, data, *, indent: int | None = None) -> None:
    """JSONファイルとして保存する。親ディレクトリは自動作成。

    部分書き込みを避けるため、同ディレクトリに一時ファイルを作成して
    完全に書き終えてから os.replace() で原子的に置換する。
    GitHub Actions ジョブの中断や I/O 失敗で破損 JSON が
    リポジトリにコミットされる事故を防ぐ。
    """
    directory = os.path.dirname(filepath) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        prefix=".tmp_", suffix=".json", dir=directory
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, filepath)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def now_jst() -> datetime:
    """JSTの現在日時を返す。"""
    return datetime.now(JST)


def require_keys(data, required: list[str], *, label: str = "data") -> None:
    """dict に必須キーが揃っているか検証する。

    1つでも欠ければ ValueError を送出し、呼び出し側の try で
    既存のリトライ/失敗ログ経路に流す。スキーマ実態のドキュメントとしても機能する。

    Args:
        data: 検証対象 (dict 以外は型エラー扱い)。
        required: 必須キー名の配列。
        label: エラーメッセージに含めるデータ名 (例: "openmeteo.weather")。

    Raises:
        ValueError: dict でない、または必須キーが欠落している場合。
    """
    if not isinstance(data, dict):
        raise ValueError(f"{label}: dict ではありません (got {type(data).__name__})")
    missing = [k for k in required if k not in data]
    if missing:
        raise ValueError(f"{label}: 必須キー欠落 {missing}")
