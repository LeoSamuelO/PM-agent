#!/usr/bin/env python3
"""
Word-dokumentin generointi Gofore-brändillä.
Käyttö: python build_docx.py --stdin output.docx
        python build_docx.py --file input.json output.docx
"""
import sys
import json
import re
from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn

# ═══ GOFORE VÄRIT ═══
DEEP_BLUE = RGBColor(0x0C, 0x23, 0x40)
DIGITAL_BLUE = RGBColor(0x1B, 0x6C, 0xA8)
ORANGE = RGBColor(0xE8, 0x52, 0x1A)
MINT = RGBColor(0x3B, 0xBF, 0xAD)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREY = RGBColor(0x8C, 0x9B, 0xAA)
SILVER = RGBColor(0xD3, 0xD9, 0xDF)
LIGHT = RGBColor(0xEE, 0xF1, 0xF3)


def set_cell_shading(cell, color_hex):
    """Aseta solun taustaväri."""
    shading = cell._element.get_or_add_tcPr()
    shading_elm = shading.makeelement(qn('w:shd'), {
        qn('w:val'): 'clear',
        qn('w:color'): 'auto',
        qn('w:fill'): color_hex,
    })
    shading.append(shading_elm)


def create_docx(data, out_path):
    """Luo Word-dokumentti annetusta datasta."""
    sections = data.get("sections", {})
    structure = data.get("structure", [])
    proposals = data.get("proposals", {})
    lang = data.get("lang", "fi")

    doc = Document()

    # ═══ TYYLIASETUKSET ═══
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)
    font.color.rgb = DEEP_BLUE

    # Otsikkotyylit
    for level in range(1, 4):
        h_style = doc.styles[f'Heading {level}']
        h_font = h_style.font
        h_font.name = 'Calibri'
        h_font.color.rgb = DEEP_BLUE if level <= 2 else DIGITAL_BLUE
        h_font.size = Pt(24 - (level * 4))  # 20, 16, 12
        h_font.bold = True

    # Sivun asetukset
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)

    # ═══ SISÄLLÖNTUOTANTO ═══
    for idx, s in enumerate(structure):
        sid = s.get("id", "")
        layout = s.get("layout", "text")
        label = s.get("label", f"Luku {idx + 1}")
        section_data = sections.get(sid, {})
        proposal_text = proposals.get(sid, "")

        if layout == "title":
            # ── KANSILEHTI ──
            # Oranssi yläviiva
            p = doc.add_paragraph()
            run = p.add_run("━" * 60)
            run.font.color.rgb = ORANGE
            run.font.size = Pt(6)

            # Tyhjä tila
            for _ in range(4):
                doc.add_paragraph()

            # Otsikko
            title = section_data.get("title", label)
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            run = p.add_run(title)
            run.font.size = Pt(28)
            run.font.bold = True
            run.font.color.rgb = DEEP_BLUE

            # Tagline
            tagline = section_data.get("tagline", "")
            if tagline:
                p = doc.add_paragraph()
                run = p.add_run(tagline)
                run.font.size = Pt(14)
                run.font.color.rgb = ORANGE

            # Meta
            meta = section_data.get("meta", "")
            if meta:
                doc.add_paragraph()
                p = doc.add_paragraph()
                run = p.add_run(meta)
                run.font.size = Pt(11)
                run.font.color.rgb = GREY

            # Gofore logo-teksti
            for _ in range(6):
                doc.add_paragraph()
            p = doc.add_paragraph()
            run = p.add_run("GOFORE")
            run.font.size = Pt(11)
            run.font.bold = True
            run.font.color.rgb = ORANGE
            run.font.letter_spacing = Pt(3)

            # Sivunvaihto
            doc.add_page_break()

        elif layout == "table":
            # ── TAULUKKO-LUKU ──
            doc.add_heading(label, level=1)

            # Lisää teksti proposalista tai section_datasta
            text_content = extract_text_from_proposal(proposal_text)
            if text_content:
                for para_text in text_content[:3]:  # Max 3 johtavaa kappaletta
                    if not para_text.strip().startswith("|"):
                        p = doc.add_paragraph(para_text.strip())
                        p.paragraph_format.space_after = Pt(6)

            # Etsi ja luo taulukko
            table_data = extract_table_from_proposal(proposal_text)
            if table_data and len(table_data) > 1:
                add_styled_table(doc, table_data)
            elif section_data.get("columns") and section_data.get("rows"):
                cols = section_data["columns"]
                rows = section_data["rows"]
                table_data = [cols] + rows
                add_styled_table(doc, table_data)

            # Lopputeksti
            end_text = extract_conclusion(proposal_text)
            if end_text:
                doc.add_paragraph()
                p = doc.add_paragraph(end_text)
                run = p.runs[0] if p.runs else None
                if run:
                    run.font.italic = True
                    run.font.color.rgb = DIGITAL_BLUE

        elif layout == "list":
            # ── LISTA-LUKU ──
            doc.add_heading(label, level=1)

            items = extract_list_from_proposal(proposal_text)
            # Johdanto ennen listaa
            intro = extract_intro_paragraph(proposal_text)
            if intro:
                p = doc.add_paragraph(intro)
                p.paragraph_format.space_after = Pt(8)

            for item in items:
                p = doc.add_paragraph(item, style='List Bullet')
                p.paragraph_format.space_after = Pt(4)

            # Yhteenveto listan jälkeen
            summary = extract_conclusion(proposal_text)
            if summary:
                doc.add_paragraph()
                p = doc.add_paragraph(summary)

        elif layout == "summary":
            # ── TIIVISTELMÄ-LUKU ──
            doc.add_heading(label, level=1)

            # Oranssi viiva
            p = doc.add_paragraph()
            run = p.add_run("━" * 40)
            run.font.color.rgb = ORANGE
            run.font.size = Pt(6)

            # Sisältö proposalista
            paragraphs = extract_all_paragraphs(proposal_text)
            for para_text in paragraphs:
                p = doc.add_paragraph(para_text)
                p.paragraph_format.space_after = Pt(8)

        else:
            # ── TEXT / MUU — yksityiskohtainen tekstiluku ──
            doc.add_heading(label, level=1)

            paragraphs = extract_all_paragraphs(proposal_text)
            if paragraphs:
                for para_text in paragraphs:
                    # Tarkista onko tämä alaotsikko
                    if para_text.startswith("##") or para_text.startswith("**") and para_text.endswith("**"):
                        heading_text = para_text.strip("#* ")
                        doc.add_heading(heading_text, level=2)
                    elif para_text.strip().startswith("|"):
                        # Taulukko proposalissa
                        table_data = parse_markdown_table_from_text(para_text)
                        if table_data:
                            add_styled_table(doc, table_data)
                    elif para_text.strip().startswith("- ") or para_text.strip().startswith("• "):
                        # Bullet-lista
                        items = [line.strip("- •").strip() for line in para_text.split("\n") if line.strip()]
                        for item in items:
                            doc.add_paragraph(item, style='List Bullet')
                    else:
                        p = doc.add_paragraph(para_text)
                        p.paragraph_format.space_after = Pt(8)
            elif section_data.get("bullets"):
                for bullet in section_data["bullets"]:
                    if bullet and bullet != "—":
                        p = doc.add_paragraph(bullet)
                        p.paragraph_format.space_after = Pt(6)

    # ═══ LOPPUSIVU ═══
    doc.add_page_break()
    for _ in range(8):
        doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run("Pioneering\nan ethical\ndigital world.")
    run.font.size = Pt(28)
    run.font.bold = True
    run.font.color.rgb = DEEP_BLUE

    doc.add_paragraph()
    p = doc.add_paragraph()
    run = p.add_run("GOFORE")
    run.font.size = Pt(11)
    run.font.bold = True
    run.font.color.rgb = ORANGE
    run.font.letter_spacing = Pt(3)

    # Tallenna
    doc.save(out_path)
    print(f"OK: {out_path}")


def add_styled_table(doc, table_data):
    """Luo tyylitelty taulukko Gofore-brändillä."""
    if not table_data or len(table_data) < 2:
        return

    num_cols = len(table_data[0])
    table = doc.add_table(rows=len(table_data), cols=num_cols)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT

    # Otsikkorivi
    for ci, cell_text in enumerate(table_data[0]):
        cell = table.rows[0].cells[ci]
        cell.text = str(cell_text).strip()
        set_cell_shading(cell, "0C2340")
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.color.rgb = WHITE
                run.font.bold = True
                run.font.size = Pt(10)

    # Datarivit
    for ri in range(1, len(table_data)):
        bg = "FFFFFF" if ri % 2 == 1 else "EEF1F3"
        for ci in range(min(len(table_data[ri]), num_cols)):
            cell = table.rows[ri].cells[ci]
            cell.text = str(table_data[ri][ci]).strip()
            set_cell_shading(cell, bg)
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    run.font.size = Pt(10)
                    run.font.color.rgb = DEEP_BLUE

    doc.add_paragraph()


def extract_text_from_proposal(text):
    """Erottelee tekstikappaleet proposalista."""
    if not text:
        return []
    lines = text.split("\n")
    paragraphs = []
    current = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                paragraphs.append(" ".join(current))
                current = []
        elif stripped.startswith("|"):
            if current:
                paragraphs.append(" ".join(current))
                current = []
        else:
            current.append(stripped)
    if current:
        paragraphs.append(" ".join(current))
    return paragraphs


def extract_all_paragraphs(text):
    """Erottelee kaikki kappaleet proposalista, säilyttäen rakenteet."""
    if not text:
        return []
    # Poista markdown-muotoilu mutta säilytä rakenne
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    lines = text.split("\n")
    paragraphs = []
    current = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                paragraphs.append("\n".join(current))
                current = []
        elif stripped.startswith("##"):
            if current:
                paragraphs.append("\n".join(current))
                current = []
            paragraphs.append(stripped)
        elif stripped.startswith("|"):
            if current:
                paragraphs.append("\n".join(current))
                current = []
            # Kerää koko taulukko
            table_lines = [stripped]
            # (taulukko jatkuu seuraavilla riveillä — käsitellään myöhemmin)
            paragraphs.append(stripped)
        elif stripped.startswith("- ") or stripped.startswith("• ") or stripped.startswith("* "):
            current.append(stripped)
        else:
            # Poista ylimääräiset markdown-tagit
            cleaned = re.sub(r'^#+\s*', '', stripped)
            cleaned = re.sub(r'\[.*?\]\(.*?\)', '', cleaned)
            current.append(cleaned)
    if current:
        paragraphs.append("\n".join(current))
    return [p for p in paragraphs if p.strip()]


def extract_table_from_proposal(text):
    """Etsii markdown-taulukon proposalista."""
    if not text:
        return None
    lines = text.split("\n")
    table_lines = [l.strip() for l in lines if l.strip().startswith("|") and "|" in l[1:]]
    # Poista separator-rivit (---|---)
    table_lines = [l for l in table_lines if not re.match(r'^\|[\s\-:|]+\|$', l)]
    if len(table_lines) < 2:
        return None
    result = []
    for line in table_lines:
        cells = [c.strip() for c in line.strip("|").split("|")]
        result.append(cells)
    return result


def parse_markdown_table_from_text(text):
    """Parsii taulukko-tekstin."""
    lines = text.strip().split("\n")
    table_lines = [l.strip() for l in lines if l.strip().startswith("|")]
    table_lines = [l for l in table_lines if not re.match(r'^\|[\s\-:|]+\|$', l)]
    if len(table_lines) < 2:
        return None
    return [[c.strip() for c in l.strip("|").split("|")] for l in table_lines]


def extract_intro_paragraph(text):
    """Etsii ensimmäisen kappaleen ennen listaa."""
    if not text:
        return ""
    lines = text.split("\n")
    intro = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("-") or stripped.startswith("•") or stripped.startswith("*") or stripped.startswith("1."):
            break
        if stripped and not stripped.startswith("#") and not stripped.startswith("|"):
            intro.append(stripped)
    return " ".join(intro) if intro else ""


def extract_list_from_proposal(text):
    """Etsii listan proposalista."""
    if not text:
        return []
    lines = text.split("\n")
    items = []
    for line in lines:
        stripped = line.strip()
        if re.match(r'^[-•*]\s+', stripped):
            items.append(re.sub(r'^[-•*]\s+', '', stripped))
        elif re.match(r'^\d+\.\s+', stripped):
            items.append(re.sub(r'^\d+\.\s+', '', stripped))
    return items


def extract_conclusion(text):
    """Etsii johtopäätös/suositus-kappaleen proposalista."""
    if not text:
        return ""
    lines = text.split("\n")
    # Etsi viimeinen kappale joka ei ole taulukkoa tai listaa
    paragraphs = []
    current = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                paragraphs.append(" ".join(current))
                current = []
        elif not stripped.startswith("|") and not stripped.startswith("-") and not stripped.startswith("•"):
            current.append(stripped)
        else:
            if current:
                paragraphs.append(" ".join(current))
                current = []
    if current:
        paragraphs.append(" ".join(current))

    # Palauta viimeinen kappale jos se vaikuttaa johtopäätökseltä
    keywords = ["suosit", "johtopäät", "yhteenveto", "recomm", "conclus", "summary", "therefore", "siksi", "eli"]
    for p in reversed(paragraphs):
        if any(kw in p.lower() for kw in keywords):
            return re.sub(r'\*\*(.+?)\*\*', r'\1', p)
    return ""


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--stdin", action="store_true")
    parser.add_argument("--file", type=str, default=None)
    parser.add_argument("output", type=str)
    args = parser.parse_args()

    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            data = json.load(f)
    elif args.stdin:
        data = json.load(sys.stdin)
    else:
        print("Usage: --stdin or --file <path>", file=sys.stderr)
        sys.exit(1)

    create_docx(data, args.output)
