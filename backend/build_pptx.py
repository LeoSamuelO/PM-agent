#!/usr/bin/env python3
"""
Gofore PPTX builder — käyttää Gofore_Template.pptx -pohjaa
Kutsutaan: python3 build_pptx.py '<json>' '<output_path>'
"""
import sys
import json
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "Gofore_Template.pptx")

# Gofore värit
C = {
    "deepBlue": RGBColor(0x0C, 0x23, 0x40),
    "digitalBlue": RGBColor(0x1B, 0x6C, 0xA8),
    "orange": RGBColor(0xE8, 0x52, 0x1A),
    "mint": RGBColor(0x3B, 0xBF, 0xAD),
    "white": RGBColor(0xFF, 0xFF, 0xFF),
    "grey": RGBColor(0x8C, 0x9B, 0xAA),
    "silver": RGBColor(0xD3, 0xD9, 0xDF),
    "light": RGBColor(0xEE, 0xF1, 0xF3),
    "red": RGBColor(0xC0, 0x39, 0x2B),
    "yellow": RGBColor(0xE6, 0x7E, 0x22),
    "green": RGBColor(0x27, 0xAE, 0x60),
}

FONT = "Cadiz"

# Layout indeksit templatessa
L = {
    "cover": 0,  # Cover slide circle only
    "bullets": 5,  # Title + content simple
    "two_col": 6,  # Title + content 2 column
    "three_col": 7,  # Title + content 3 column
    "timeline": 47,  # Headline + Timeline/table placeholder
    "section": 29,  # Section Break Title dark blue
    "end": 53,  # End slide simple
}


def set_text(tf, text, font_name=FONT, font_size=None, bold=False, color=None, align=None):
    """Aseta tekstikehyksen teksti, tyhjennä ensin."""
    tf.clear()
    p = tf.paragraphs[0]
    if align:
        p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.name = font_name
    if font_size:
        run.font.size = Pt(font_size)
    if bold:
        run.font.bold = True
    if color:
        run.font.color.rgb = color


def add_slide(prs, layout_idx):
    layout = prs.slide_layouts[layout_idx]
    return prs.slides.add_slide(layout)


def get_ph(slide, idx):
    """Hae placeholder indeksin mukaan."""
    for ph in slide.placeholders:
        if ph.placeholder_format.idx == idx:
            return ph
    return None


def build_title_slide(prs, d):
    """Layout 0: Cover slide circle only"""
    slide = add_slide(prs, L["cover"])
    # idx=0: otsikko, idx=14: tagline, idx=15: meta
    title_ph = get_ph(slide, 0)
    if title_ph:
        set_text(title_ph.text_frame, d.get("title", "Projektisuunnitelma"),
                 font_size=40, bold=True, color=C["white"])

    tagline_ph = get_ph(slide, 14)
    if tagline_ph and d.get("tagline"):
        set_text(tagline_ph.text_frame, d["tagline"], font_size=16, color=C["orange"])

    meta_ph = get_ph(slide, 15)
    if meta_ph:
        meta_parts = []
        if d.get("meta"):
            meta_parts.append(d["meta"])
        if d.get("projectLead"):
            meta_parts.append("Projektin johtaja: " + d["projectLead"])
        set_text(meta_ph.text_frame, "  |  ".join(meta_parts), font_size=12, color=C["white"])


def build_bullets_slide(prs, d, def_label):
    """Layout 5: Title + content simple — auto-resize font"""
    slide = add_slide(prs, L["bullets"])
    title_ph = get_ph(slide, 0)
    if title_ph:
        set_text(title_ph.text_frame, d.get("heading", def_label), font_size=28, bold=True, color=C["deepBlue"])

    content_ph = get_ph(slide, 16) or get_ph(slide, 10)
    if content_ph and d.get("bullets"):
        tf = content_ph.text_frame
        tf.clear()
        tf.word_wrap = True
        bullets = d["bullets"][:10]  # Max 10 kohtaa

        # Auto-resize: pienennä fonttia jos paljon sisältöä
        total_chars = sum(len(b) for b in bullets)
        if len(bullets) > 7 or total_chars > 600:
            font_size = 11
        elif len(bullets) > 5 or total_chars > 400:
            font_size = 12
        else:
            font_size = 14

        for i, bullet in enumerate(bullets):
            if i == 0:
                p = tf.paragraphs[0]
            else:
                p = tf.add_paragraph()
            p.level = 0
            p.space_after = Pt(2)
            run = p.add_run()
            run.text = bullet
            run.font.name = FONT
            run.font.size = Pt(font_size)
            run.font.color.rgb = C["deepBlue"]

    if d.get("note"):
        note_ph = get_ph(slide, 13)
        if note_ph:
            set_text(note_ph.text_frame, d["note"], font_size=11, color=C["grey"])


def build_two_col_slide(prs, d, def_label):
    """Layout 6: Title + content 2 column"""
    slide = add_slide(prs, L["two_col"])
    title_ph = get_ph(slide, 0)
    if title_ph:
        set_text(title_ph.text_frame, d.get("heading", def_label), font_size=28, bold=True, color=C["deepBlue"])

    left = d.get("left", {})
    right = d.get("right", {})

    # Vasen kolumni: idx=17
    left_ph = get_ph(slide, 17)
    if left_ph and left:
        tf = left_ph.text_frame
        tf.clear()
        tf.word_wrap = True
        items = left.get("items", [])[:8]
        font_size = 11 if len(items) > 6 else 13
        p = tf.paragraphs[0]
        r = p.add_run()
        r.text = left.get("title", "")
        r.font.name = FONT
        r.font.size = Pt(14)
        r.font.bold = True
        r.font.color.rgb = C["deepBlue"]
        for item in items:
            p2 = tf.add_paragraph()
            p2.space_after = Pt(2)
            r2 = p2.add_run()
            r2.text = "• " + item
            r2.font.name = FONT
            r2.font.size = Pt(font_size)
            r2.font.color.rgb = C["deepBlue"]

    # Oikea kolumni: idx=18
    right_ph = get_ph(slide, 18)
    if right_ph and right:
        tf = right_ph.text_frame
        tf.clear()
        tf.word_wrap = True
        items = right.get("items", [])[:8]
        font_size = 11 if len(items) > 6 else 13
        p = tf.paragraphs[0]
        r = p.add_run()
        r.text = right.get("title", "")
        r.font.name = FONT
        r.font.size = Pt(14)
        r.font.bold = True
        r.font.color.rgb = C["deepBlue"]
        for item in items:
            p2 = tf.add_paragraph()
            p2.space_after = Pt(2)
            r2 = p2.add_run()
            r2.text = "• " + item
            r2.font.name = FONT
            r2.font.size = Pt(font_size)
            r2.font.color.rgb = C["deepBlue"]


def build_cards_slide(prs, d, def_label):
    """Layout 7: Title + content 3 column — kortit"""
    slide = add_slide(prs, L["three_col"])
    title_ph = get_ph(slide, 0)
    if title_ph:
        set_text(title_ph.text_frame, d.get("heading", def_label), font_size=28, bold=True, color=C["deepBlue"])

    cards = d.get("cards", [])
    # 3-column layoutin placeholder idx:t ovat 17, 18, 19 (tai vastaavat)
    col_indices = [17, 10, 18]
    level_colors = {
        "high": C["red"], "korkea": C["red"],
        "medium": C["yellow"], "keski": C["yellow"],
        "low": C["green"], "matala": C["green"],
    }

    for i, card in enumerate(cards[:3]):
        ph = get_ph(slide, col_indices[i]) if i < len(col_indices) else None
        if not ph:
            continue
        tf = ph.text_frame
        tf.clear()
        tf.word_wrap = True
        # Otsikko + ikoni
        p = tf.paragraphs[0]
        r = p.add_run()
        r.text = (card.get("icon", "") + " " + card.get("title", "")).strip()
        r.font.name = FONT
        r.font.size = Pt(15)
        r.font.bold = True
        col = level_colors.get(str(card.get("level", "")).lower(), C["deepBlue"])
        r.font.color.rgb = col
        # Kuvaus
        if card.get("desc"):
            p2 = tf.add_paragraph()
            r2 = p2.add_run()
            r2.text = card["desc"]
            r2.font.name = FONT
            r2.font.size = Pt(12)
            r2.font.color.rgb = C["grey"]


def build_table_slide(prs, d, def_label):
    """Layout 47: Headline + Timeline/table — taulukko"""
    from pptx.util import Inches
    slide = add_slide(prs, L["timeline"])
    title_ph = get_ph(slide, 0)
    if title_ph:
        set_text(title_ph.text_frame, d.get("heading", def_label), font_size=28, bold=True, color=C["deepBlue"])

    cols = d.get("columns", [])
    rows = d.get("rows", [])
    if not cols or not rows:
        return

    # Poista olemassa olevat taulukot/sisältö content placeholderista
    # Lisää python-pptx taulukko suoraan slideen
    from pptx.util import Inches, Pt
    from pptx.oxml.ns import qn
    import lxml.etree as etree

    n_cols = len(cols)
    n_rows = len(rows) + 1  # +1 header

    left = Inches(0.4)
    top = Inches(1.3)
    width = Inches(12.3)
    height = Inches(0.4 * n_rows)

    table = slide.shapes.add_table(n_rows, n_cols, left, top, width, height).table

    col_width = int(width / n_cols)
    for i in range(n_cols):
        table.columns[i].width = col_width

    # Header rivi
    for ci, col_name in enumerate(cols):
        cell = table.cell(0, ci)
        cell.fill.solid()
        cell.fill.fore_color.rgb = C["deepBlue"]
        p = cell.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT
        run = p.add_run()
        run.text = col_name
        run.font.name = FONT
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = C["white"]

    # Data rivit
    for ri, row in enumerate(rows):
        bg = C["light"] if ri % 2 == 0 else C["white"]
        for ci, val in enumerate(row[:n_cols]):
            cell = table.cell(ri + 1, ci)
            cell.fill.solid()
            cell.fill.fore_color.rgb = bg
            p = cell.text_frame.paragraphs[0]
            run = p.add_run()
            run.text = str(val or "")
            run.font.name = FONT
            run.font.size = Pt(11)
            run.font.color.rgb = C["deepBlue"]


def build_gantt_slide(prs, d, def_label):
    """Layout 47: Headline + Timeline — Gantt piirretään käsin"""
    from pptx.util import Inches, Pt
    from pptx.enum.shapes import MSO_SHAPE_TYPE

    slide = add_slide(prs, L["timeline"])
    title_ph = get_ph(slide, 0)
    if title_ph:
        set_text(title_ph.text_frame, d.get("heading", def_label), font_size=28, bold=True, color=C["deepBlue"])

    total_weeks = d.get("totalWeeks", 8)
    frozen_week = d.get("frozenWeek")
    phases = d.get("phases", [])

    # Gantt-alueen koordinaatit (tuumina)
    tl = 0.4  # left
    tt = 1.35  # top
    pcw = 3.0  # phase name column width
    rh = 0.40  # row height
    hh = 0.32  # header height
    avail_w = 12.5 - tl - pcw
    wcw = avail_w / total_weeks  # week column width

    def add_rect(slide, x, y, w, h, fill_rgb, text=None, font_size=9, bold=False, text_color=None,
                 align=PP_ALIGN.CENTER):
        shape = slide.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Inches(h))
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill_rgb
        shape.line.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        shape.line.width = Pt(0.5)
        if text is not None:
            tf = shape.text_frame
            tf.word_wrap = False
            p = tf.paragraphs[0]
            p.alignment = align
            r = p.add_run()
            r.text = str(text)
            r.font.name = FONT
            r.font.size = Pt(font_size)
            r.font.bold = bold
            r.font.color.rgb = text_color or C["white"]
        return shape

    # Header: "Vaihe" solu
    add_rect(slide, tl, tt, pcw, hh, C["deepBlue"], "Vaihe", font_size=10, bold=True)

    # Header: viikot
    for w in range(total_weeks):
        x = tl + pcw + w * wcw
        is_frozen = frozen_week and (w + 1 == frozen_week)
        fill = C["red"] if is_frozen else C["deepBlue"]
        label = f"Vk{w + 1}" + (" 🔒" if is_frozen else "")
        add_rect(slide, x, tt, wcw, hh, fill, label, font_size=8, bold=True)

    # Faasit
    for ri, ph in enumerate(phases):
        y = tt + hh + ri * rh
        row_bg = C["light"] if ri % 2 == 0 else C["white"]
        is_crit = ph.get("critical", False)
        name_bg = RGBColor(0xFF, 0xF2, 0xEC) if is_crit else row_bg
        name_color = C["orange"] if is_crit else C["deepBlue"]
        prefix = "⬥ " if is_crit else ""

        add_rect(slide, tl, y, pcw, rh, name_bg,
                 prefix + ph.get("name", ""), font_size=10, bold=is_crit,
                 text_color=name_color, align=PP_ALIGN.LEFT)

        for w in range(total_weeks):
            x = tl + pcw + w * wcw
            active = ph.get("start", 0) <= w + 1 <= ph.get("end", 0)
            is_frozen = frozen_week and (w + 1 == frozen_week)
            if active:
                fill = C["orange"] if is_crit else (C["digitalBlue"] if w % 2 == 0 else C["mint"])
            elif is_frozen:
                fill = RGBColor(0xFF, 0xE0, 0xD6)
            else:
                fill = row_bg
            add_rect(slide, x, y, wcw, rh, fill)


def build_end_slide(prs):
    """Layout 53: End slide simple"""
    add_slide(prs, L["end"])


def build_pptx(slide_data, slide_structure, output_path):
    prs = Presentation(TEMPLATE_PATH)

    # Poista kaikki olemassa olevat diat templatesta
    xml_slides = prs.slides._sldIdLst
    for sld_id in list(xml_slides):
        xml_slides.remove(sld_id)

    for slide_def in slide_structure:
        sid = slide_def.get("id", "")
        layout = slide_def.get("layout", "bullets")
        label = slide_def.get("label", "")
        d = slide_data.get(sid, {})

        if layout == "title":
            build_title_slide(prs, d)
        elif layout == "two-col":
            build_two_col_slide(prs, d, label)
        elif layout == "cards":
            build_cards_slide(prs, d, label)
        elif layout == "table":
            build_table_slide(prs, d, label)
        elif layout == "gantt":
            build_gantt_slide(prs, d, label)
        else:
            build_bullets_slide(prs, d, label)

    build_end_slide(prs)
    prs.save(output_path)
    print(f"OK:{output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: build_pptx.py [--file] '<json_or_filepath>' '<output_path>'", file=sys.stderr)
        sys.exit(1)

    try:
        # Tuki kahdelle kutsumuodolle:
        # 1) build_pptx.py --file data.json output.pptx  (lukee tiedostosta)
        # 2) build_pptx.py '{"json":"data"}' output.pptx  (CLI-argumentti)
        if sys.argv[1] == "--file":
            json_path = sys.argv[2]
            output = sys.argv[3]
            with open(json_path, "r", encoding="utf-8") as f:
                payload = json.load(f)
        else:
            payload = json.loads(sys.argv[1])
            output = sys.argv[2]

        build_pptx(
            payload.get("slideData", {}),
            payload.get("slideStructure", []),
            output
        )
    except Exception as e:
        import traceback

        traceback.print_exc()
        print(f"ERROR:{e}", file=sys.stderr)
        sys.exit(1)