"""気象庁の天気予報（140000神奈川県）と概況を取得する。

取得失敗・仕様変更時は既存の有効データを null で上書きせず温存する
（三原則1: 取得失敗時はダミー値で誤読を誘発しない）。
"""

from _common import http_get_json, load_json, load_site_config, now_jst, save_json

# 予報区コード（県）。フォーク時は _data/site.json の jma.forecast_code を変更。
FORECAST_CODE = load_site_config().get("jma", {}).get("forecast_code", "140000")
OUTPUT_PATH = "data/forecast.json"


def is_valid_forecast(forecast) -> bool:
    """予報JSONが想定構造（非空list・先頭にtimeSeries保持）か検証する。

    気象庁の仕様変更や取得失敗（None）を早期に弾き、フロントへ
    null を供給しないための最小スキーマチェック。

    Args:
        forecast: http_get_json の戻り値。

    Returns:
        想定構造なら True。
    """
    return (
        isinstance(forecast, list)
        and len(forecast) > 0
        and isinstance(forecast[0], dict)
        and isinstance(forecast[0].get("timeSeries"), list)
    )


def main() -> None:
    """天気予報と概況を取得し保存する。取得失敗・不正時は既存を温存。"""
    print("気象庁 天気予報データの取得を開始します...")

    forecast = http_get_json(
        f"https://www.jma.go.jp/bosai/forecast/data/forecast/{FORECAST_CODE}.json"
    )
    overview = http_get_json(
        f"https://www.jma.go.jp/bosai/forecast/data/overview_forecast/{FORECAST_CODE}.json"
    )

    # 取得失敗・仕様変更時は誤って null で上書きせず既存ファイルを温存する。
    if not is_valid_forecast(forecast) or not isinstance(overview, dict):
        if load_json(OUTPUT_PATH) is not None:
            print("[forecast] 取得失敗または構造不正。既存ファイルを保持します。")
            return
        # 既存も無い場合のみ異常終了（呼び出し側のログ/失敗経路へ）。
        raise RuntimeError("forecast/overview の取得に失敗し、既存ファイルもありません。")

    save_json(OUTPUT_PATH, {
        "updated_at": now_jst().isoformat(),
        "forecast": forecast,
        "overview": overview,
    }, indent=2)
    print("保存完了: data/forecast.json")


if __name__ == "__main__":
    main()
