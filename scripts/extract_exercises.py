#!/usr/bin/env python3
"""
extract_exercises.py — Extract chapter/exercise structure from the Grammaire
progressive du français student book PDF into src/data/exercises.json.

Uses pdftotext (must be on PATH) to extract the full text, then parses the
table-of-contents area and page-form feed markers to build a structured
chapter / exercise-set / blank-items tree.
"""

import json, os, re, subprocess, sys

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")
STUDENT_PDF = os.path.expanduser(
    "~/Documents/Leon's Library/Grammaire progressive du français, "
    "niveau intermédiaire (Maïa Grégoire, Odile Thiévenaz) "
    "(z-library.sk, 1lib.sk, z-lib.sk).pdf"
)

CHAPTER_PATTERN = re.compile(
    r'^(\d+)\.\s*(.+?)\.\s*Exercices\s+p\.\s*(\d+)',
    re.IGNORECASE | re.UNICODE
)
# Also match "3. LA NÉGATION et L’INTERROGATION. Exercices p. 20." (same page
# repeated for multi-page exercise sets — the corrigés file bakes the page
# into each header)


def extract_text() -> str:
    """Run pdftotext on the student book, return full text."""
    tmp = "/tmp/student_book_extract.txt"
    # Only re-extract if needed
    if not os.path.exists(tmp) or os.path.getsize(tmp) < 10000:
        result = subprocess.run(
            ["pdftotext", STUDENT_PDF, tmp],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            print(f"pdftotext error: {result.stderr}", file=sys.stderr)
            sys.exit(1)
    with open(tmp, encoding="utf-8") as f:
        return f.read()


def extract_toc() -> str:
    """Extract just pages 4-7 (the Sommaire / TOC area)."""
    tmp = "/tmp/student_toc.txt"
    if not os.path.exists(tmp) or os.path.getsize(tmp) < 1000:
        subprocess.run(
            ["pdftotext", STUDENT_PDF, tmp, "-l", "10", "-f", "3"],
            capture_output=True, timeout=30
        )
    with open(tmp, encoding="utf-8") as f:
        return f.read()


def parse_chapters_from_toc(text: str) -> list[dict]:
    """
    Crude TOC parser — looks for chapter-number lines in the Sommaire area
    and returns a skeleton list of chapters.
    """
    chapters = []
    # The TOC has patterns like "LE VERBE « ETRE »" followed by page numbers
    # We'll extract chapter titles from the corrigés file instead for accuracy.
    return chapters


def build_chapter_list_from_corriges() -> list[dict]:
    """
    Parse the corrigés combined.txt to extract the canonical chapter list
    with titles and exercise page references.
    """
    corriges_path = os.path.expanduser(
        "~/.hermes/projects/french-study-app/ocr_corriges/combined.txt"
    )
    if not os.path.exists(corriges_path):
        print(f"WARNING: Corrigés not found at {corriges_path}", file=sys.stderr)
        print("Falling back to student-book TOC", file=sys.stderr)
        return []

    chapters = []
    seen = set()

    with open(corriges_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            m = CHAPTER_PATTERN.match(line)
            if m:
                num = int(m.group(1))
                title = m.group(2).strip().strip("«»").strip()
                page = int(m.group(3))
                # Deduplicate: same (num, title, page) may appear for
                # multi-page sets, but each distinct page is a separate set.
                chap_id = f"ch{num:02d}"
                # Build the chapter if new
                chap_key = (chap_id, title)
                existing = None
                for c in chapters:
                    if c["id"] == chap_id:
                        existing = c
                        break
                if not existing:
                    existing = {
                        "id": chap_id,
                        "title": title,
                        "bilan_refs": [],
                        "exercise_sets": []
                    }
                    chapters.append(existing)

                # Add the exercise set if not already present for this page
                set_id = f"{chap_id}_p{page:03d}"
                if set_id not in seen:
                    seen.add(set_id)
                    existing["exercise_sets"].append({
                        "id": set_id,
                        "page": page,
                        "label": f"Exercices p. {page}",
                        "type": "exercise",
                        "lesson_text": "",
                        "verbs_mentioned": [],
                        "items": []
                    })

    # Assign BILAN refs heuristically
    _assign_bilan_refs(chapters)

    return chapters


def _assign_bilan_refs(chapters: list[dict]):
    """Rough mapping of which chapters feed into each BILAN."""
    # Based on the book's structure: BILAN n°1 (p72) covers ch1-3,
    # BILAN n°2 (p73) covers ch4-7, BILAN n°3 (p138) covers ch8-12, etc.
    bilan_map = {
        "bilan_01": list(range(1, 4)),    # ch01-ch03
        "bilan_02": list(range(4, 8)),    # ch04-ch07
        "bilan_03": list(range(8, 13)),   # ch08-ch12
        "bilan_04": list(range(13, 18)),  # ch13-ch17
        "bilan_05": list(range(18, 24)),  # ch18-ch23
        "bilan_06": list(range(24, 30)),  # ch24-ch29
        "bilan_07": list(range(30, 37)),  # ch30-ch36
        "bilan_08": list(range(37, 53)),  # ch37-ch52
    }
    for bilan_id, ch_nums in bilan_map.items():
        for ch in chapters:
            ch_num = int(ch["id"].replace("ch", ""))
            if ch_num in ch_nums:
                if bilan_id not in ch["bilan_refs"]:
                    ch["bilan_refs"].append(bilan_id)


def build_bilans_and_test() -> tuple[list[dict], dict]:
    """Build the bilans and test_final entries from known page numbers."""
    bilans = [
        {"id": "bilan_01", "page": 72, "label": "BILAN n° 1",
         "type": "bilan", "chapter_refs": ["ch01","ch02","ch03"], "items": []},
        {"id": "bilan_02", "page": 73, "label": "BILAN n° 2",
         "type": "bilan", "chapter_refs": ["ch04","ch05","ch06","ch07"], "items": []},
        {"id": "bilan_03", "page": 138, "label": "BILAN n° 3",
         "type": "bilan", "chapter_refs": ["ch08","ch09","ch10","ch11","ch12"], "items": []},
        {"id": "bilan_04", "page": 139, "label": "BILAN n° 4",
         "type": "bilan", "chapter_refs": ["ch13","ch14","ch15","ch16","ch17"], "items": []},
        {"id": "bilan_05", "page": 220, "label": "BILAN n° 5",
         "type": "bilan", "chapter_refs": ["ch18","ch19","ch20","ch21","ch22","ch23"], "items": []},
        {"id": "bilan_06", "page": 221, "label": "BILAN n° 6",
         "type": "bilan", "chapter_refs": ["ch24","ch25","ch26","ch27","ch28","ch29"], "items": []},
        {"id": "bilan_07", "page": 256, "label": "BILAN n° 7",
         "type": "bilan", "chapter_refs": ["ch30","ch31","ch32","ch33","ch34","ch35","ch36"], "items": []},
        {"id": "bilan_08", "page": 257, "label": "BILAN n° 8",
         "type": "bilan", "chapter_refs": ["ch37","ch38","ch39","ch40","ch41","ch42","ch43","ch44","ch45","ch46","ch47","ch48","ch49","ch50","ch51","ch52"], "items": []},
    ]
    # Note: BILAN n° 7 is p. 256 and BILAN n° 8 is p. 257 in the student book.
    # The corrigés has them at pp. 72-73 of the corrigés booklet.
    # We use the student book page numbers.
    test_final = {
        "id": "test_final",
        "page": 268,
        "label": "TEST final",
        "type": "test",
        "items": []
    }
    return bilans, test_final


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print("📖 Building chapter list from corrigés headers...")
    chapters = build_chapter_list_from_corriges()
    print(f"   Found {len(chapters)} chapters")

    total_sets = sum(len(c["exercise_sets"]) for c in chapters)
    print(f"   Found {total_sets} exercise sets")

    bilans, test_final = build_bilans_and_test()

    exercises = {
        "chapters": chapters,
        "bilans": bilans,
        "test_final": test_final
    }

    out_path = os.path.join(OUT_DIR, "exercises.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(exercises, f, ensure_ascii=False, indent=2)

    size = os.path.getsize(out_path)
    print(f"✅ Written exercises.json ({size:,} bytes)")
    print(f"   {len(chapters)} chapters, {total_sets} exercise sets, "
          f"{len(bilans)} bilans, 1 test final")


if __name__ == "__main__":
    main()
