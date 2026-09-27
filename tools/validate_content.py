#!/usr/bin/env python3
"""Validate The Mantle Library content (stdlib only).

Checks:
  1. content/works.json parses as JSON.
  2. Top-level "works" array exists; every work has all required fields,
     and every section / audio entry has its required fields.
  3. No duplicate work ids.
  4. Every audio file referenced exists on disk.
  5. Every disc-label "art" image referenced by an audio entry exists on disk.

Exits 0 on success, 1 on any failure, with clear messages on stderr.

Usage:  python3 tools/validate_content.py   (run from the site root)
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKS_PATH = os.path.join(ROOT, "content", "works.json")

WORK_FIELDS = [
    "id", "title_ar", "title_en",
    "author", "author_dates", "description_en",
    "sections", "audio",
]
SECTION_FIELDS = ["heading", "units"]
AUDIO_FIELDS = ["file", "title", "artist", "date", "label", "credit"]

errors = []


def fail(msg):
    errors.append(msg)


def main():
    # 1. Parse works.json
    try:
        with open(WORKS_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        fail("content/works.json not found at %s" % WORKS_PATH)
        return report()
    except json.JSONDecodeError as exc:
        fail("content/works.json is not valid JSON: %s" % exc)
        return report()

    works = data.get("works")
    if not isinstance(works, list):
        fail('content/works.json must contain a top-level "works" array.')
        return report()
    if not works:
        fail('"works" array is empty.')

    # 2 & 3. Required fields and duplicate ids
    seen_ids = set()
    for idx, work in enumerate(works):
        where = "works[%d]" % idx
        if not isinstance(work, dict):
            fail("%s is not an object." % where)
            continue

        wid = work.get("id")
        if wid:
            where = 'work "%s"' % wid
            if wid in seen_ids:
                fail('Duplicate work id: "%s".' % wid)
            seen_ids.add(wid)

        for field in WORK_FIELDS:
            if field not in work:
                fail('%s is missing required field "%s".' % (where, field))
            elif field in ("id", "title_ar", "title_en",
                           "author", "author_dates", "description_en"):
                if not isinstance(work[field], str) or not work[field].strip():
                    fail('%s field "%s" must be a non-empty string.' % (where, field))

        sections = work.get("sections", [])
        if isinstance(sections, list):
            for s_idx, section in enumerate(sections):
                s_where = "%s sections[%d]" % (where, s_idx)
                if not isinstance(section, dict):
                    fail("%s is not an object." % s_where)
                    continue
                for field in SECTION_FIELDS:
                    if field not in section:
                        fail('%s is missing required field "%s".' % (s_where, field))
                units = section.get("units", [])
                if not isinstance(units, list):
                    fail('%s field "units" must be an array.' % s_where)
                    continue
                for u_idx, unit in enumerate(units):
                    u_where = "%s units[%d]" % (s_where, u_idx)
                    if not isinstance(unit, dict):
                        fail("%s is not an object." % u_where)
                        continue
                    if "ar" not in unit:
                        fail('%s is missing required field "ar".' % u_where)
                    elif not isinstance(unit["ar"], str) or not unit["ar"].strip():
                        fail('%s field "ar" must be a non-empty string.' % u_where)
                    if "en" not in unit:
                        fail('%s is missing required field "en" (use null when untranslated).' % u_where)
                    elif unit["en"] is not None and not isinstance(unit["en"], str):
                        fail('%s field "en" must be a string or null.' % u_where)
        else:
            fail('%s field "sections" must be an array.' % where)

        audio = work.get("audio", [])
        if isinstance(audio, list):
            for a_idx, rec in enumerate(audio):
                a_where = "%s audio[%d]" % (where, a_idx)
                if not isinstance(rec, dict):
                    fail("%s is not an object." % a_where)
                    continue
                for field in AUDIO_FIELDS:
                    if field not in rec:
                        fail('%s is missing required field "%s".' % (a_where, field))
                # 4. Referenced audio file exists on disk
                rel = rec.get("file")
                if isinstance(rel, str) and rel:
                    path = os.path.join(ROOT, rel)
                    if not os.path.isfile(path):
                        fail('%s references missing file: "%s".' % (a_where, rel))
                # 5. Referenced disc-label art image exists on disk
                art = rec.get("art")
                if isinstance(art, str) and art:
                    art_path = os.path.join(ROOT, art)
                    if not os.path.isfile(art_path):
                        fail('%s references missing art file: "%s".' % (a_where, art))
        else:
            fail('%s field "audio" must be an array.' % where)

    return report()


def report():
    if errors:
        for msg in errors:
            print("FAIL: %s" % msg, file=sys.stderr)
        print("\n%d problem(s) found." % len(errors), file=sys.stderr)
        return 1
    print("OK: content/works.json is valid; all required fields present; "
          "no duplicate ids; all referenced audio and art files exist on disk.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
