// フロントエンド JS の静的検査設定（ESLint flat config）。
// 対象は手書きソース（app.js / sw.js / sw-register.js）。生成物 *.min.js は対象外。
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
  getComputedStyle: "readonly",
  IntersectionObserver: "readonly",
  // 外部UMD / Jekyll 生成のグローバル
  Chart: "readonly",
  SITE_CONFIG: "readonly",
};

// Service Worker / 登録スクリプト用のグローバル。
// これらを宣言しないと no-undef が本物の未定義参照を検出できない。
const swGlobals = {
  self: "readonly",
  caches: "readonly",
  fetch: "readonly",
  Response: "readonly",
  URL: "readonly",
  console: "readonly",
};

// app.js / sw.js / sw-register.js で共有する検査ルール。
const sharedRules = {
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
};

module.exports = [
  {
    // 生成物・Liquidテンプレート・外部ベンダは解析対象外。
    // (site-config.js は Liquid を含みJSとしてパースできない)
    ignores: [
      "_site/**",
      "assets/js/*.min.js",
      "assets/js/site-config.js",
      "assets/vendor/**",
      "warning-worker/node_modules/**",
    ],
  },
  {
    files: ["assets/js/app.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: browserGlobals,
    },
    rules: sharedRules,
  },
  {
    // Service Worker 本体。window ではなく self / caches を使う。
    files: ["sw.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: swGlobals,
    },
    rules: sharedRules,
  },
  {
    // SW 登録スクリプト（通常のページコンテキスト）。
    files: ["assets/js/sw-register.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: browserGlobals,
    },
    rules: sharedRules,
  },
];
