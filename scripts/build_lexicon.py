#!/usr/bin/env python3
"""Build the bundled 词阶 lexicon from openly licensed sources.

Inputs (downloaded, not committed):
  /tmp/cijie-raw/ecdict.csv
  /tmp/cijie-raw/en_US.txt
  /tmp/cijie-raw/cmn.tsv.bz2
  /tmp/cijie-raw/eng.tsv.bz2
  /tmp/cijie-raw/links.tar.bz2

Optional quality overlays (committed):
  scripts/gloss_overrides.json
  scripts/original_examples.json

Outputs:
  src/data/index.json
  src/data/ex1.json ... ex5.json
  src/data/manifest.json
  src/data/NOTICE.md
"""

from __future__ import annotations

import bz2
import csv
import json
import re
import tarfile
import time
from collections import defaultdict
from pathlib import Path

import zhconv
from wordfreq import get_frequency_dict

ROOT = Path(__file__).resolve().parents[1]
RAW = Path("/tmp/cijie-raw")
DATA = ROOT / "src" / "data"
PAIRS_CACHE = RAW / "pairs.jsonl"

TOKEN_RE = re.compile(r"^[a-z]+(?:'[a-z]+)?$")
POS_RE = re.compile(
    r"^(n|vt|vi|v|aux|adj|adv|prep|conj|pron|interj|int|num|art|a)\.\s*(.*)$",
    re.I,
)
WORD_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
CJK_RE = re.compile(r"[\u4e00-\u9fff]")

POS_ZH = {
    "n": "名词",
    "vt": "动词",
    "vi": "动词",
    "v": "动词",
    "aux": "动词",
    "a": "形容词",
    "adj": "形容词",
    "adv": "副词",
    "prep": "介词",
    "conj": "连词",
    "pron": "代词",
    "num": "数词",
    "interj": "感叹词",
    "int": "感叹词",
    "art": "冠词",
}

# Closed-class items that make a poor first vocabulary lesson.
# Content words stay in wordfreq order. Documented in the README.
STOP = set(
    """
a an the
i me my mine myself
you your yours yourself yourselves
he him his himself
she her hers herself
it its itself
we us our ours ourselves
they them their theirs themselves
this that these those
be am is are was were been being
do does did doing done
have has had having
not no nor
and or but if than then so
of to in on at for with by from as
there here very too just also now once
up out off down away again
all one some any many much more most other another others
every each both few little such same own
what when who whom whose which how where why
into onto upon per via
yes yeah yep oh ah um uh hi hey okay
mr mrs ms dr
gonna wanna gotta
la el de da di le un que je tu il
""".split()
)

ALLOW_SHORT = {"go", "ok", "tv", "pc"}

SKIP_HEAD = {
    "nigger",
    "nigga",
    "faggot",
    "retard",
    "kike",
    "chink",
    "spic",
    "wetback",
    "haha",
    "hahaha",
    "lol",
    "lmao",
    "rofl",
    "omg",
    "wtf",
    "idk",
    "imo",
    "btw",
    "tbh",
    "pics",
    "gop",
    "inc",
    "ltd",
    "corp",
    "iii",
    "vii",
    "viii",
    "xii",
    "dec",
}

# Senses that are real but almost never the meaning a learner needs first.
DEMOTE = {
    "日落",
    "同伙",
    "装罐",
    "罐头",
    "愿能",
    "救球",
    "生殖",
    "幼兽",
    "灰岩井",
    "作废字符",
    "主教",
    "未发酵葡萄汁",
    "葡萄汁",
    "队列",
    "禁忌",
    "井",
    "泉水",
    "源泉",
    "弹性",
    "善行",
    "惊起",
    "蒸馏室",
    "蒸馏",
    "喂",
}

BAD_SENSE_RE = re.compile(
    r"过去式|过去分词|现在分词|第三人称|比较级|最高级|的复数|号元素|缩写|音译|男子名|女子名|姓氏"
)

BAD_SENTENCE = set(
    """
fuck fucking fucked shit shitty bitch bastard asshole cunt dick porn
nigger nigga faggot slut whore suck sucks sucked viagra bullet bullets
kill killed killing murder murdered rape raped naked damn hell sex sexy
suicide drug drugs gun guns bloody idiot stupid nuts dude ass
""".split()
)

IPA_ALIAS = {
    "offence": "offense",
    "defence": "defense",
    "colour": "color",
    "favour": "favor",
    "honour": "honor",
    "labour": "labor",
    "centre": "center",
    "metre": "meter",
    "theatre": "theater",
    "practise": "practice",
    "analyse": "analyze",
    "travelling": "traveling",
    "organise": "organize",
    "organised": "organized",
    "organising": "organizing",
}

IPA_MANUAL = {
    "remix": "ˈriːmɪks",
}

NAME_RE = re.compile(r"男子名|女子名|姓氏")
TOM_RE = re.compile(r"\b(Tom|Mary|John|Mike|Sam|Bob|Alice|Jack|Jim|Peter|Bob)\b")


def valid_token(word: str) -> bool:
    return bool(word) and len(word) <= 24 and TOKEN_RE.match(word) is not None


def cn_len(text: str) -> int:
    return sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")


def parse_exchange(raw: str) -> dict[str, str]:
    out: dict[str, str] = {}
    if not raw:
        return out
    for part in raw.split("/"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        value = value.strip().lower()
        if valid_token(value):
            out[key.strip()] = value
    return out


def clean_sense(raw: str) -> str:
    text = re.sub(r"\[[^\]]*\]", "", raw)
    text = re.sub(r"（[^）]*）", "", text)
    text = re.sub(r"\([^)]*\)", "", text)
    text = text.replace("时侯", "时候")
    if text == "象":
        text = "像"
    text = zhconv.convert(text, "zh-cn")
    return text.strip(" .\t\"'“”")


def good_sense(sense: str) -> bool:
    if not sense or sense in DEMOTE:
        return False
    if any(mark in sense for mark in (".", "…", "...", "．")):
        return False
    if CJK_RE.search(sense) is None:
        return False
    if re.search(r"[A-Za-z0-9]", sense):
        return False
    n = cn_len(sense)
    if n < 1 or n > 6:
        return False
    if BAD_SENSE_RE.search(sense):
        return False
    return True


POS_WEIGHT = {
    "aux": 6,
    "vt": 3,
    "v": 3,
    "vi": 2,
    "a": 2,
    "adj": 2,
    "adv": 2,
    "prep": 2,
    "n": 1,
    "conj": 2,
    "num": 2,
    "interj": 1,
    "int": 1,
}


def sense_score(pos: str, sense: str, index: int) -> int:
    n = cn_len(sense)
    length_score = {1: 6, 2: 7, 3: 6, 4: 4, 5: 2, 6: 1}.get(n, 0)
    return length_score + max(0, 3 - index) + POS_WEIGHT.get(pos, 0)


def gloss_from_translation(translation: str) -> tuple[str, str]:
    text = (translation or "").replace("\\n", "\n").replace("\\r", "")
    text = zhconv.convert(text, "zh-cn")
    scored: list[tuple[int, str, str]] = []
    for line in text.split("\n"):
        line = re.sub(r"\[[^\]]*\]", "", line).strip()
        if not line:
            continue
        match = POS_RE.match(line)
        if match:
            pos = match.group(1).lower()
            rest = match.group(2)
        else:
            pos = ""
            rest = line
        for index, part in enumerate(re.split(r"[,，;；、]", rest)):
            sense = clean_sense(part)
            if not good_sense(sense):
                continue
            if sense.startswith("使") and cn_len(sense) >= 3:
                continue
            scored.append((sense_score(pos, sense, index), pos, sense))
            if index > 6:
                break
    if not scored:
        return "", ""
    scored.sort(key=lambda item: -item[0])
    best_score, best_pos, best = scored[0]
    secondary = None
    for score, pos, sense in scored[1:]:
        if sense == best or score < best_score - 2:
            continue
        if cn_len(sense) > 3:
            continue
        if pos == best_pos and sense[:1] == best[:1]:
            continue
        secondary = sense
        break
    parts = [best] if secondary is None else [best, secondary]
    return "；".join(parts), POS_ZH.get(best_pos, "")


def only_proper_name(translation: str, gloss: str) -> bool:
    if NAME_RE.search(translation or "") is None and "人名" not in (translation or ""):
        return False
    # Keep entries that also have an ordinary short sense (frank, china, may).
    ordinary = [part for part in gloss.split("；") if part and "名" not in part and cn_len(part) <= 4]
    return len(ordinary) == 0


def normalize_ipa(raw: str) -> str:
    match = re.search(r"/([^/]+)/", raw)
    ipa = match.group(1) if match else raw.strip().strip("/")
    ipa = (
        ipa.replace("ɫ", "l")
        .replace("ɹ", "r")
        .replace("ɚ", "ər")
        .replace("ɝ", "ɜr")
        .replace("ɡ", "g")
    )
    ipa = re.sub(r"\s+", "", ipa)
    return ipa


def band_of(rank: int) -> int:
    if rank <= 1000:
        return 1
    if rank <= 3000:
        return 2
    if rank <= 5000:
        return 3
    if rank <= 10000:
        return 4
    return 5


def inflection_of(token: str, lemma: str) -> bool:
    if token.startswith(lemma) and len(token) > len(lemma):
        return True
    if len(lemma) > 2 and lemma.endswith("e"):
        stem = lemma[:-1]
        if token.startswith(stem) and token.endswith(("ing", "ed")):
            return True
    if len(lemma) > 2 and lemma.endswith("y"):
        stem = lemma[:-1]
        if token.startswith(stem) and token.endswith(("ies", "ied")):
            return True
    return False


def load_ecdict() -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    translations: dict[str, str] = {}
    exchanges: dict[str, dict[str, str]] = {}
    with (RAW / "ecdict.csv").open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            word = row["word"].strip().lower()
            if not valid_token(word):
                continue
            translation = row.get("translation") or ""
            if word not in translations or len(translation) > len(translations[word]):
                translations[word] = translation
            exchange = parse_exchange(row.get("exchange") or "")
            if exchange:
                exchanges[word] = exchange
    return translations, exchanges


def load_ipa() -> dict[str, str]:
    ipa: dict[str, str] = {}
    with (RAW / "en_US.txt").open(encoding="utf-8") as handle:
        for line in handle:
            if "\t" not in line:
                continue
            word, raw = line.rstrip("\n").split("\t", 1)
            key = word.strip().lower()
            if valid_token(key) and key not in ipa:
                ipa[key] = normalize_ipa(raw)
    return ipa


def simple_inflections(word: str) -> set[str]:
    forms = {word}
    if word.endswith("y") and len(word) > 2 and word[-2] not in "aeiou":
        stem = word[:-1]
        forms.add(stem + "ies")
        forms.add(stem + "ied")
    elif word.endswith("e"):
        forms.add(word + "d")
        forms.add(word + "s")
        forms.add(word[:-1] + "ing")
    else:
        forms.add(word + "s")
        forms.add(word + "ed")
        forms.add(word + "ing")
        if (
            len(word) > 2
            and word[-1] not in "aeiouwxy"
            and word[-2] in "aeiou"
            and word[-3] not in "aeiou"
        ):
            forms.add(word + word[-1] + "ed")
            forms.add(word + word[-1] + "ing")
    if word.endswith(("s", "x", "z", "ch", "sh")):
        forms.add(word + "es")
    return {form for form in forms if valid_token(form)}


def load_pairs() -> list[tuple[str, str]]:
    if PAIRS_CACHE.exists() and PAIRS_CACHE.stat().st_size > 0:
        pairs: list[tuple[str, str]] = []
        with PAIRS_CACHE.open(encoding="utf-8") as handle:
            for line in handle:
                row = json.loads(line)
                pairs.append((row["en"], row["zh"]))
        print(f"pairs cache {len(pairs)}", flush=True)
        return pairs

    started = time.time()
    cmn: dict[int, str] = {}
    with bz2.open(RAW / "cmn.tsv.bz2", "rt", encoding="utf-8") as handle:
        for line in handle:
            sid, _lang, text = line.rstrip("\n").split("\t", 2)
            cmn[int(sid)] = zhconv.convert(text.strip(), "zh-cn")
    cmn_ids = set(cmn)
    print(f"cmn sentences {len(cmn)}", flush=True)

    foreign: dict[int, str] = {}
    with tarfile.open(RAW / "links.tar.bz2", "r:bz2") as archive:
        member = archive.next()
        assert member is not None
        extracted = archive.extractfile(member)
        assert extracted is not None
        count = 0
        for raw in extracted:
            count += 1
            if count % 5_000_000 == 0:
                print(f"links {count} kept {len(foreign)}", flush=True)
            raw = raw.strip()
            tab = raw.find(b"\t")
            if tab < 0:
                continue
            try:
                left = int(raw[:tab])
                right = int(raw[tab + 1 :])
            except ValueError:
                continue
            left_is = left in cmn_ids
            right_is = right in cmn_ids
            if left_is == right_is:
                continue
            if left_is:
                foreign.setdefault(right, cmn[left])
            else:
                foreign.setdefault(left, cmn[right])
    print(f"foreign ids {len(foreign)} in {time.time() - started:.1f}s", flush=True)

    pairs = []
    seen: set[str] = set()
    with bz2.open(RAW / "eng.tsv.bz2", "rt", encoding="utf-8") as handle:
        for line in handle:
            sid, _lang, text = line.rstrip("\n").split("\t", 2)
            zh = foreign.get(int(sid))
            if not zh:
                continue
            english = text.strip().replace("\u3000", " ")
            key = re.sub(r"\s+", " ", english).lower()
            if key in seen:
                continue
            if cn_len(zh) < 2 or cn_len(zh) > 40:
                continue
            if not (4 <= len(english.split()) <= 24):
                continue
            seen.add(key)
            pairs.append((english, zh))
    with PAIRS_CACHE.open("w", encoding="utf-8") as handle:
        for english, zh in pairs:
            handle.write(json.dumps({"en": english, "zh": zh}, ensure_ascii=False) + "\n")
    print(f"pairs {len(pairs)}", flush=True)
    return pairs


def sentence_ok(english: str, zh: str, allow: set[str] | None = None) -> bool:
    words = english.split()
    if not (4 <= len(words) <= 22):
        return False
    if cn_len(zh) < 2 or cn_len(zh) > 40:
        return False
    lowered = {word.strip(".,!?;:\"'“”()").lower() for word in words}
    blocked = lowered & BAD_SENTENCE
    if allow:
        blocked -= {item.lower() for item in allow}
    if blocked:
        return False
    if re.search(r"https?://|www\.|@|#\w", english):
        return False
    if sum(1 for ch in english if ord(ch) > 127) > 2:
        return False
    return True


def sentence_score(english: str, zh: str, surface: str, lemma: str) -> int:
    words = english.split()
    n = len(words)
    score = 0
    if 7 <= n <= 12:
        score += 6
    elif 5 <= n <= 16:
        score += 4
    else:
        score += 1
    if 4 <= cn_len(zh) <= 24:
        score += 3
    if surface.lower() == lemma:
        score += 2
    if TOM_RE.search(english):
        score -= 3
    if any(ch.isdigit() for ch in english):
        score -= 2
    if english.endswith("?"):
        score -= 1
    return score


def display_word(word: str) -> str:
    special = {"ok": "OK", "tv": "TV", "pc": "PC"}
    return special.get(word, word)


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def main() -> None:
    started = time.time()
    print("loading ecdict", flush=True)
    translations, exchanges = load_ecdict()
    print(f"ecdict {len(translations)}", flush=True)
    ipa_map = load_ipa()
    print(f"ipa {len(ipa_map)}", flush=True)

    form_to_lemma: dict[str, str] = {}
    for lemma, exchange in exchanges.items():
        for code in ("p", "d", "i", "3", "s", "r", "t"):
            form = exchange.get(code)
            if form and form != lemma and valid_token(form):
                form_to_lemma.setdefault(form, lemma)

    def lemma_of(token: str) -> str | None:
        if not valid_token(token) or "'" in token:
            return None
        mapped = form_to_lemma.get(token)
        translation = translations.get(token, "")
        if mapped and mapped != token and (BAD_SENSE_RE.search(translation) or inflection_of(token, mapped)):
            return mapped
        return token

    print("aggregating frequency", flush=True)
    aggregated: dict[str, float] = defaultdict(float)
    for token, freq in get_frequency_dict("en", wordlist="best").items():
        if " " in token or not valid_token(token.lower()):
            continue
        lemma = lemma_of(token.lower())
        if not lemma or lemma in STOP or lemma in SKIP_HEAD:
            continue
        aggregated[lemma] += freq

    gloss_overrides = load_json(ROOT / "scripts" / "gloss_overrides.json")
    ranked = sorted(aggregated.items(), key=lambda item: (-item[1], item[0]))
    selected: list[dict] = []
    for lemma, _freq in ranked:
        if lemma in STOP or lemma in SKIP_HEAD or "'" in lemma:
            continue
        if len(lemma) <= 2 and lemma not in ALLOW_SHORT:
            continue
        if re.search(r"[aeiouy]", lemma) is None and lemma not in ALLOW_SHORT:
            continue
        override = gloss_overrides.get(lemma)
        if override:
            gloss = override["gloss"]
            pos = override["pos"]
        else:
            gloss, pos = gloss_from_translation(translations.get(lemma, ""))
        raw_translation = translations.get(lemma, "")
        if NAME_RE.search(raw_translation) or "人名" in raw_translation:
            continue
        if not gloss:
            continue
        if "罗马数字" in gloss or "缩写" in raw_translation and len(lemma) <= 4:
            continue
        selected.append({"lemma": lemma, "gloss": gloss, "pos": pos})
        if len(selected) >= 20000:
            break
    print(f"selected {len(selected)}", flush=True)

    forms_of: dict[str, set[str]] = {}
    form_index: dict[str, set[str]] = defaultdict(set)
    for item in selected:
        lemma = item["lemma"]
        forms = simple_inflections(lemma)
        exchange = exchanges.get(lemma, {})
        for code in ("p", "d", "i", "3", "s", "r", "t"):
            form = exchange.get(code)
            if form and valid_token(form):
                forms.add(form)
        forms = {form for form in forms if len(form) >= 3 or form == lemma}
        forms_of[lemma] = forms
        for form in forms:
            form_index[form].add(lemma)

    print("scoring sentences", flush=True)
    buckets: dict[str, list[tuple[int, str, str, str]]] = defaultdict(list)
    for english, zh in load_pairs():
        if not sentence_ok(english, zh):
            continue
        matched: dict[str, str] = {}
        for token in WORD_RE.findall(english):
            key = token.lower()
            for lemma in form_index.get(key, ()):
                if lemma not in matched:
                    matched[lemma] = token
        if not matched:
            continue
        for lemma, surface in matched.items():
            score = sentence_score(english, zh, surface, lemma)
            bucket = buckets[lemma]
            if any(existing[1] == english for existing in bucket):
                continue
            bucket.append((score, english, zh, surface))
            if len(bucket) > 24:
                bucket.sort(key=lambda item: -item[0])
                del bucket[8:]

    originals = load_json(ROOT / "scripts" / "original_examples.json")

    def original_rows(lemma: str) -> list[tuple[str, str, str]]:
        rows = []
        for item in originals.get(lemma, []):
            english = item["en"].strip()
            zh = item["zh"].strip()
            surface = None
            for form in sorted(forms_of[lemma], key=len, reverse=True):
                match = re.search(rf"\b{re.escape(form)}\b", english, re.I)
                if match:
                    surface = match.group(0)
                    break
            if surface and sentence_ok(english, zh, allow=forms_of[lemma] | {lemma}):
                rows.append((english, zh, surface))
        return rows

    examples: dict[int, list[list[str]]] = {}
    gaps: list[str] = []
    ipa_missing = 0
    index_rows = []
    source_counts = {"tatoeba": 0, "original": 0}
    two_examples = 0

    for rank, item in enumerate(selected, start=1):
        lemma = item["lemma"]
        bucket = sorted(buckets.get(lemma, []), key=lambda row: -row[0])
        tatoeba = [row for row in bucket if row[0] >= 3][:4]
        chosen: list[list[str]] = []
        handwritten = original_rows(lemma)
        best = tatoeba[0][0] if tatoeba else -999
        if handwritten and (best < 5 or rank <= 0):
            for english, zh, surface in handwritten[:2]:
                chosen.append([english, zh, surface, "o"])
        if len(chosen) < 2:
            for _score, english, zh, surface in tatoeba:
                if any(existing[0] == english for existing in chosen):
                    continue
                chosen.append([english, zh, surface, "t"])
                if len(chosen) >= 2:
                    break
        if len(chosen) < 2 and handwritten:
            for english, zh, surface in handwritten:
                if any(existing[0] == english for existing in chosen):
                    continue
                chosen.append([english, zh, surface, "o"])
                if len(chosen) >= 2:
                    break
        chosen = chosen[:2]
        if rank <= 5000 and not chosen:
            gaps.append(f"{rank}\t{lemma}\t{item['pos']}\t{item['gloss']}")
        if chosen:
            examples[rank] = chosen
            if len(chosen) >= 2:
                two_examples += 1
            for row in chosen:
                source_counts["original" if row[3] == "o" else "tatoeba"] += 1
        ipa = IPA_MANUAL.get(lemma) or ipa_map.get(lemma) or ipa_map.get(IPA_ALIAS.get(lemma, ""), "")
        if not ipa:
            for form in forms_of[lemma]:
                if form in ipa_map:
                    ipa = ipa_map[form]
                    break
        if rank <= 5000 and not ipa:
            ipa_missing += 1
        index_rows.append([rank, display_word(lemma), ipa, item["pos"], item["gloss"]])

    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "index.json").write_text(
        json.dumps(index_rows, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    band_examples: dict[int, dict[str, list]] = {1: {}, 2: {}, 3: {}, 4: {}, 5: {}}
    for rank, rows in examples.items():
        band_examples[band_of(rank)][str(rank)] = rows
    for band, payload in band_examples.items():
        (DATA / f"ex{band}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    def covered(limit: int) -> int:
        return sum(1 for rank in range(1, min(limit, len(index_rows)) + 1) if rank in examples)

    stats = {
        "words": len(index_rows),
        "withExample": {str(limit): covered(limit) for limit in (1000, 3000, 5000, 10000, len(index_rows))},
        "withTwoExamples": two_examples,
        "ipaMissingIn5000": ipa_missing,
        "gapsIn5000": len(gaps),
        "exampleRows": source_counts,
    }
    bands = []
    for band, name, detail, start, end in (
        (1, "第一阶", "最常用 1000 个实词", 1, 1000),
        (2, "第二阶", "词频 1001–3000", 1001, 3000),
        (3, "第三阶", "词频 3001–5000", 3001, 5000),
        (4, "第四阶", "词频 5001–10000", 5001, 10000),
        (5, "第五阶", "词频 10001–20000", 10001, 20000),
    ):
        count = sum(1 for row in index_rows if start <= row[0] <= end)
        bands.append({"id": band, "name": name, "detail": detail, "from": start, "to": end, "count": count})
    manifest = {"version": 1, "stats": stats, "bands": bands}
    (DATA / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (DATA / "NOTICE.md").write_text(NOTICE, encoding="utf-8")
    (RAW / "gaps.tsv").write_text("\n".join(gaps), encoding="utf-8")

    print(json.dumps(stats, ensure_ascii=False, indent=2))
    print("--- samples ---")
    for rank in (1, 2, 3, 15, 40, 80, 200, 500, 1000, 2500, 5000, 8000, 15000):
        if rank > len(index_rows):
            continue
        row = index_rows[rank - 1]
        ex = examples.get(rank, [])
        preview = ex[0][0] if ex else "—"
        print(f"{rank:5} {row[1]:16} {row[3]:6} {row[4]:20} {row[2]:18} {preview}")
    print(f"done in {time.time() - started:.1f}s gaps {len(gaps)}")


NOTICE = """# 词库说明

本目录的 `index.json`、`ex1.json`–`ex5.json`、`manifest.json` 由 `scripts/build_lexicon.py` 生成，供词阶离线使用。组合后的词库以 CC BY-SA 4.0 授权，因为其中的词频数据要求以相同方式共享。

## 来源

- **词频与词条顺序**：wordfreq（Robyn Speer），代码 Apache-2.0，词频数据 CC BY-SA 4.0。数据综合了 Wikipedia、OpenSubtitles、ParaCrawl、Leeds Internet Corpus、Google Books Ngrams，以及 Marc Brysbaert 等人的 SUBTLEX 词表（作者同意可随 wordfreq 再分发）。致谢请写 Robyn Speer，并保留 SUBTLEX 与 Google Books Ngram Viewer 的出处。
- **中文释义与词形变化**：ECDICT（Linwei，MIT）。只用了中文释义和屈折变化，用来合并 ran/run 这类形式、并生成简短中文义项。没有使用其中的牛津、柯林斯标签，也没有使用其音标字段。ECDICT 作者说明基础来自开源词典 cdict 与社区修订。
- **音标**：open-dict-data/ipa-dict 的美国英语表，基于 CMU Pronouncing Dictionary（卡内基梅隆大学，BSD 风格许可）及 cmudict-ipa（MIT）。为了手机上更好认，把美音里的 ɹ、ɫ 显示成 r、l。
- **例句**：Tatoeba 项目的英语–普通话对照句（CC BY 2.0 FR），经 OPUS / Tatoeba 导出文件对齐。界面里这些句子标为 Tatoeba。缺句或原句不合适时，用词阶编写的短句补上，标为原创。
- **未收入**：牛津、韦氏、柯林斯、有道、金山等专有词典的正文；也没有抓取商业网站。

## 词条怎么筛

wordfreq 的顺序先把屈折形式并回词元（found → find），再去掉冠词、代词、be/do/have、最常见的连词介词和单纯功能词，然后按频率重排。所以第一阶是最常用的 1000 个实词，不是 the / of / and。人名条目（男子名、女子名、姓氏）已跳过。

## 链接

- wordfreq：https://github.com/rspeer/wordfreq
- CC BY-SA 4.0：https://creativecommons.org/licenses/by-sa/4.0/
- ECDICT：https://github.com/skywind3000/ECDICT
- CMUdict：https://github.com/cmusphinx/cmudict
- ipa-dict：https://github.com/open-dict-data/ipa-dict
- Tatoeba：https://tatoeba.org  ·  https://creativecommons.org/licenses/by/2.0/fr/
- Google Books Ngram Viewer：https://books.google.com/ngrams
- SUBTLEX：https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexus
"""


if __name__ == "__main__":
    main()
