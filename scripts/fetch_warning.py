"""気象庁の警報・注意報を取得し茅ヶ崎市分を書き出す。

bosaiの警報JSON(140000.json)は神奈川で更新停止が確認されたため、
最新が得られるレガシーフィード(VPWS50)を一次ソースとする。
レガシーはCORS不可のためGitHub Actions側(BFF)で取得し、
同一オリジンの極小JSONに整形してフロントへ供給する。
"""

from _common import http_get_json, load_site_config, now_jst, save_json, load_json

_jma = load_site_config().get("jma", {})
# 神奈川県の発表官署署名(JPTF)。県ID 14 -> JPTF。
_WARNING_OFFICE = _jma.get("warning_office", "JPTF")
WARNING_URL = f"https://www.data.jma.go.jp/multi/data/VPWS50/{_WARNING_OFFICE}_jp.json"
CHIGASAKI_CODE = _jma.get("city_warning_code", "1420700")
CHIGASAKI_NAME = _jma.get("city_warning_name", "茅ヶ崎市")
OUTPUT_PATH = "data/warning_chigasaki.json"


def extract_chigasaki(feed: dict) -> list[dict]:
    """フィードのitemArea4から茅ヶ崎市のkind(警報種別)を抽出する。

    Args:
        feed: VPWS50フィードのJSON。

    Returns:
        [{"code": str, "name": str}, ...]。該当無し・解除時は空配列。
    """
    for item in feed.get("itemArea4", []) or []:
        if item.get("area", {}).get("code") == CHIGASAKI_CODE:
            return [
                {"code": k.get("code", ""), "name": k.get("name", "")}
                for k in item.get("kind", [])
                if k.get("name")
            ]
    return []


def is_valid_feed(feed) -> bool:
    """VPWS50フィードが想定構造（dict かつ itemArea4 が配列）か検証する。"""
    return isinstance(feed, dict) and isinstance(feed.get("itemArea4"), list)


def main() -> None:
    """警報フィードを取得し茅ヶ崎分を書き出す。取得失敗時は既存を保持。"""
    feed = http_get_json(WARNING_URL)
    # itemArea4 が無い＝仕様変更・空応答。ここを通すと warnings=[] と新しい
    # fetchedAt が書き出され、フロントが「注意報・警報はありません」と断定して
    # しまう（三原則1）。Worker 側(warning-worker)と同じ条件で失敗扱いにする。
    if not is_valid_feed(feed):
        # 取得失敗時は誤って空にせず既存ファイルを温存する。
        if load_json(OUTPUT_PATH) is not None:
            print("[warning] 取得失敗。既存ファイルを保持します。")
            return
        # 既存も無い場合のみ空で初期化する。fetchedAt を空にして、フロントに
        # 「未確認」（警報なしと断定しない）として扱わせる。
        feed = None

    warnings = extract_chigasaki(feed) if feed else []
    output = {
        "reportDateTime": feed.get("reportDateTime", "") if feed else "",
        "fetchedAt": now_jst().isoformat(timespec="seconds") if feed else "",
        "source": WARNING_URL,
        "area": CHIGASAKI_NAME,
        "areaCode": CHIGASAKI_CODE,
        "warnings": warnings,
    }
    save_json(OUTPUT_PATH, output, indent=2)
    print(f"[warning] {len(warnings)}件: {[w['name'] for w in warnings]}")


if __name__ == "__main__":
    main()
