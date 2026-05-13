"""気象庁の天気予報（140000神奈川県）と概況を取得する。"""

from _common import http_get_json, now_jst, save_json


def main() -> None:
    print("気象庁 天気予報データの取得を開始します...")

    save_json("data/forecast_data.json", {
        "updated_at": now_jst().isoformat(),
        "forecast": http_get_json("https://www.jma.go.jp/bosai/forecast/data/forecast/140000.json"),
        "overview": http_get_json("https://www.jma.go.jp/bosai/forecast/data/overview_forecast/140000.json"),
    }, indent=2)
    print("保存完了: data/forecast_data.json")


if __name__ == "__main__":
    main()
