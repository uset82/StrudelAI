from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph


def iter_block_items(parent):
    parent_elm = parent.element.body if hasattr(parent, "element") else parent._element
    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)


def runs_to_markdown(paragraph: Paragraph) -> str:
    parts: list[str] = []
    for run in paragraph.runs:
        text = run.text
        if not text:
            continue
        text = text.replace("\n", " ").replace("  ", " ")
        if not text.strip():
            parts.append(text)
            continue
        if run.bold:
            text = f"**{text}**"
        if run.italic:
            text = f"*{text}*"
        parts.append(text)
    return "".join(parts).strip()


def paragraph_to_markdown(paragraph: Paragraph) -> str:
    text = runs_to_markdown(paragraph)
    if not text:
        return ""
    style = paragraph.style.name if paragraph.style else ""
    if style.startswith("Heading"):
        digits = [ch for ch in style if ch.isdigit()]
        level = int("".join(digits)) if digits else 1
        level = max(1, min(level, 6))
        return f"{'#' * level} {text}"
    bullet = 'List' in style or (paragraph._p.pPr is not None and paragraph._p.pPr.numPr is not None)
    if bullet:
        indent = paragraph.paragraph_format.left_indent or 0
        indent_level = int(indent / 360) if indent else 0
        indent_spaces = '  ' * indent_level
        return f"{indent_spaces}- {text}"
    return text


def table_to_markdown(table: Table) -> str:
    rows: list[list[str]] = []
    for row in table.rows:
        cells: list[str] = []
        for cell in row.cells:
            cell_text = "\n".join(runs_to_markdown(p) for p in cell.paragraphs).strip()
            cells.append(cell_text)
        rows.append(cells)
    if not rows:
        return ""
    col_count = max(len(row) for row in rows)
    normalized = [row + ["" for _ in range(col_count - len(row))] for row in rows]
    header, *body = normalized
    separator = ['---'] * col_count
    md_lines = [
        '|' + '|'.join(header) + '|',
        '|' + '|'.join(separator) + '|',
    ]
    for row in body:
        md_lines.append('|' + '|'.join(row) + '|')
    return "\n".join(md_lines)


def convert(docx_path: Path, md_path: Path) -> None:
    document = Document(docx_path)
    lines: list[str] = []
    for block in iter_block_items(document):
        if isinstance(block, Paragraph):
            md = paragraph_to_markdown(block)
            if md:
                lines.append(md)
                lines.append("")
        elif isinstance(block, Table):
            md = table_to_markdown(block)
            if md:
                lines.append(md)
                lines.append("")
    markdown = "\n".join(lines).strip() + "\n"
    md_path.write_text(markdown, encoding="utf-8")


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("Usage: docx_to_md.py <input.docx> <output.md>")
        return 1
    src = Path(argv[1])
    dst = Path(argv[2])
    convert(src, dst)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
