"""Light, rule-based wording updates for the Kautzsch–Cowley English text.

Every rule here is listed, in plain words, in the edition note at the front of
the book, so a reader can always reverse it. Rules only ever touch English
running text — never Hebrew, never a transliteration, never a quoted title.

Deliberately NOT modernized:
  * "thou", "thee", "ye" in glosses. They mark singular vs plural "you", which
    is grammatical information a Hebrew grammar needs.
  * Technical terms (Dageš forte, Pathaḥ furtivum, Hiphʿîl, …) and § letters,
    because other books cite them as they stand.
  * Abbreviations of grammatical terms (Perf., Imperf., constr. st.).
"""
import re

# (pattern, replacement, description shown in the edition note)
WORD_RULES = [
    (r"connexion", "connection", "connexion → connection"),
    (r"inflexion", "inflection", "inflexion → inflection"),
    (r"reflexion", "reflection", "reflexion → reflection"),
    (r"shewn", "shown", "shew, shewn → show, shown"),
    (r"shewing", "showing", None),
    (r"shewed", "showed", None),
    (r"shews", "shows", None),
    (r"shew", "show", None),
    (r"whilst", "while", "whilst → while"),
    (r"amongst", "among", "amongst → among"),
    (r"to-day", "today", "to-day, to-morrow → today, tomorrow"),
    (r"to-morrow", "tomorrow", None),
]

PHRASE_RULES = [
    (re.compile(r"&c\.?"), "etc.", "&c. → etc."),
    (re.compile(r"\bviz\.\s*"), "namely ", "viz. → namely"),
]


def _case_like(src: str, repl: str) -> str:
    if src.isupper():
        return repl.upper()
    if src[:1].isupper():
        return repl[:1].upper() + repl[1:]
    return repl


_WORD_RES = [
    (re.compile(r"\b" + pat + r"\b", re.IGNORECASE), repl) for pat, repl, _ in WORD_RULES
]


def modernize(text: str) -> str:
    for rx, repl in _WORD_RES:
        text = rx.sub(lambda m, r=repl: _case_like(m.group(0), r), text)
    for rx, repl, _ in PHRASE_RULES:
        text = rx.sub(repl, text)
    # "etc.." when the source had "&c." at the end of a sentence
    text = text.replace("etc..", "etc.")
    return text


def rule_descriptions() -> list[str]:
    out = [d for _, _, d in WORD_RULES if d]
    out += [d for _, _, d in PHRASE_RULES]
    return out
