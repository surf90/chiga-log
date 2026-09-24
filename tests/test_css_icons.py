"""配信 CSS のインライン SVG が minify 後も有効であることを確認する。"""

import re
from pathlib import Path
from urllib.parse import unquote
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
ICON_NAMES = {"warning", "check", "wind-arrow", "refresh"}
ICON_RE = re.compile(r'--icon-([\w-]+):\s*url\("data:image/svg\+xml,([^\"]+)"\)')
SVG_NS = "{http://www.w3.org/2000/svg}"


def extract_icons(filename):
    css = (ROOT / "assets" / "css" / filename).read_text(encoding="utf-8")
    matches = ICON_RE.findall(css)
    assert len(matches) == len(ICON_NAMES)
    assert {name for name, _ in matches} == ICON_NAMES

    icons = {}
    for name, uri in matches:
        assert not re.search(r"\s", uri), f"{filename}: {name} に生の空白がある"
        svg = ElementTree.fromstring(unquote(uri))
        assert svg.tag == f"{SVG_NS}svg"
        assert svg.attrib["viewBox"] == "0 0 24 24"
        paths = svg.findall(f"{SVG_NS}path")
        assert paths and all(path.attrib.get("d") for path in paths)
        icons[name] = ElementTree.tostring(svg)
    return icons


def test_inline_svg_icons_survive_minification():
    assert extract_icons("style.css") == extract_icons("style.min.css")
