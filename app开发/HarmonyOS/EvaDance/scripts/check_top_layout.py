"""Check the five guest tabs through the official emulator UI-test driver."""
import argparse
import json
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)

def call(*command):
    return subprocess.check_output(["hdc", *command], stderr=subprocess.DEVNULL, timeout=20)

def walk(node):
    yield node.get("attributes", {})
    for child in node.get("children", []):
        yield from walk(child)

def bounds(node):
    return [int(value) for value in re.findall(r"\d+", node.get("bounds", ""))]

def read(name):
    call("shell", "uitest", "dumpLayout", "-p", "/data/local/tmp/swod-layout-test.json", "-b", "cn.com.swod.evadance")
    path = args.output / (name + ".json")
    call("file", "recv", "/data/local/tmp/swod-layout-test.json", str(path))
    return json.loads(path.read_text())

results = []
for name in ["线上学院", "线下课", "赛事", "商城", "个人中心"]:
    current = read("current")
    app = next(a for a in walk(current) if a.get("type") == "root" and a.get("bundleName") == "cn.com.swod.evadance")
    left, top, right, bottom = bounds(app)
    tabs = [a for a in walk(current) if a.get("text") == name and bounds(a)[1] > bottom * .8]
    if not tabs:
        raise RuntimeError("Tab not found: " + name)
    x1, y1, x2, y2 = bounds(tabs[-1])
    call("shell", "uitest", "uiInput", "click", str((x1 + x2) // 2), str((y1 + y2) // 2))
    current = read(name)
    labels = [a for a in walk(current) if a.get("visible") == "true" and (a.get("text") or a.get("hint")) and top <= bounds(a)[1] < bottom * .8]
    first = min(labels, key=lambda a: bounds(a)[1])
    gap = (bounds(first)[1] - top) * 360 / (right - left)
    results.append({"page": name, "firstYpx": bounds(first)[1], "topGapVp": gap, "passed": 0 <= gap <= 60})
(args.output / "layout-check.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(results, ensure_ascii=False))
raise SystemExit(0 if all(row["passed"] for row in results) else 1)
