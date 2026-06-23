#!/usr/bin/env python3
"""Extract lesson text from Grammaire progressive du français PDF."""

import fitz
import json
import sys
import re

PDF_PATH = "/Users/asd/Documents/Leon's Library/Grammaire progressive du français, niveau intermédiaire (Maïa Grégoire, Odile Thiévenaz) (z-library.sk, 1lib.sk, z-lib.sk).pdf"
EXERCISES_PATH = "/Users/asd/projects/french-study-app/src/data/exercises.json"
OUTPUT_PATH = "/Users/asd/projects/french-study-app/src/data/exercises.json"

def clean_text(text):
    """Clean extracted PDF text."""
    # Remove excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    # Remove page numbers and headers if they appear
    text = re.sub(r'^\d+\s*$', '', text, flags=re.MULTILINE)
    return text.strip()

def main():
    doc = fitz.open(PDF_PATH)
    print(f"PDF opened: {doc.page_count} pages", file=sys.stderr)
    
    # Load exercises.json
    with open(EXERCISES_PATH, 'r') as f:
        data = json.load(f)
    
    chapters = data['chapters']
    print(f"Chapters to process: {len(chapters)}", file=sys.stderr)
    
    # Book structure: lesson on left page (even), exercises on right page (odd)
    # BUT: PDF page 0 = book cover, so there's an offset
    # Let's first find the offset by looking for known chapter titles
    
    # Strategy: find which PDF pages correspond to known content
    # Then extract lesson pages: for exercises on book page N, lesson is on book page N-1
    # PDF page = book_page - 1 (if cover is PDF page 0, book page 1)
    # Actually, let's search for "LE VERBE ÊTRE" to find the offset
    
    offset = None
    for i in range(min(50, doc.page_count)):
        text = doc[i].get_text()
        if "LE VERBE" in text and "ÊTRE" in text:
            # This should be the lesson page for ch01 (book page 8)
            offset = i  # PDF page number
            print(f"Found 'LE VERBE ÊTRE' on PDF page {i}", file=sys.stderr)
            break
    
    if offset is None:
        print("ERROR: Could not find chapter 1 in PDF", file=sys.stderr)
        doc.close()
        sys.exit(1)
    
    # Check: lesson for ch01 is on book page 8
    # If PDF page `offset` corresponds to book page 8, then:
    # PDF_page = book_page - (8 - offset)
    # Or: book_page = PDF_page + (8 - offset)
    book_offset = 8 - offset
    print(f"Book offset: {book_offset} (PDF page {offset} = book page 8)", file=sys.stderr)
    
    # Now extract for each chapter
    processed = 0
    skipped = 0
    
    for ch in chapters:
        ch_id = ch['id']
        exercise_sets = ch.get('exercise_sets', [])
        if not exercise_sets:
            skipped += 1
            continue
        
        # Get the first exercise page
        first_ex_page = min(s['page'] for s in exercise_sets)
        # Lesson is typically on the left page (even number, one before exercises)
        lesson_book_page = first_ex_page - 1
        
        # Convert to PDF page (0-indexed)
        pdf_page_num = lesson_book_page - book_offset
        
        if pdf_page_num < 0 or pdf_page_num >= doc.page_count:
            print(f"  {ch_id}: lesson page {lesson_book_page} → PDF {pdf_page_num} OUT OF RANGE", file=sys.stderr)
            skipped += 1
            continue
        
        # Extract text
        page = doc[pdf_page_num]
        text = page.get_text()
        text = clean_text(text)
        
        if not text or len(text) < 20:
            # Try the facing page too (sometimes lesson spans two pages)
            page2 = doc[pdf_page_num + 1] if pdf_page_num + 1 < doc.page_count else None
            if page2:
                text2 = page2.get_text()
                text2 = clean_text(text2)
                text = text + "\n\n" + text2
        
        # Set lesson_text on each exercise_set
        lesson_text = text[:5000]  # Limit to 5000 chars for sanity
        
        for es in exercise_sets:
            es['lesson_text'] = lesson_text
        
        processed += 1
        preview = text[:80].replace('\n', ' | ')
        print(f"  ✓ {ch_id}: book p.{lesson_book_page} → PDF p.{pdf_page_num} | {preview}...", file=sys.stderr)
    
    doc.close()
    
    # Write back
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\nDone: {processed} chapters processed, {skipped} skipped", file=sys.stderr)
    # Print summary to stdout
    print(json.dumps({"processed": processed, "skipped": skipped, "total": len(chapters)}))

if __name__ == '__main__':
    main()
