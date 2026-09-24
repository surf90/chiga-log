"""配信 CSS に埋め込む SVG アイコンの回帰テスト。"""

import re
from pathlib import Path
from urllib.parse import unquote
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
ICON_PATTERN = re.compile(
    r'--icon-([\w-]+):\s*url\("data:image/svg\+xml,([^"]+)"\)'
)
EXPECTED_ICONS = {"warning", "check", "wind-arrow", "refresh"}


def test_inline_svg_icons_survive_minification():
    """ソース版・配信版の全 data URI が実際に XML として読めること。"""

    for relative_path in ("assets/css/style.css", "assets/css/style.min.css"):
        css = (ROOT / relative_path).read_text(encoding="utf-8")
        icons = dict(ICON_PATTERN.findall(css))

        assert set(icons) == EXPECTED_ICONS
        for name, payload in icons.items():
            assert not any(char.isspace() for char in payload), (
                f"{relative_path}: --icon-{name} contains unencoded whitespace"
            )
            root = ElementTree.fromstring(unquote(payload))
            assert root.tag == "{http://www.w3.org/2000/svg}svg"
            assert root.attrib["viewBox"] == "0 0 24 24"
            assert root.findall("{http://www.w3.org/2000/svg}path")
