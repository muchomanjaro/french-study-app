#!/usr/bin/env python3
"""extract_sentences.py - Extract sentence context from PDF for exercise blanks.

Reads src/data/answers.json, for each set extracts the corresponding PDF page
via pdftotext, finds sentences containing blank answers, and adds a 'sentence'
field to each blank with the blank replaced by '___'.

If a sentence cannot be reliably extracted for a blank, the sentence field is
omitted entirely (no empty strings).
"""
import json, re, subprocess, sys, os

PDF = os.path.expanduser(
    "~/Documents/Leon's Library/Grammaire progressive du français,"
    " niveau intermédiaire (Maïa Grégoire, Odile Thiévenaz)"
    " (z-library.sk, 1lib.sk, z-lib.sk).pdf"
)
PDFTOTEXT = "/usr/local/bin/pdftotext"
ANSWERS_PATH = os.path.join(
    os.path.expanduser("~/projects/french-study-app"), "src/data/answers.json"
)


def extract_page(page_num):
    """Extract text from a single PDF page using pdftotext -layout."""
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as fp:
        tmp = fp.name
    subprocess.run(
        [PDFTOTEXT, "-layout", "-f", str(page_num), "-l", str(page_num), PDF, tmp],
        capture_output=True,
    )
    with open(tmp) as fp:
        text = fp.read()
    os.unlink(tmp)
    return text


def find_sentences(page_text, blanks):
    """Find exercise sentences by detecting whitespace gaps (blanks).
    
    pdftotext -layout renders blanks as long sequences of spaces.
    We split lines at gaps to extract the surrounding context, then
    reconstruct sentences with ___ at each gap position.
    
    Sentences are assigned to blanks in order (first gap → first blank,
    second gap → second blank, etc.) since blanks appear sequentially
    on the page.
    """
    lines = page_text.split("\n")
    results = {}
    
    # Find lines containing blanks (3+ consecutive spaces)
    # Extract sentences: split at each long gap and join with ___
    sentences = []
    for line in lines:
        stripped = line.strip()
        if not stripped or not re.search(r" {4,}", stripped):
            continue
        # Split on long gaps (4+ spaces), join back with ___
        parts = re.split(r" {4,}", stripped)
        # Only keep meaningful segments
        parts = [p.strip() for p in parts if p.strip()]
        if len(parts) < 2:
            continue
        # Reconstruct: part0 ___ part1 ___ part2 ...
        sentence = " ___ ".join(parts)
        # Clean up: collapse remaining double spaces
        sentence = re.sub(r" {2,}", " ", sentence)
        # Filter out lines that are too short or clearly not sentences
        if len(sentence) < 10 or sentence.count("___") > 5:
            continue
        sentences.append(sentence)
    
    # Assign sentences to blanks in order
    for i, blank in enumerate(blanks):
        if i < len(sentences):
            results[blank["id"]] = sentences[i]
    
    return results


def parse_page_from_set_id(set_id):
    """Extract page number from set ID like 'ch01_p009' -> 9."""
    m = re.search(r"_p(\d+)", set_id)
    return int(m.group(1)) if m else None


def main():
    with open(ANSWERS_PATH) as fp:
        data = json.load(fp)

    total_sentences = 0
    total_blanks = 0

    for set_id, exercise_set in data.items():
        page = parse_page_from_set_id(set_id)
        if page is None:
            continue

        print("Processing", set_id, "(page", page, ")...")

        try:
            page_text = extract_page(page)
        except Exception as e:
            print("  ERROR extracting page", page, ":", e)
            continue

        for item in exercise_set.get("items", []):
            blanks = item.get("blanks", [])
            total_blanks += len(blanks)
            sentences = find_sentences(page_text, blanks)
            for blank in blanks:
                if blank["id"] in sentences:
                    blank["sentence"] = sentences[blank["id"]]
                    total_sentences += 1

    with open(ANSWERS_PATH, "w") as fp:
        json.dump(data, fp, indent=2, ensure_ascii=False)

    print()
    print("Done. Added sentences to", total_sentences, "/", total_blanks, "blanks.")
    print("Updated:", ANSWERS_PATH)


if __name__ == "__main__":
    main()
