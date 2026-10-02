#!/usr/bin/env python3
import json, re

# Load raw hadiths from /tmp/mishkat_qualities_raw.json
with open("/tmp/mishkat_qualities_raw.json", "r", encoding="utf-8") as f:
    raw_list = json.load(f)

hadith_map = {h["mishkat_num"]: h for h in raw_list}

def clean_arabic(ar):
    # Ensure clean spacing
    return ar.strip()

def clean_modern(en):
    # Clean up whitespace and linebreaks
    lines = [l.strip() for l in en.splitlines() if l.strip()]
    return " ".join(lines)

def make_unit(n, raw_h, matthews_text, modern_aid, source_tag):
    return {
        "n": n,
        "ar": clean_arabic(raw_h["ar"]),
        "en": matthews_text.strip(),
        "en2": modern_aid.strip(),
        "note": f"Mishkāt report {raw_h['mishkat_num']} · {source_tag}"
    }

print(f"Loaded {len(hadith_map)} hadiths from raw extraction.")
