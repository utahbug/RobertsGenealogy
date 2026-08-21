"""Build the first-pass annotated Book of Remembrance PDF."""

from pathlib import Path
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "editions/annotated-book/ANNOTATED_BOOK_OF_REMEMBRANCE.md"
OUTPUT = ROOT / "output/pdf/Roberts-Book-of-Remembrance-Annotated-Edition-Draft.pdf"
W, H = letter
MARGIN, HEADER, FOOTER = 0.72 * inch, 0.34 * inch, 0.30 * inch
PAPER, TEXT, MUTED = colors.HexColor("#F5F4F0"), colors.HexColor("#282C2F"), colors.HexColor("#686E72")
SLATE, DARK, OXBLOOD = colors.HexColor("#3E515C"), colors.HexColor("#293A43"), colors.HexColor("#8A3E43")
SOFT, LINE = colors.HexColor("#E8ECEE"), colors.HexColor("#D5D6D3")


def register_fonts():
    fonts = Path(r"C:\Windows\Fonts")
    for name, filename in (("Georgia", "georgia.ttf"), ("Georgia-Bold", "georgiab.ttf"), ("Georgia-Italic", "georgiai.ttf")):
        pdfmetrics.registerFont(TTFont(name, str(fonts / filename)))


def make_styles():
    return {
        "title": ParagraphStyle("title", fontName="Georgia-Bold", fontSize=24, leading=29, alignment=TA_CENTER, textColor=DARK, spaceAfter=10),
        "subtitle": ParagraphStyle("subtitle", fontName="Georgia", fontSize=12, leading=17, alignment=TA_CENTER, textColor=MUTED, spaceAfter=8),
        "h1": ParagraphStyle("h1", fontName="Georgia-Bold", fontSize=17, leading=21, textColor=DARK, spaceBefore=12, spaceAfter=8),
        "h2": ParagraphStyle("h2", fontName="Georgia-Bold", fontSize=13, leading=17, textColor=SLATE, spaceBefore=10, spaceAfter=6),
        "h3": ParagraphStyle("h3", fontName="Georgia-Bold", fontSize=10.5, leading=14, textColor=OXBLOOD, spaceBefore=7, spaceAfter=4),
        "body": ParagraphStyle("body", fontName="Georgia", fontSize=9.6, leading=14.2, textColor=TEXT, spaceAfter=7),
        "quote": ParagraphStyle("quote", fontName="Georgia-Italic", fontSize=9.4, leading=14, leftIndent=18, rightIndent=12, textColor=SLATE, spaceAfter=8),
        "list": ParagraphStyle("list", fontName="Georgia", fontSize=9.3, leading=13.5, leftIndent=15, firstLineIndent=-9, textColor=TEXT, spaceAfter=3),
        "placeholder": ParagraphStyle("placeholder", fontName="Georgia-Bold", fontSize=9, leading=13, textColor=OXBLOOD, alignment=TA_CENTER),
    }


def markup(text):
    text = escape(text)
    text = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return re.sub(r"\*([^*]+)\*", r"<i>\1</i>", text)


def decorate(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    canvas.setStrokeColor(LINE)
    canvas.line(MARGIN, H - MARGIN - HEADER, W - MARGIN, H - MARGIN - HEADER)
    canvas.line(MARGIN, MARGIN + FOOTER, W - MARGIN, MARGIN + FOOTER)
    canvas.setFont("Georgia", 7.4)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, H - MARGIN - 10, "THE ROBERTS FAMILY HISTORY | CLEAN ANNOTATED EDITION")
    canvas.drawString(MARGIN, MARGIN + 7, "First-pass draft - front matter and full section scaffold")
    canvas.drawRightString(W - MARGIN, MARGIN + 7, str(doc.page))
    canvas.restoreState()


def parse(text, styles):
    story, paragraph = [], []

    def flush():
        if paragraph:
            value = " ".join(item.strip() for item in paragraph).strip()
            if value:
                story.append(Paragraph(markup(value), styles["body"]))
            paragraph.clear()

    for line in text.splitlines():
        item = line.strip()
        if not item:
            flush()
        elif item == "---":
            flush()
            story.extend((Spacer(1, 8), Table([[""]], colWidths=[6.9 * inch], rowHeights=[1], style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), LINE)])), Spacer(1, 8)))
        elif item.startswith("# "):
            flush()
            if not story:
                story.extend((Spacer(1, 0.7 * inch), Paragraph(markup(item[2:]), styles["title"])))
            else:
                story.extend((PageBreak(), Paragraph(markup(item[2:]), styles["h1"])))
        elif item.startswith("## "):
            flush(); story.append(Paragraph(markup(item[3:]), styles["h2"]))
        elif item.startswith("### "):
            flush(); story.append(Paragraph(markup(item[4:]), styles["h3"]))
        elif item.startswith("> "):
            flush(); story.append(Paragraph(markup(item[2:]), styles["quote"]))
        elif item.startswith("[IMAGE PLACEHOLDER"):
            flush()
            box = Table([[Paragraph(markup(item), styles["placeholder"])]] , colWidths=[6.7 * inch], rowHeights=[0.85 * inch])
            box.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, OXBLOOD), ("BACKGROUND", (0, 0), (-1, -1), SOFT), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10)]))
            story.append(KeepTogether([box, Spacer(1, 5)]))
        elif item.startswith("- ") or re.match(r"^\d+\.\s", item):
            flush()
            if item.startswith("- "):
                marker, value = "-", item[2:]
            else:
                marker, value = item.split(".", 1)[0] + ".", re.sub(r"^\d+\.\s", "", item)
            story.append(Paragraph(f"{escape(marker)} {markup(value)}", styles["list"]))
        else:
            paragraph.append(item)
    flush()
    return story


def main():
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frame = Frame(MARGIN, MARGIN + FOOTER + 8, W - 2 * MARGIN, H - 2 * MARGIN - HEADER - FOOTER - 14, leftPadding=0, rightPadding=0, topPadding=8, bottomPadding=4, id="body")
    doc = BaseDocTemplate(str(OUTPUT), pagesize=letter, title="Book of Remembrance - Clean Annotated Edition Draft", author="The Roberts Family History")
    doc.addPageTemplates(PageTemplate(id="edition", frames=[frame], onPage=decorate))
    doc.build(parse(SOURCE.read_text(encoding="utf-8"), make_styles()))
    print(OUTPUT)


if __name__ == "__main__":
    main()
