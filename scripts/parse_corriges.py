#!/usr/bin/env python3
"""
parse_corriges.py — Parse the OCR'd corrigés text to produce answers.json.

Reads ~/.hermes/projects/french-study-app/ocr_corriges/combined.txt
and outputs src/data/answers.json keyed by exercise-set ID.

Format handled:
  - "N. TITLE. Exercices p. XX." → chapter/set header
  - "…" marks blank positions in answers
  - Line-number based item grouping
  - "Réponses possibles :" → open_ended items
  - "(ou X)" parenthetical variants → multiple accepted answers
  - OCR noise lines (single chars, symbols, page markers) are stripped
"""

import json, os, re, sys
from collections import defaultdict

OCR_DIR = os.path.expanduser(
    "~/.hermes/projects/french-study-app/ocr_corriges"
)
COMBINED_PATH = os.path.join(OCR_DIR, "combined.txt")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")

CHAPTER_HEADER_RE = re.compile(
    r'^(\d+)\.\s*(.+?)\.\s*Exercices\s+p\.\s*(\d+)\.?\s*$',
    re.IGNORECASE | re.UNICODE
)
BILAN_HEADER_RE = re.compile(
    r'BILAN\s+n[°º]\s*(\d+)\s*.*?p\.\s*(\d+)',
    re.IGNORECASE | re.UNICODE
)
TEST_HEADER_RE = re.compile(
    r'TEST\s+final',
    re.IGNORECASE | re.UNICODE
)
# Patterns for lines to skip
SKIP_RE = re.compile(
    r'^(\s*---\s*Page\s+\d+\s*---\s*)$'
    r'|^[\s\-–—=~_@Ÿ0Oo<>«»e\s\d]*$'
    r'|^[0OoŸ@<>Ç\s\-\–\—\=\.\,\;\:]+$'
    r'|^\s*[0OoŸ@<>\.\-\–\—]{3,}\s*$'
    r'|^\s*\d+\s*$'
)
# Lines that are just page numbers, barcode noise
NOISE_RE = re.compile(
    r'^[\s\d\.\,\;\:\-\–\—\=\@ŸOo<>\(\)\[\]\{\}«»\']+$'
)

ITEM_NUMBER_RE = re.compile(r'^(\d+)\.\s*(.*)')
BLANK_MARKER = '…'


def is_noise_line(line: str) -> bool:
    """Return True if the line is OCR noise we should skip."""
    stripped = line.strip()
    if not stripped:
        return True
    if len(stripped) <= 3 and not re.search(r'[a-zA-ZÀ-ÿ]{2,}', stripped):
        return True
    if re.match(r'^[\s\-–—=~_@Ÿ0Oo<>«»\.\,\;\:\d\(\)\[\]\{\}\']+$', stripped):
        return True
    if re.match(r'^[\s\-\–\—\=\.\d]+$', stripped):
        return True
    if stripped.startswith('---') and stripped.endswith('---'):
        return True
    return False


def has_content(line: str) -> bool:
    """Check if a line has real text content (not just symbols/numbers)."""
    return bool(re.search(r'[a-zA-ZÀ-ÿ]{2,}', line))


def count_blanks(text: str) -> int:
    """Count the number of blank markers (…) in a text."""
    return text.count(BLANK_MARKER)


def parse_set_header(line: str):
    """Try to parse a chapter header line, return (num, title, page) or None."""
    m = CHAPTER_HEADER_RE.match(line.strip())
    if m:
        return int(m.group(1)), m.group(2).strip(), int(m.group(3))
    return None


def extract_answer_lines(lines: list[str], start: int) -> list[str]:
    """
    From a list of lines starting at index `start`, collect all lines
    that belong to the current exercise set (until the next header or EOF).
    """
    return lines[start:]


def parse_answers_from_lines(lines: list[str]) -> list[dict]:
    """
    Given the lines for one exercise set, extract individual answer items
    with their blank answers.
    Returns list of dicts with keys: id, open_ended, blanks
    """
    items = []
    current_item = None
    blank_count = 0
    in_possible_reponses = False

    for line in lines:
        stripped = line.strip()
        if is_noise_line(stripped):
            continue

        # Check for "Réponses possibles :"
        if 'réponses possibles' in stripped.lower():
            in_possible_reponses = True
            continue

        # Check if line starts with a numbered item like "2. ..." or "1. - ..."
        # Only at the beginning of a set
        item_match = ITEM_NUMBER_RE.match(stripped)

        text_with_answers = stripped

        # For now, create items based on blank markers
        b_count = count_blanks(text_with_answers)
        if b_count > 0:
            if not current_item or not in_possible_reponses:
                # Extract answers from blanks
                answers = _extract_blank_answers(text_with_answers)
                if answers:
                    items.append({
                        "id": f"i{len(items)+1:02d}",
                        "open_ended": in_possible_reponses,
                        "blanks": answers
                    })
            else:
                # More answers for the current open_ended item
                answers = _extract_blank_answers(text_with_answers)
                if answers and items:
                    items[-1]["blanks"].extend(answers)
        elif has_content(stripped):
            # Content line without blanks — could be extra instruction
            # or variant answers. Store as context.
            pass

    return items


def _extract_blank_answers(text: str) -> list[dict]:
    """
    Extract answers from a text with … markers.
    E.g. "… es … suis … est … elle est … êtes … sommes … sont … ils sont …"
    Returns list of {id, answers: [str]} dicts.
    """
    blanks = []
    # Split on … but keep text between markers
    parts = text.split(BLANK_MARKER)
    # First part is before first blank (usually empty or exercise number)
    for i, part in enumerate(parts[1:], 1):
        answer = part.strip().rstrip(',').strip()
        if answer:
            # Handle parenthetical variants: "texte (ou X)" or "texte (variante)"
            variants = [answer]
            # Check for (ou ...) pattern
            ou_match = re.search(r'\(ou\s+(.+?)\)', answer)
            if ou_match:
                base = answer.replace(ou_match.group(0), '').strip().rstrip(',').strip()
                variant_text = ou_match.group(1).strip()
                variants = [base, variant_text] if base else [variant_text]
                # Filter empty variants
                variants = [v for v in variants if v]

            blank_id = f"b{i}"
            blanks.append({
                "id": blank_id,
                "answers": variants
            })
    return blanks


def parse_corriges(text: str) -> dict:
    """
    Full parse: split text by chapter headers, extract answers per set.
    Returns dict keyed by set_id (e.g., "ch01_p009") with items.
    """
    lines = text.split('\n')
    result = {}
    current_set_id = None
    current_ch_num = None
    current_title = None
    current_page = None
    buffer_lines = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        header = parse_set_header(line) if has_content(line) or line else None

        if header:
            # Process previous buffer
            if current_set_id and buffer_lines:
                items = parse_answers_from_lines(buffer_lines)
                if items:
                    result[current_set_id] = {"items": items}

            ch_num, title, page = header
            current_ch_num = ch_num
            current_title = title
            current_page = page
            current_set_id = f"ch{ch_num:02d}_p{page:03d}"
            buffer_lines = []
        elif current_set_id:
            buffer_lines.append(line)

        i += 1

    # Process last set
    if current_set_id and buffer_lines:
        items = parse_answers_from_lines(buffer_lines)
        if items:
            result[current_set_id] = {"items": items}

    return result


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    if not os.path.exists(COMBINED_PATH):
        print(f"❌ Corrigés not found at {COMBINED_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"📖 Reading {COMBINED_PATH}...")
    with open(COMBINED_PATH, encoding="utf-8") as f:
        text = f.read()

    print(f"   {len(text):,} chars ({text.count(chr(10))+1} lines)")

    print("🔍 Parsing exercise set headers and extracting answers...")
    answers = parse_corriges(text)

    total_sets = len(answers)
    total_items = sum(len(v["items"]) for v in answers.values())
    total_blanks = sum(
        sum(len(b["blanks"]) for b in v["items"])
        for v in answers.values()
    )

    print(f"   Found {total_sets} exercise sets, {total_items} items, {total_blanks} blanks")

    # Add BILAN sets from the corrigés text
    bilan_items = _extract_bilan_items(text)
    answers.update(bilan_items)

    out_path = os.path.join(OUT_DIR, "answers.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(answers, f, ensure_ascii=False, indent=2)

    size = os.path.getsize(out_path)
    print(f"✅ Written answers.json ({size:,} bytes)")
    print(f"   {len(answers)} exercise sets total")


def _extract_bilan_items(text: str) -> dict:
    """Extract BILAN answer sets from the corrigés text."""
    import re
    lines = text.split('\n')
    result = {}
    BLANK_MARKER = '…'

    # Find all bilan header lines
    BILAN_HEADER_RE = re.compile(r'BILAN\s+n[°º]\s*(\d+)\s+.*p\.\s*(\d+)', re.IGNORECASE)
    bilan_positions = []
    for i, line in enumerate(lines):
        m = BILAN_HEADER_RE.search(line)
        if m:
            bilan_positions.append((i, int(m.group(1)), int(m.group(2))))

    for idx, (start_line, bilan_num, page) in enumerate(bilan_positions):
        set_id = f"bilan_{bilan_num:02d}"

        # Section goes from after header line to next header (or end)
        if idx < len(bilan_positions) - 1:
            end_line = bilan_positions[idx + 1][0]
        else:
            end_line = len(lines)

        answer_lines = lines[start_line + 1:end_line]

        # Filter noise lines
        filtered = []
        import re as re2
        for l in answer_lines:
            s = l.strip()
            if not s or s.startswith('---'):
                continue
            if len(s) <= 3 and not re2.search(r'[a-zA-ZÀ-ÿ]{2,}', s):
                continue
            if re2.match(r'^[\s\-\u2013\u2014=~_@\u01780Oo<>\d\(\)\[\]\{\}\'\.\,\;\:]+$', s):
                continue
            filtered.append(s)

        # Parse into items
        items = []
        blank_counter = 0
        for l in filtered:
            blank_count = l.count(BLANK_MARKER)
            if blank_count > 0:
                parts = l.split(BLANK_MARKER)
                blanks = []
                for part in parts[1:]:
                    ans = part.strip().rstrip(',').strip()
                    if not ans:
                        continue
                    ou_match = re2.search(r'\(ou\s+(.+?)\)', ans)
                    variants = [ans]
                    if ou_match:
                        base = ans.replace(ou_match.group(0), '').strip().rstrip(',').strip()
                        variant = ou_match.group(1).strip()
                        variants = [base, variant] if base else [variant]
                        variants = [v for v in variants if v]
                    blank_counter += 1
                    blanks.append({
                        "id": f"b{blank_counter}",
                        "answers": variants
                    })
                if blanks:
                    items.append({
                        "id": f"i{len(items)+1:02d}",
                        "open_ended": False,
                        "blanks": blanks
                    })

        result[set_id] = {"items": items}

    return result


if __name__ == "__main__":
    main()
