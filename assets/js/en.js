// 英語表示（おまけ）。日本語版が本体で、これはいつ削除してもよい補助機能
// （CLAUDE.md「英語表示（おまけ）の扱い」）。フッターの「English」を押した
// 利用者にだけ app.js が読み込む。日本語利用者には配信されない。
// 辞書の追従は任意（漏れた文言は日本語のまま表示されるだけ）。
//
// 方針:
// - app.js は日本語のまま描画し、このファイルが描画済みのテキストノードを
//   「完全一致の辞書」と「行全体に一致する正規表現」で後から置き換える。
//   部分一致の置換はしない（中途半端な訳で誤読させない＝三原則1）。
// - 辞書に無い文言は日本語のまま残す。警報・津波など安全情報は隠さない。
// - 気象庁の自由文（天気文・概況）は機械的に訳せないため英語表示では隠す。
// - app.js は定期的に再描画するため MutationObserver で置き換えを再適用する。
(function () {
  "use strict";

  const JA = /[\u203b\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/;

  // 地名（_data/site.json 由来の値を含む）。未登録の地名は日本語のまま。
  const PLACES = {
    茅ヶ崎: "Chigasaki",
    茅ヶ崎市: "Chigasaki City",
    茅ヶ崎ヘッドランド: "Chigasaki Headland",
    湘南港: "Shonan Port",
    辻堂: "Tsujido",
    神奈川県: "Kanagawa",
    "相模湾・三浦半島": "Sagami Bay & Miura Peninsula",
  };
  const place = (s) => PLACES[s] || s;

  const DIRS = {
    北: "N",
    北北東: "NNE",
    北東: "NE",
    東北東: "ENE",
    東: "E",
    東南東: "ESE",
    南東: "SE",
    南南東: "SSE",
    南: "S",
    南南西: "SSW",
    南西: "SW",
    西南西: "WSW",
    西: "W",
    西北西: "WNW",
    北西: "NW",
    北北西: "NNW",
    静穏: "Calm",
  };

  // 前後の空白を除き、内部の連続空白を1つにした文字列をキーにする。
  const DICT = {
    ...DIRS,
    ...PLACES,
    // 共通
    気象庁: "JMA",
    "※": "*",
    "読み込み中...": "Loading...",
    "取得中...": "Loading...",
    取得失敗: "Failed",
    データなし: "No data",
    明日: "Tomorrow",
    "file:// プロトコル非対応": "file:// not supported",
    メインコンテンツへスキップ: "Skip to main content",
    茅ヶ崎の海情報: "Chigasaki ocean info",
    "茅ヶ崎の波・潮汐・水温が、５秒でわかる。":
      "Chigasaki waves, tides and water temperature at a glance.",
    "データの取得に失敗しました。": "Failed to load data.",
    データを手動で更新: "Refresh data",
    データを更新する: "Refresh data",
    最新の情報に更新しました: "Updated to the latest data",
    // 注: 「データを更新中... ⏳」は訳さない。app.js が #current-time の
    // 文言に「更新中」が含まれるかで更新失敗時の復帰を判定しているため。
    "最新データを取得できませんでした（表示中の値は古い可能性）":
      "Could not get the latest data (values shown may be outdated)",
    予報データが現在時刻に届いていません:
      "Forecast data does not cover the current time",
    // 津波
    津波注意報: "Tsunami Advisory",
    津波警報: "Tsunami Warning",
    大津波警報: "Major Tsunami Warning",
    "※必ず": "* Always check the latest information on the ",
    気象庁HP: "JMA website",
    "で最新の情報を確認してください！": "!",
    "※津波情報を取得できませんでした。気象庁HPでご確認ください。":
      "* Could not load tsunami information. Please check the JMA website.",
    巨大: "Huge",
    // ヒーローカード
    海水温セクションへ移動: "Go to sea temperature",
    気温セクションへ移動: "Go to air temperature",
    風速セクションへ移動: "Go to wind",
    // 潮汐
    潮汐情報: "Tide",
    "潮回り:": "Tide type:",
    "満潮・干潮:": "High / low tide:",
    満潮: "High",
    干潮: "Low",
    "満潮:": "High:",
    "干潮:": "Low:",
    大潮: "Spring tide",
    中潮: "Moderate tide",
    小潮: "Neap tide",
    長潮: "Long tide",
    若潮: "Young tide",
    不明: "Unknown",
    潮汐タイドグラフ: "Tide graph",
    "潮位 (m)": "Tide level (m)",
    潮位イメージ: "Tide (schematic)",
    "※潮汐データの取得に失敗しました。": "* Failed to load tide data.",
    "※正確な潮位は": "* For accurate tide levels, see the ",
    "等をご確認ください。": ".",
    // 波浪ガイダンス
    "波高･周期": "Wave height & period",
    波高と周期の予測グラフ: "Wave height and period forecast graph",
    "波高（海域最大）[m]": "Wave height (area max) [m]",
    "周期 [秒]": "Period [s]",
    "気象庁 沿岸波浪ガイダンス": "JMA coastal wave guidance",
    "の予想値です。波高は関東地方南部（相模湾〜外房）の海域で最も高い地点の有義波高で、茅ヶ崎の岸近くでは通常これより低くなります。周期は卓越周期（波が来る間隔の秒数。長いほど力の強いうねり）です。":
      " forecast. Wave height is the significant wave height at the highest point in the southern Kanto sea area (Sagami Bay to Sotobo); near the Chigasaki shore it is usually lower. Period is the peak period (seconds between waves; longer means more powerful swell).",
    "波情報の取得に失敗しました。": "Failed to load wave data.",
    // 水温・波高（Open-Meteo）
    "水温･波高": "Sea temp & waves",
    予測: "forecast",
    "波 高:": "Wave height:",
    "海水温:": "Sea temp:",
    "※茅ヶ崎沖の予測値です。波高は有義波高（高い方から1/3の波の平均）で、目で見た波の高さに近い値です。":
      "* Forecast for off Chigasaki. Wave height is the significant wave height (average of the highest third of waves), close to what you see by eye.",
    // 注意報・警報
    "注意報・警報": "Advisories & warnings",
    特別警報: "Emergency Warning",
    危険警報: "Danger Warning",
    警報: "Warning",
    注意報: "Advisory",
    "現在、注意報・警報はありません": "No advisories or warnings in effect",
    "注意報・警報の取得に失敗しました。":
      "Failed to load advisories and warnings.",
    "（押すと注意報・警報の一覧へ移動）":
      " (tap to go to the advisories and warnings)",
    // 熱中症
    熱中症警戒アラート: "Heatstroke Alert",
    熱中症特別警戒アラート: "Special Heatstroke Alert",
    "環境省・気象庁": "MOE / JMA",
    環境省: "MOE",
    "環境省 熱中症予防情報サイト": "MOE Heatstroke Prevention site",
    "の発表情報です。": " (official announcement).",
    "危険な暑さから、自分と周りの人の命を守る行動をしてください。":
      "Dangerous heat. Take action to protect your life and those around you.",
    "涼しい環境で過ごし、こまめに水分・塩分を補給してください。":
      "Stay somewhere cool and drink water and take salt often.",
    // 天気予報（天気文・概況は隠す。数値の行だけ訳す）
    天気予報: "Weather forecast",
    "降水確率:": "Chance of rain:",
    "最高/最低:": "High / low:",
    台風情報あり: "Typhoon information issued",
    "概況を表示 ▼": "Show overview ▼",
    "概況を閉じる ▲": "Hide overview ▲",
    今日の予報を取得できていません: "Today's forecast is not available",
    "天気予報の取得に失敗しました。": "Failed to load the weather forecast.",
    "※天気の移り変わりは、": "* For upcoming weather changes, also see the ",
    気象庁の天気図: "JMA weather map",
    "等もご確認ください。": ".",
    // 風予報
    風予報: "Wind forecast",
    "1時間ごと": "hourly",
    時刻: "Time",
    風向: "Dir",
    "平均 m/s": "Avg m/s",
    "最大 m/s": "Gust m/s",
    平均: "avg",
    最大: "gust",
    "風予報の取得に失敗しました。": "Failed to load the wind forecast.",
    // 現在の気温・風
    "現在の気温･風": "Current temp & wind",
    "気 温:": "Temp:",
    "湿 度:": "Humidity:",
    "風 速:": "Wind:",
    "風 向:": "Wind dir:",
    "降水量（1時間）:": "Rain (1 h):",
    "の観測値です。": " observations.",
    "（取得失敗のため前回の観測値を表示中）":
      " (showing the previous observation; the latest fetch failed)",
    // フッター
    "出典:": "Sources:",
    気象庁ホームページ: "JMA website",
    "（天気予報・アメダス・注意報・警報・津波・潮位表・波浪ガイダンス）を加工して作成 /":
      " (forecast, AMeDAS, advisories/warnings, tsunami, tide tables, wave guidance), processed by this site /",
    "（熱中症警戒情報） /": " (heatstroke alerts) /",
    "（月齢） /": " (moon age) /",
    "（": " (",
    "、風予報・波高・海水温） /": ", wind forecast, wave height, sea temp) /",
    "（潮汐の予備）": " (tide backup)",
    "※ 本ツールは参考用です。実際の活動時は、必ず目視や公式発表も併せて確認してください。":
      "* This tool is for reference only. Before going out, always check conditions with your own eyes and official announcements.",
    "※ 海のコンディションは急変します。無理な入水は控え、安全にマリンスポーツを楽しみましょう。":
      "* Ocean conditions change quickly. Don't go in if in doubt, and enjoy marine sports safely.",
    茅ヶ崎のライフセービング活動紹介: "Chigasaki lifesaving activities",
    "ちがビオ | 茅ヶ崎の生き物情報": "ChigaBio | Chigasaki wildlife",
  };

  // 警報の現象名。気象庁の注意報・警報の種別（2026-05-28 以降の名称を含む）。
  const PHENOMENA = {
    大雨: "Heavy Rain",
    洪水: "Flood",
    強風: "Strong Wind",
    暴風: "Storm",
    風雪: "Snowstorm",
    暴風雪: "Violent Snowstorm",
    大雪: "Heavy Snow",
    波浪: "High Wave",
    高潮: "Storm Surge",
    雷: "Thunderstorm",
    濃霧: "Dense Fog",
    乾燥: "Dry Air",
    なだれ: "Avalanche",
    低温: "Low Temperature",
    霜: "Frost",
    着氷: "Ice Accretion",
    着雪: "Snow Accretion",
    融雪: "Snowmelt",
    土砂災害: "Landslide",
    氾濫: "Flooding",
  };
  const KINDS = {
    特別警報: "Emergency Warning",
    危険警報: "Danger Warning",
    警報: "Warning",
    注意報: "Advisory",
  };

  /** 「レベル４土砂災害危険警報」「大雨注意報」等。現象名が未知なら null。 */
  function warningName(s) {
    const m =
      /^(?:レベル([１-５1-5]))?(.+?)(特別警報|危険警報|警報|注意報)$/.exec(s);
    if (!m || !PHENOMENA[m[2]]) return null;
    const lv = m[1] ? `Level ${"１２３４５".indexOf(m[1]) + 1 || m[1]} ` : "";
    return `${lv}${PHENOMENA[m[2]]} ${KINDS[m[3]]}`;
  }

  const age = (s) =>
    s
      .replace(/(\d+)分前/, "$1 min ago")
      .replace(/(\d+)時間前/, "$1 h ago")
      .replace(/(\d+)日前/, "$1 d ago");

  const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const WEEKDAYS = {
    日: "Sun",
    月: "Mon",
    火: "Tue",
    水: "Wed",
    木: "Thu",
    金: "Fri",
    土: "Sat",
  };
  const monthDay = (m, d) => `${MONTHS[Number(m) - 1] || m} ${Number(d)}`;
  /** toLocaleString("ja-JP") の「10月15日(水) 16:20」を英語順に。 */
  function jaDate(s) {
    const m = /^(\d+)月(\d+)日\((.)\) (\d+:\d\d)$/.exec(s);
    return m ? `${WEEKDAYS[m[3]] || m[3]} ${monthDay(m[1], m[2])}, ${m[4]}` : s;
  }
  const dayLabel = (s) => {
    if (s === "今日") return "Today";
    if (s === "明日") return "Tomorrow";
    const m = /^(\d+)月(\d+)日$/.exec(s);
    return m ? monthDay(m[1], m[2]) : s;
  };
  const tmrw = (s) => (s || "").replace(/明日/g, "Tmrw ");

  // 行全体に一致した場合だけ置き換える（^…$ で固定）。
  const RULES = [
    [
      /^データが古い可能性（最終更新 (.+)）$/,
      (m) => `Data may be outdated (updated ${age(m[1])})`,
    ],
    [
      /^データが古い可能性（(.+)の値）$/,
      (m) => `Data may be outdated (value from ${age(m[1])})`,
    ],
    [
      /^更新日時: (.+?)(?:（データ: (.+)）)?$/,
      (m) => `Updated: ${jaDate(m[1])}${m[2] ? ` (data: ${age(m[2])})` : ""}`,
    ],
    [
      /^注意報・警報の最新情報を確認できていません(?:（最終取得 (.+)）)?。気象庁の発表を確認してください$/,
      (m) =>
        `Could not confirm the latest advisories and warnings${m[1] ? ` (last fetched ${age(m[1])})` : ""}. Please check JMA announcements.`,
    ],
    [
      /^気象庁 (\d+)月(\d+)日 (\d+:\d\d) 発表$/,
      (m) => `Issued by JMA ${monthDay(m[1], m[2])}, ${m[3]}`,
    ],
    [
      // 警報バー: 「大雨警報 発令中」「危険警報・警報 発令中」
      /^(.+) 発令中$/,
      (m) =>
        `${m[1]
          .split("・")
          .map((p) => KINDS[p] || warningName(p) || p)
          .join(" / ")} in effect`,
    ],
    [/^.+(?:特別警報|危険警報|警報|注意報)$/, (m) => warningName(m[0])],
    [
      /^\(月齢: ([\d.]+)( \/ 計算値)?\)$/,
      (m) => `(Moon age: ${m[1]}${m[2] ? " / calculated" : ""})`,
    ],
    [
      /^(今日|明日|\d+月\d+日)（(\d{4}-\d\d-\d\d)） (.+)に発表中$/,
      (m) => `${dayLabel(m[1])} (${m[2]}): issued for ${place(m[3])}`,
    ],
    [
      // 津波: 「予想の高さ: 1m　第一波到達: 14:20」。値が文言の場合はそのまま。
      /^(?:予想の高さ|第一波到達): /,
      (m) =>
        m.input
          .replace("予想の高さ: ", "Expected height: ")
          // 全角スペースの区切りはキー正規化で半角1つになっている
          .replace(" 第一波到達: ", " / First wave: ")
          .replace("第一波到達: ", "First wave: ")
          .replace("巨大", "Huge"),
    ],
    [
      /^(明日)?(--|-?\d+)℃ \/ (明日)?(--|-?\d+)℃(（明日）)?$/,
      (m) =>
        `${m[1] ? "Tmrw " : ""}${m[2]}℃ / ${m[3] ? "Tmrw " : ""}${m[4]}℃${m[5] ? " (tomorrow)" : ""}`,
    ],
    [
      /^この先の風(?:（(.+)）)?を(表示 ▼|閉じる ▲)$/,
      (m) => {
        const open = m[2].startsWith("閉じる");
        const range = m[1] ? ` (${tmrw(m[1])})` : "";
        return `${open ? "Hide" : "Show"} later winds${range} ${open ? "▲" : "▼"}`;
      },
    ],
    [/^（(\d+:\d\d) 観測）$/, (m) => ` (observed ${m[1]})`],
    [/^気象庁の潮位表（(.+)）$/, (m) => `JMA tide table (${place(m[1])})`],
    [/^アメダス（(.+)）$/, (m) => `AMeDAS (${place(m[1])})`],
    [
      /^※(.+)付近の予測値です。局所風とは異なる場合があります。$/,
      (m) => `* Forecast near ${place(m[1])}. Local winds may differ.`,
    ],
    // グラフのツールチップ
    [/^波高（海域最大）: (.+)$/, (m) => `Wave height (area max): ${m[1]}`],
    [/^周期: (\d+) 秒$/, (m) => `Period: ${m[1]} s`],
  ];

  /** 訳せれば前後の空白を保った英語を、訳せなければ null を返す。 */
  function tr(s) {
    if (typeof s !== "string" || !JA.test(s)) return null;
    const key = s.trim().replace(/\s+/g, " ");
    let out = Object.prototype.hasOwnProperty.call(DICT, key)
      ? DICT[key]
      : null;
    if (out == null) {
      for (const [re, fn] of RULES) {
        const m = re.exec(key);
        if (m) {
          out = fn(m);
          break;
        }
      }
    }
    if (out == null) return null;
    return s.match(/^\s*/)[0] + out + s.match(/\s*$/)[0];
  }

  function translateNode(node) {
    const out = tr(node.nodeValue);
    if (out != null && out !== node.nodeValue) node.nodeValue = out;
  }

  function translateAttrs(el) {
    const v = el.getAttribute("aria-label");
    const out = tr(v);
    if (out != null) el.setAttribute("aria-label", out.trim());
  }

  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "svg"]);
  function walk(root) {
    if (root.nodeType === 3) {
      if (!SKIP.has(root.parentNode?.nodeName)) translateNode(root);
      return;
    }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
    translateAttrs(root);
    const w = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: (n) =>
          n.nodeType === 1 && SKIP.has(n.nodeName)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      },
    );
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 3) translateNode(n);
      else translateAttrs(n);
    }
  }

  // Chart.js の文字は canvas に描かれ DOM 置換が効かないため、インスタンスの
  // データセット名とツールチップを直接差し替える。グラフは再生成されるので
  // 未処理のインスタンスだけを対象にする。
  const doneCharts = new WeakSet();
  function translateCharts() {
    if (typeof Chart === "undefined" || !Chart.getChart) return;
    ["tideChart", "waveChart"].forEach((id) => {
      const chart = Chart.getChart(id);
      if (!chart || doneCharts.has(chart)) return;
      doneCharts.add(chart);
      chart.data.datasets.forEach((ds) => {
        const out = tr(ds.label);
        if (out) ds.label = out;
      });
      const cb = chart.config.options?.plugins?.tooltip?.callbacks;
      if (cb && typeof cb.label === "function") {
        const orig = cb.label;
        cb.label = function (ctx) {
          const r = orig.call(this, ctx);
          return tr(r) ?? r;
        };
      }
      chart.update("none");
    });
  }

  // 機械的に訳せない気象庁の自由文は隠し、日本語のみである旨を1行添える。
  // スタイルシートを変えずに済むよう、要素のインラインスタイルで隠す。
  function hideFreeText() {
    const byId = (id) => document.getElementById(id);
    [
      byId("jma-weather")?.closest(".data-row"),
      byId("jma-overview-toggle"),
      byId("jma-overview-text"),
      document.querySelector(".footer-about"),
    ].forEach((el) => el?.style.setProperty("display", "none", "important"));

    const content = byId("jma-forecast-content");
    if (content && !byId("en-forecast-note")) {
      const note = document.createElement("p");
      note.id = "en-forecast-note";
      note.className = "note";
      const a = document.createElement("a");
      a.href = "https://www.jma.go.jp/bosai/forecast/";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "JMA website";
      note.append(
        "* The text forecast is available in Japanese only (",
        a,
        ").",
      );
      content.insertBefore(note, byId("jma-typhoon-notice"));
    }
  }

  function setupToggle() {
    const btn = document.getElementById("lang-toggle");
    if (!btn) return;
    btn.textContent = "日本語";
    btn.lang = "ja";
    // 日本語へ戻すときは選択を消して読み直す（元の文言を復元する処理を持たない）。
    btn.addEventListener("click", () => {
      try {
        localStorage.removeItem("lang");
      } catch {
        // 保存できない環境でも読み直しで日本語に戻る
      }
      location.reload();
    });
  }

  const html = document.documentElement;
  html.lang = "en";
  document.title = "ChigaLog | Chigasaki waves, tides, sea temp & weather";
  // ロゴ・サイト名は日本語のまま。読み上げが日本語で読むよう lang を付ける。
  document
    .querySelectorAll(".logo-text, .site-bar-name")
    .forEach((el) => (el.lang = "ja"));
  setupToggle();
  hideFreeText();
  walk(document.body);
  translateCharts();

  const observer = new MutationObserver((records) => {
    records.forEach((r) => {
      if (r.type === "characterData") walk(r.target);
      else if (r.type === "attributes") translateAttrs(r.target);
      else r.addedNodes.forEach(walk);
    });
    translateCharts();
    // 自分の置き換えで生じた記録は捨てる（英語は辞書に当たらないので
    // 再処理しても止まるが、無駄な走査を避ける）。
    observer.takeRecords();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    // width はグラフ再生成の合図（canvas の幅が設定される）
    attributeFilter: ["aria-label", "width"],
  });
})();
