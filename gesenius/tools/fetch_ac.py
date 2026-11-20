"""Fetch the 'Additions and Corrections' subpages that pages transclude."""
import json, sys, time, urllib.parse, urllib.request, pathlib
API = "https://en.wikisource.org/w/api.php"
UA = "gesenius-reformat/0.1 (personal reformatting; mitchellpalermo@gmail.com)"
subs = ["63", "65", "79", "123", "175", "177", "232", "236", "273"]
titles = "|".join(["Gesenius' Hebrew Grammar/Additions and Corrections"] + [f"Gesenius' Hebrew Grammar/Additions and Corrections/{s}" for s in subs])
req = urllib.request.Request(API, data=urllib.parse.urlencode({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main", "titles": titles, "format": "json"}).encode(), headers={"User-Agent": UA})
d = json.load(urllib.request.urlopen(req, timeout=60))
out = {p["title"]: p["revisions"][0]["slots"]["main"]["*"] for p in d["query"]["pages"].values() if "revisions" in p}
pathlib.Path(sys.argv[1]).write_text(json.dumps(out, ensure_ascii=False, indent=1))
