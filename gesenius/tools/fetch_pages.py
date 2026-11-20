"""Fetch wikitext + proofread level for every Page: of the Gesenius djvu index."""
import json, sys, time, urllib.parse, urllib.request, pathlib
API = "https://en.wikisource.org/w/api.php"
UA = "gesenius-reformat/0.1 (personal reformatting; mitchellpalermo@gmail.com)"
PREFIX = "Page:Gesenius' Hebrew Grammar (1910 Kautzsch-Cowley edition).djvu/"
out = pathlib.Path(sys.argv[1])
def get(params):
    params = {**params, "format": "json", "maxlag": "5"}
    for attempt in range(8):
        try:
            req = urllib.request.Request(API, data=urllib.parse.urlencode(params).encode(), headers={"User-Agent": UA})
            return json.load(urllib.request.urlopen(req, timeout=120))
        except urllib.error.HTTPError as e:
            if e.code in (429, 503): time.sleep(15 * (attempt + 1)); continue
            raise
    raise RuntimeError("gave up")
pages = {}
nums = list(range(1, 627))
for i in range(0, len(nums), 50):
    titles = "|".join(PREFIX + str(n) for n in nums[i:i+50])
    d = get({"action": "query", "prop": "revisions|proofread", "rvprop": "content", "rvslots": "main", "titles": titles})
    for p in d["query"]["pages"].values():
        n = int(p["title"].rsplit("/", 1)[1])
        if "missing" in p: continue
        pages[n] = {"quality": p.get("proofread", {}).get("quality"), "text": p["revisions"][0]["slots"]["main"]["*"]}
    print("batch", i, len(pages), flush=True)
    time.sleep(3)
out.write_text(json.dumps(pages, ensure_ascii=False))
