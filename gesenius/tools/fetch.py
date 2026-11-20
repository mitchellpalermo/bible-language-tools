"""Fetch rendered Wikisource HTML for Gesenius pages, cached on disk, politely."""
import json, sys, time, urllib.parse, urllib.request, pathlib, re
API = "https://en.wikisource.org/w/api.php"
UA = "gesenius-reformat/0.1 (personal reformatting; mitchellpalermo@gmail.com)"
OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

def get(params):
    params = {**params, "format": "json", "maxlag": "5"}
    for attempt in range(6):
        try:
            req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
            return json.load(urllib.request.urlopen(req, timeout=60))
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(10 * (attempt + 1)); continue
            raise
    raise RuntimeError("gave up")

for title in sys.argv[2:]:
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", title)[:120] + ".json"
    path = OUT / name
    if path.exists():
        continue
    d = get({"action": "parse", "page": title, "prop": "text|displaytitle", "disablelimitreport": 1, "disableeditsection": 1})
    path.write_text(json.dumps({"title": title, "html": d["parse"]["text"]["*"]}, ensure_ascii=False))
    print("fetched", title, flush=True)
    time.sleep(1.5)
