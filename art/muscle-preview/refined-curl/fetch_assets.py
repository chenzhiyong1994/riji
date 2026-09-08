"""下载锁定版本的 MakeHuman CC0 核心图形资产，不安装或执行上游代码。"""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
COMMIT = "a8bc2d54ff0ac92e78ff71431b1023eda42bf482"
PATHS = [
    "LICENSE.md", "LICENSE.ASSETS.md",
    "makehuman/data/3dobjs/base.obj",
    "makehuman/data/rigs/default.mhskel",
    "makehuman/data/rigs/default_weights.mhw",
    "makehuman/data/targets/macrodetails/caucasian-male-young.target",
    "makehuman/data/targets/macrodetails/asian-male-young.target",
    "makehuman/data/targets/macrodetails/african-male-young.target",
    "makehuman/data/targets/macrodetails/universal-male-young-maxmuscle-averageweight.target",
    "makehuman/data/targets/macrodetails/universal-male-young-averagemuscle-averageweight.target",
]


def main():
    folder = ROOT / "source" / "makehuman"
    folder.mkdir(parents=True, exist_ok=True)
    records = []
    for name in PATHS:
        url = f"https://raw.githubusercontent.com/makehumancommunity/makehuman/{COMMIT}/{name}"
        original = urlopen(url, timeout=60).read()
        source_text = original.decode("utf-8")
        normalized_text = "\n".join(line.rstrip() for line in source_text.splitlines()).rstrip("\n")+"\n"
        assert source_text.split() == normalized_text.split(), "Whitespace cleanup must preserve every token"
        if name == "LICENSE.md":
            # 上游七个等号的 Setext 标题被 Git 当作冲突标记；仅改标题的 Markdown 写法。
            assert normalized_text.startswith("LICENSE\n=======\n")
            normalized_text = "# LICENSE\n"+normalized_text.split("\n", 2)[2]
        data = normalized_text.encode("utf-8")
        path = folder / Path(name).name
        path.write_bytes(data)
        records.append({"file": path.relative_to(ROOT).as_posix(), "url": url, "upstream_sha256": hashlib.sha256(original).hexdigest(), "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
        print(f"Saved {path.name}: {len(data)}", flush=True)
    (ROOT / "source" / "manifest.json").write_text(json.dumps({"upstream_commit": COMMIT, "license": "CC0-1.0 (core graphics assets)", "license_page": "https://static.makehumancommunity.org/about/license.html", "normalization": "UTF-8 LF; trailing whitespace and trailing empty lines removed; LICENSE.md first heading converted from Setext to ATX; legal text and all data tokens unchanged", "files": records}, indent=2)+"\n", encoding="utf-8")


if __name__ == "__main__":
    main()
