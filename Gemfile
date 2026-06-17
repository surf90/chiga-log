# GitHub Pages 互換のローカルプレビュー用。
# 本番は GitHub Pages 側が同等の Jekyll でビルドするため、このファイルはローカル開発専用。
source "https://rubygems.org"

# GitHub Pages と同じ Jekyll / プラグイン構成（jekyll-sitemap 等を内包）
gem "github-pages", group: :jekyll_plugins

# Ruby 3.0+ は webrick が標準添付されないため、jekyll serve 用に明示
gem "webrick", "~> 1.8"

# Windows はタイムゾーン情報(zoneinfo)を持たないため、tzinfo データを同梱
gem "tzinfo-data", platforms: [:mingw, :x64_mingw, :mswin, :jruby]
