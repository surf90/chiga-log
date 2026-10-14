"""fetch_openmeteo.py のヘルパ関数（純関数）の単体テスト。"""

import pytest

import fetch_openmeteo
from fetch_openmeteo import (
    _add_jst_tz,
    _build_wind_items,
    _carry_forward_amedas,
    _normalize_current_weather,
    _normalize_marine,
    _qc_value,
    fetch_marine,
)


# ─── _add_jst_tz ───────────────────────────────────────────────
def test_add_jst_tz_appends_offset_to_naive_iso():
    assert _add_jst_tz("2026-06-05T12:00") == "2026-06-05T12:00+09:00"


def test_add_jst_tz_keeps_existing_offset():
    assert _add_jst_tz("2026-06-05T12:00+09:00") == "2026-06-05T12:00+09:00"


def test_add_jst_tz_keeps_zulu():
    assert _add_jst_tz("2026-06-05T03:00Z") == "2026-06-05T03:00Z"


def test_add_jst_tz_returns_none_for_non_string():
    assert _add_jst_tz(None) is None
    assert _add_jst_tz(42) == 42


def test_add_jst_tz_returns_empty_string_untouched():
    assert _add_jst_tz("") == ""


# ─── _qc_value ─────────────────────────────────────────────────
def test_qc_value_returns_value_on_flag_zero():
    assert _qc_value([23.4, 0]) == 23.4


def test_qc_value_returns_none_on_nonzero_flag():
    assert _qc_value([23.4, 1]) is None


def test_qc_value_returns_none_on_short_array():
    assert _qc_value([23.4]) is None


def test_qc_value_returns_none_on_non_list():
    assert _qc_value(None) is None
    assert _qc_value("abc") is None


# ─── _build_wind_items ─────────────────────────────────────────
def test_build_wind_items_zips_arrays_and_normalizes_time():
    hourly = {
        "time": ["2026-06-05T00:00", "2026-06-05T01:00"],
        "wind_speed_10m": [2.0, 3.5],
        "wind_direction_10m": [90, 100],
        "wind_gusts_10m": [3.0, 4.0],
    }
    items = _build_wind_items(hourly)
    assert len(items) == 2
    assert items[0]["time"] == "2026-06-05T00:00+09:00"
    assert items[0]["wind_speed_ms"] == 2.0
    assert items[1]["wind_direction_deg"] == 100


def test_build_wind_items_handles_short_arrays():
    """speed/dir/gust の長さが time に満たない場合は None を埋める。"""
    items = _build_wind_items({
        "time": ["2026-06-05T00:00", "2026-06-05T01:00"],
        "wind_speed_10m": [2.0],
        "wind_direction_10m": [],
        "wind_gusts_10m": None,
    })
    assert items[1]["wind_speed_ms"] is None
    assert items[0]["wind_direction_deg"] is None
    assert items[0]["wind_gust_ms"] is None


def test_build_wind_items_empty():
    assert _build_wind_items({}) == []


# ─── _normalize_current_weather ────────────────────────────────
def test_normalize_current_weather_adds_jst():
    out = _normalize_current_weather({"time": "2026-06-05T12:00", "temperature": 25})
    assert out["time"] == "2026-06-05T12:00+09:00"
    assert out["temperature"] == 25


def test_normalize_current_weather_no_time_key():
    assert _normalize_current_weather({"temperature": 25}) == {"temperature": 25}


def test_normalize_current_weather_non_dict_passthrough():
    assert _normalize_current_weather(None) is None


# ─── _normalize_marine ─────────────────────────────────────────
def test_normalize_marine_handles_current_and_hourly():
    marine = {
        "current": {"time": "2026-06-05T12:00", "wave_height": 1.2},
        "hourly": {
            "time": ["2026-06-05T00:00", "2026-06-05T01:00"],
            "wave_height": [1.0, 1.1],
        },
    }
    out = _normalize_marine(marine)
    assert out["current"]["time"] == "2026-06-05T12:00+09:00"
    assert out["hourly"]["time"] == [
        "2026-06-05T00:00+09:00",
        "2026-06-05T01:00+09:00",
    ]
    # 入力を破壊しないこと
    assert marine["current"]["time"] == "2026-06-05T12:00"


def test_normalize_marine_missing_subkeys():
    assert _normalize_marine({}) == {}


def test_normalize_marine_non_dict_passthrough():
    assert _normalize_marine(None) is None


# ─── _carry_forward_amedas ─────────────────────────────────────
def test_carry_forward_returns_fresh_when_available(monkeypatch):
    fresh = {"temp": 22.5, "humidity": 69}
    # 取得成功時は load_json を呼ばずそのまま返す
    monkeypatch.setattr(
        fetch_openmeteo, "load_json", lambda *_: pytest.fail("不要な読込")
    )
    assert _carry_forward_amedas(fresh) is fresh


def test_carry_forward_uses_previous_with_stale_flag(monkeypatch):
    prev = {"observed_at": "2026-06-15T15:00:00+09:00", "temp": 22.5, "humidity": 69}
    monkeypatch.setattr(
        fetch_openmeteo, "load_json", lambda *_: {"jma_amedas": prev}
    )
    result = _carry_forward_amedas(None)
    assert result == {**prev, "stale": True}


def test_carry_forward_returns_none_when_no_previous(monkeypatch):
    monkeypatch.setattr(fetch_openmeteo, "load_json", lambda *_: {"jma_amedas": None})
    assert _carry_forward_amedas(None) is None
    monkeypatch.setattr(fetch_openmeteo, "load_json", lambda *_: None)
    assert _carry_forward_amedas(None) is None


# ─── fetch_marine ──────────────────────────────────────────────
def test_fetch_marine_uses_hourly_url_first(monkeypatch):
    called = []

    def fake(url):
        called.append(url)
        return {"current": {}, "hourly": {}}

    monkeypatch.setattr(fetch_openmeteo, "http_get_json", fake)
    assert fetch_marine() == {"current": {}, "hourly": {}}
    assert called == [fetch_openmeteo.MARINE_URL]
    assert "hourly=wave_height,sea_surface_temperature" in called[0]


def test_fetch_marine_falls_back_to_current_only(monkeypatch):
    """hourly が弾かれても current だけは取得を続ける（更新停止を防ぐ）。"""
    called = []

    def fake(url):
        called.append(url)
        return None if url == fetch_openmeteo.MARINE_URL else {"current": {}}

    monkeypatch.setattr(fetch_openmeteo, "http_get_json", fake)
    assert fetch_marine() == {"current": {}}
    assert called == [
        fetch_openmeteo.MARINE_URL,
        fetch_openmeteo.MARINE_URL_CURRENT_ONLY,
    ]


def test_fetch_marine_returns_none_when_both_fail(monkeypatch):
    monkeypatch.setattr(fetch_openmeteo, "http_get_json", lambda url: None)
    assert fetch_marine() is None


fom = fetch_openmeteo


def _run_main(tmp_path, monkeypatch, *, weather, marine, amedas, wind, prev=None):
    import json


    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    if prev is not None:
        (tmp_path / "data" / "weather_marine.json").write_text(json.dumps(prev), encoding="utf-8")

    def fake_get_json(url, **_):
        return weather if url == fom.WEATHER_URL else wind

    monkeypatch.setattr(fom, "http_get_json", fake_get_json)
    monkeypatch.setattr(fom, "fetch_marine", lambda: marine)
    monkeypatch.setattr(fom, "fetch_jma_amedas", lambda: amedas)
    failed = False
    try:
        fom.main()
    except RuntimeError:
        failed = True
    out = {}
    for name in ("weather_marine", "wind_forecast"):
        f = tmp_path / "data" / f"{name}.json"
        out[name] = json.loads(f.read_text(encoding="utf-8")) if f.exists() else None
    return failed, out


AMEDAS = {"observed_at": "2026-10-14T20:10:00+09:00", "temp": 23.4}
WEATHER = {"current": {"time": "2026-10-14T20:15", "temperature_2m": 23.0, "wind_speed_10m": 4.1, "wind_direction_10m": 350}}
MARINE = {"current": {"time": "2026-10-14T20:15", "wave_height": 0.7}}
WIND = {"hourly": {"time": ["2026-10-14T21:00"], "wind_speed_10m": [3.0]}}


def test_main_saves_amedas_even_when_wind_forecast_fails(tmp_path, monkeypatch):
    failed, out = _run_main(tmp_path, monkeypatch, weather=WEATHER, marine=MARINE, amedas=AMEDAS, wind=None)
    assert failed  # 失敗は Actions に伝える
    assert out["weather_marine"]["jma_amedas"] == AMEDAS
    assert out["wind_forecast"] is None


def test_main_carries_previous_marine_when_marine_fails(tmp_path, monkeypatch):
    prev_marine = {"current": {"time": "2026-10-14T17:00+09:00", "wave_height": 0.5}}
    failed, out = _run_main(
        tmp_path, monkeypatch, weather=WEATHER, marine=None, amedas=AMEDAS, wind=WIND,
        prev={"marine": prev_marine},
    )
    assert failed
    # 前回値は時刻ごと引き継ぐ（フロントは marine の time で鮮度判定する）
    assert out["weather_marine"]["marine"] == prev_marine
    assert out["wind_forecast"]["items"][0]["time"] == "2026-10-14T21:00+09:00"


def test_main_rejects_schema_change_as_failure(tmp_path, monkeypatch):
    failed, out = _run_main(tmp_path, monkeypatch, weather=WEATHER, marine=MARINE, amedas=AMEDAS, wind={"oops": 1})
    assert failed
    assert out["wind_forecast"] is None


def test_main_succeeds_when_everything_is_available(tmp_path, monkeypatch):
    failed, out = _run_main(tmp_path, monkeypatch, weather=WEATHER, marine=MARINE, amedas=AMEDAS, wind=WIND)
    assert not failed
    assert out["weather_marine"]["current_weather"]["time"] == "2026-10-14T20:15+09:00"


def test_main_converts_current_to_legacy_current_weather_shape(tmp_path, monkeypatch):
    _, out = _run_main(tmp_path, monkeypatch, weather=WEATHER, marine=MARINE, amedas=AMEDAS, wind=WIND)
    assert out["weather_marine"]["current_weather"] == {
        "time": "2026-10-14T20:15+09:00",
        "temperature": 23.0,
        "windspeed": 4.1,
        "winddirection": 350,
    }
