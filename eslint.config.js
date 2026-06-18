// フロントエンド JS の静的検査設定（ESLint flat config）。
// 対象は手書きソース assets/js/app.js のみ（生成物 *.min.js は対象外）。
// 追加依存を避けるため import せず、ブラウザ globals と必要ルールを自己完結で宣言する。

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  location: "readonly",
  console: "readonly",
  fetch: "readonly",
  AbortSignal: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  requestAnimationFrame: "readonly",
  performance: "readonly",
  URL: "readonly",
  Response: "readonly",
  Intl: "readonly",
  matchMedia: "readonly",
  // 外部UMD / Jekyll 生成のグローバル
  Chart: "readonly",
  SITE_CONFIG: "readonly",
};

module.exports = [
  {
    files: ["assets/js/app.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: browserGlobals,
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-redeclare": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-unreachable": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-cond-assign": "error",
      "no-self-assign": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
    },
  },
];
