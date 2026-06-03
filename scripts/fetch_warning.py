"""気象庁の警報・注意報を取得し茅ヶ崎市分を書き出す。

bosaiの警報JSON(140000.json)は神奈川で更新停止が確認されたため、
最新が得られるレガシーフィード(VPWS50)を一次ソースとする。
レガシーはCORS不可のためGitHub Actions側(BFF)で取得し、
同一オリジンの極小JSONに整形してフロントへ供給する。
"""

from _common import http_get_json, now_jst, save_json, load_json

# 神奈川県の発表官署署名(JPTF)。県ID 14 -> JPTF。
WARNING_URL = "https://www.data.jma.go.jp/multi/data/VPWS50/JPTF_jp.json"
CHIGASAKI_CODE = "1420700"
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


def main() -> None:
    """警報フィードを取得し茅ヶ崎分を書き出す。取得失敗時は既存を保持。"""
    feed = http_get_json(WARNING_URL)
    if not isinstance(feed, dict):
        # 取得失敗時は誤って空にせず既存ファイルを温存する。
        if load_json(OUTPUT_PATH) is not None:
            print("[warning] 取得失敗。既存ファイルを保持します。")
            return
        # 既存も無い場合のみ空で初期化する。
        feed = {}

    warnings = extract_chigasaki(feed)
    output = {
        "reportDateTime": feed.get("reportDateTime", ""),
        "fetchedAt": now_jst().isoformat(timespec="seconds"),
        "source": WARNING_URL,
        "area": "茅ヶ崎市",
        "areaCode": CHIGASAKI_CODE,
        "warnings": warnings,
    }
    save_json(OUTPUT_PATH, output, indent=2)
    print(f"[warning] {len(warnings)}件: {[w['name'] for w in warnings]}")


if __name__ == "__main__":
    main()
