"""気象庁の天気予報（140000神奈川県）と概況を取得する。"""

from _common import http_get_json, load_site_config, now_jst, save_json

# 予報区コード（県）。フォーク時は _data/site.json の jma.forecast_code を変更。
FORECAST_CODE = load_site_config().get("jma", {}).get("forecast_code", "140000")


def main() -> None:
    print("気象庁 天気予報データの取得を開始します...")

    save_json("data/forecast_data.json", {
        "updated_at": now_jst().isoformat(),
        "forecast": http_get_json(f"https://www.jma.go.jp/bosai/forecast/data/forecast/{FORECAST_CODE}.json"),
        "overview": http_get_json(f"https://www.jma.go.jp/bosai/forecast/data/overview_forecast/{FORECAST_CODE}.json"),
    }, indent=2)
    print("保存完了: data/forecast_data.json")


if __name__ == "__main__":
    main()
