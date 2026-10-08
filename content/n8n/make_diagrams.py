#!/usr/bin/env python3
"""
Generate the 8 original diagrams for the n8n series.

n8n is Sustainable-Use-Licensed, not MIT, so nothing here reproduces their UI,
logo, iconography or colours. Every diagram is constructed from the structural
specs in 04-diagrams.md using our own palette and plain geometry.

Emits standalone SVG: no external fonts, images, CSS or JS, so each renders
correctly inside an <img> tag on the site.
"""
import os
import re
import xml.etree.ElementTree as ET

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "diagrams")
os.makedirs(OUT, exist_ok=True)

INK, PAPER, MID, ACCENT = "#12151a", "#f4f1ea", "#6b7280", "#c2410c"
OK, WARN, LINE = "#166534", "#a16207", "#2a2f38"
FONT = "system-ui, 'Segoe UI', Tahoma, Arial, sans-serif"

W, H = 1200, 520


def esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def box(x, y, w, h, ar, en, kind="rect"):
    """A node. kind: rect | pill | diamond | hexerr | terminal"""
    cx, cy = x + w / 2, y + h / 2
    if kind == "diamond":
        pts = f"{cx},{y} {x+w},{cy} {cx},{y+h} {x},{cy}"
        shape = f'<polygon points="{pts}" fill="{PAPER}" stroke="{ACCENT}" stroke-width="2"/>'
    elif kind == "pill":
        shape = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" '
                 f'fill="{PAPER}" stroke="{ACCENT}" stroke-width="2"/>')
    elif kind == "hexerr":
        q = 14
        pts = (f"{x+q},{y} {x+w-q},{y} {x+w},{cy} {x+w-q},{y+h} {x+q},{y+h} {x},{cy}")
        shape = f'<polygon points="{pts}" fill="#fdf3e7" stroke="{WARN}" stroke-width="2" stroke-dasharray="6 4"/>'
    elif kind == "terminal":
        shape = (f'<rect x="{x}" y="{y}" width="12" height="{h}" rx="3" '
                 f'fill="{INK}" stroke="{INK}" stroke-width="1"/>')
    else:
        shape = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" '
                 f'fill="{PAPER}" stroke="{LINE}" stroke-width="2"/>')

    label = ""
    if kind != "terminal":
        if en:
            label = (
                f'<text x="{cx}" y="{cy-2}" text-anchor="middle" direction="rtl" '
                f'font-family="{FONT}" font-size="16" font-weight="600" fill="{INK}">{esc(ar)}</text>'
                f'<text x="{cx}" y="{cy+17}" text-anchor="middle" '
                f'font-family="{FONT}" font-size="11" fill="{MID}">{esc(en)}</text>'
            )
        else:
            label = (f'<text x="{cx}" y="{cy+5}" text-anchor="middle" direction="rtl" '
                     f'font-family="{FONT}" font-size="16" font-weight="600" fill="{INK}">{esc(ar)}</text>')
    return shape + label


def edge(x1, y1, x2, y2, text=None, colour=LINE, dash=None):
    """Orthogonal-ish connector with an arrowhead. mid bends at the midpoint."""
    mx = (x1 + x2) / 2
    d = f"M {x1} {y1} L {mx} {y1} L {mx} {y2} L {x2} {y2}"
    da = f' stroke-dasharray="{dash}"' if dash else ""
    out = (f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="2"{da} '
           f'marker-end="url(#ah)"/>')
    if text:
        out += (f'<text x="{(x1+x2)/2}" y="{(y1+y2)/2-8}" text-anchor="middle" '
                f'font-family="{FONT}" font-size="12" fill="{colour}">{esc(text)}</text>')
    return out


def direct(x1, y1, x2, y2, text=None, colour=LINE):
    out = (f'<path d="M {x1} {y1} L {x2} {y2}" fill="none" stroke="{colour}" '
           f'stroke-width="2" marker-end="url(#ah)"/>')
    if text:
        out += (f'<text x="{(x1+x2)/2}" y="{(y1+y2)/2-8}" text-anchor="middle" '
                f'font-family="{FONT}" font-size="12" fill="{colour}">{esc(text)}</text>')
    return out


def item(x, y):
    """The tiny { } glyph that teaches 'data flows as items'."""
    return (f'<text x="{x}" y="{y}" text-anchor="middle" font-family="{FONT}" '
            f'font-size="15" font-weight="700" fill="{ACCENT}">{{ }}</text>')


def caption(text, h=None):
    h = h or H
    return (f'<line x1="60" y1="{h-52}" x2="{W-60}" y2="{h-52}" stroke="{LINE}" '
            f'stroke-width="1"/>'
            f'<text x="{W/2}" y="{h-24}" text-anchor="middle" direction="rtl" '
            f'font-family="{FONT}" font-size="15" fill="{INK}">{esc(text)}</text>')


def svg(body, title, h=None):
    h = h or H
    defs = (f'<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" '
            f'markerWidth="7" markerHeight="7" orient="auto">'
            f'<path d="M 0 0 L 10 5 L 0 10 z" fill="{LINE}"/></marker></defs>')
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{h}" '
            f'viewBox="0 0 {W} {h}" role="img" aria-label="{esc(title)}">'
            f'<title>{esc(title)}</title>{defs}'
            f'<rect width="{W}" height="{h}" fill="{PAPER}"/>{body}</svg>\n')


# ───────────────────────────── D1 ─────────────────────────────
def d1():
    b = []
    b.append(box(50, 90, 150, 56, "مُحفِّز دوري", "Schedule Trigger", "pill"))
    b.append(box(250, 90, 170, 56, "طلب عبر الويب", "HTTP Request"))
    b.append(box(590, 82, 150, 72, "شرط", "If", "diamond"))
    b.append(box(830, 40, 170, 56, "إشعار", "Slack"))
    b.append(box(830, 190, 170, 56, "أرشفة", "Airtable"))
    b.append(edge(200, 118, 250, 118))
    b.append(edge(420, 118, 590, 118))
    b.append(edge(740, 110, 830, 68, "صحيح", OK))
    b.append(edge(1000, 68, 1060, 68))
    b.append(edge(740, 126, 830, 218, "خطأ", WARN))
    b.append(edge(1000, 218, 1060, 218))
    b.append(box(1060, 40, 12, 56, "", "", "terminal"))
    b.append(box(1060, 190, 12, 56, "", "", "terminal"))
    b.append(item(465, 106))
    b.append(caption(h=330, text="كل تشغيل كامل لسير العمل يُحسب تنفيذاً واحداً، مهما طال أو تعدّدت خطواته."))
    return svg("".join(b), "سير عمل بسيط: مُحفِّز، طلب، شرط، ثم مساران", 330)


# ───────────────────────────── D2 ─────────────────────────────
def d2():
    b = []
    y = 60
    b.append(box(50, y, 170, 62, "مُحفِّز", "Trigger", "pill"))
    b.append(box(280, y, 150, 62, "عقدة", "Node"))
    b.append(box(490, y, 150, 62, "عقدة", "Node"))
    b.append(box(700, y, 150, 62, "عقدة", "Node"))
    b.append(edge(220, y + 31, 280, y + 31))
    b.append(edge(430, y + 31, 490, y + 31))
    b.append(edge(640, y + 31, 700, y + 31))
    for cx, q in ((135, "متى يعمل؟"), (355, "ماذا يفعل؟"), (745, "أين ينتهي؟")):
        b.append(f'<text x="{cx}" y="{y+96}" text-anchor="middle" direction="rtl" '
                 f'font-family="{FONT}" font-size="13" fill="{MID}">{q}</text>')
    b.append(f'<line x1="50" y1="175" x2="{W-60}" y2="175" stroke="{LINE}" stroke-width="1"/>')

    y2 = 215
    b.append(box(50, y2, 190, 62, "رسالة واردة", "Webhook", "pill"))
    b.append(box(300, y2, 170, 62, "تحليل الحقول", "Edit Fields"))
    b.append(box(560, y2 - 8, 130, 78, "فرع", "If", "diamond"))
    b.append(box(790, y2 - 40, 180, 62, "إشعار", "Slack"))
    b.append(box(790, y2 + 42, 180, 62, "أرشفة", "Airtable"))
    b.append(edge(240, y2 + 31, 300, y2 + 31))
    b.append(item(270, y2 + 18))
    b.append(edge(470, y2 + 31, 560, y2 + 31))
    b.append(edge(690, y2 + 20, 790, y2 - 9, "صحيح", OK))
    b.append(edge(690, y2 + 44, 790, y2 + 73, "خطأ", WARN))
    b.append(caption(h=360, text="العقد تعالج كل عنصر على حدة: مدخل واحد يعطي ناتجاً، ومدخل من عشرة يعطي عشرة."))
    return svg("".join(b), "تشريح سير العمل، ثم مثال عملي بمرحلتين", 360)


# ───────────────────────────── D3 ─────────────────────────────
def d3():
    b = []
    lanes = [
        (60, "أ) عقدة داخل سير العمل", "AI Agent node", ACCENT, "round"),
        (232, "ب) وكيل كمنتج في المشروع", "Agents", OK, "rect"),
        (404, "ج) مساعد يبني لك العمل", "n8n Assistant", MID, "round"),
    ]
    for y, ar, en, col, shape in lanes:
        b.append(f'<rect x="40" y="{y-34}" width="{W-80}" height="132" rx="10" '
                 f'fill="none" stroke="{col}" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.55"/>')
        b.append(f'<text x="{W-60}" y="{y-14}" text-anchor="start" direction="rtl" '
                 f'font-family="{FONT}" font-size="16" font-weight="700" fill="{col}">{esc(ar)}</text>')
    # lane A
    b.append(box(80, 76, 150, 56, "مُحفِّز", "Trigger", "pill"))
    b.append(box(300, 76, 170, 56, "عقدة وكيل", "AI Agent"))
    b.append(box(540, 76, 170, 56, "أدوات", "Tools"))
    b.append(edge(230, 104, 300, 104))
    b.append(edge(470, 104, 540, 104))
    # lane B
    b.append(box(80, 248, 150, 56, "نموذج", "Model"))
    b.append(box(300, 248, 170, 56, "تعليمات", "Instructions"))
    b.append(box(540, 248, 170, 56, "قنوات ومواعيد", "Channels"))
    b.append(edge(230, 276, 300, 276))
    b.append(edge(470, 276, 540, 276))
    # lane C
    b.append(box(80, 420, 150, 56, "وصفك", "Prompt"))
    b.append(box(300, 420, 170, 56, "سير عمل جاهز", "Workflow"))
    b.append(box(540, 420, 170, 56, "تنتشر بعد المراجعة", "Publish"))
    b.append(edge(230, 448, 300, 448))
    b.append(edge(470, 448, 540, 448))
    b.append(caption(h=560, text="ثلاثة أشياء مختلفة اسمها «وكيل». أين يعيش كل واحد منها هو الفارق الجوهري."))
    return svg("".join(b), "مقارنة بين الوكلاء الثلاثة في n8n", 560)


# ───────────────────────────── D4 ─────────────────────────────
def d4():
    b = []
    b.append(box(50, 120, 180, 60, "طلب واحد", "Webhook"))
    b.append(edge(230, 150, 320, 150))
    b.append(box(320, 120, 190, 60, "عدّد الحقول", "Split Out"))
    b.append(edge(510, 150, 600, 150))
    for i, y in enumerate((72, 150, 228)):
        b.append(item(560, y + 6))
        b.append(edge(600, 150, 660, y + 12))
        b.append(box(660, y - 12, 190, 48, f"عنصر {i+1}", f"Item {i+1}"))
    b.append(box(940, 120, 210, 60, "ادفع القيمة", "{{ $json.amount }}"))
    for y in (60, 138, 216):
        b.append(direct(850, y + 12, 940, 150))
    b.append(caption(h=350, text="التعبير {{ $json.amount }} يقرأ حقلاً من العنصر الجاري داخل نفس العقدة."))
    return svg("".join(b), "كيف تتفرّع البيانات وتُقرأ بالتعبيرات", 350)


# ───────────────────────────── D5 ─────────────────────────────
def d5():
    b = []
    b.append(box(50, 70, 170, 56, "مُحفِّز", "Trigger", "pill"))
    b.append(box(280, 70, 190, 56, "استدعاء واجهة", "HTTP Request"))
    b.append(edge(220, 98, 280, 98))
    b.append(edge(470, 98, 570, 98, None, WARN))
    b.append(box(570, 70, 160, 56, "فشل", "Failed", "hexerr"))
    b.append(edge(730, 98, 810, 98))
    b.append(box(810, 70, 140, 56, "انتظر", "Wait"))
    b.append(edge(880, 126, 880, 200, None, WARN))
    b.append(edge(880, 200, 375, 200, None, WARN))
    b.append(edge(375, 200, 375, 126, "أعد المحاولة", WARN))
    b.append(box(470, 260, 190, 56, "معالجة الخطأ", "Error Workflow", "hexerr"))
    b.append(edge(600, 126, 565, 260, None, WARN))
    b.append(box(740, 260, 200, 56, "تنبيهك", "Notify"))
    b.append(edge(660, 288, 740, 288, None, WARN))
    b.append(box(50, 260, 330, 56, "حالة خطأ: عد إلى آخر تشغيل ناجح", "Save execution progress"))
    b.append(f'<text x="{W/2}" y="348" text-anchor="middle" direction="rtl" '
             f'font-family="{FONT}" font-size="14" font-weight="700" fill="{WARN}">⚠️ سقف 5 محاولات و5000 مللي ثانية غير موثّق رسمياً</text>')
    b.append(caption(h=430, text="المسار المتقطّع هو مسار الخطأ. الانتظار قبل إعادة المحاولة يحميك من حدّ المعدّل."))
    return svg("".join(b), "مسار الخطأ وإعادة المحاولة", 430)


# ───────────────────────────── D6 ─────────────────────────────
def d6():
    b = []
    b.append(box(60, 70, 220, 62, "النسخة الرئيسية", "Main instance"))
    b.append(edge(280, 101, 420, 101))
    b.append(box(420, 74, 150, 54, "الوسيط", "Redis broker"))
    b.append(edge(570, 101, 700, 101))
    b.append(box(700, 40, 180, 54, "عامل", "Worker"))
    b.append(box(700, 118, 180, 54, "عامل", "Worker"))
    b.append(edge(570, 88, 700, 67))
    b.append(edge(570, 114, 700, 145))
    b.append(f'<rect x="40" y="200" width="{W-80}" height="150" rx="10" fill="#fdf3e7" '
             f'stroke="{WARN}" stroke-width="2"/>')
    b.append(f'<text x="{W-60}" y="228" text-anchor="start" direction="rtl" '
             f'font-family="{FONT}" font-size="15" font-weight="700" fill="{WARN}">حدّ التشفير — كل ما عدا هذا يجب أن يشارك المفتاح</text>')
    b.append(box(80, 250, 260, 62, "قاعدة البيانات", "Postgres"))
    b.append(box(440, 250, 260, 62, "متجه بيانات اعتماد", "Credentials vault"))
    b.append(box(800, 250, 260, 62, "بيانات ثنائية", "S3 binary storage"))
    b.append(edge(170, 132, 210, 250, None, WARN))
    b.append(edge(790, 132, 930, 250, None, WARN))
    b.append(item(350, 90))
    b.append(caption(h=430, text="وضع الطابور: النسخ الرئيسية تولّد التنفيذ، والعمال ينفّذونه. يجب أن يتشارك الجميع مفتاح التشفير."))
    return svg("".join(b), "معمارية وضع الطابور وحدّ التشفير", 430)


# ───────────────────────────── D7 ─────────────────────────────
def d7():
    h = 660
    cols = [("المجتمع", "Community"), ("المجتمع المسجَّل", "Registered Community"),
            ("الأعمال", "Business"), ("المؤسسات", "Enterprise")]
    x0, cw, gap = 40, 268, 12
    b = []
    for i, (ar, en) in enumerate(cols):
        x = x0 + i * (cw + gap)
        b.append(f'<rect x="{x}" y="52" width="{cw}" height="46" rx="6" fill="{ACCENT}" opacity="0.12"/>')
        b.append(f'<text x="{x+cw/2}" y="72" text-anchor="middle" direction="rtl" '
                 f'font-family="{FONT}" font-size="17" font-weight="700" fill="{INK}">{esc(ar)}</text>')
        b.append(f'<text x="{x+cw/2}" y="90" text-anchor="middle" font-family="{FONT}" '
                 f'font-size="10" fill="{MID}">{esc(en)}</text>')
    rows = [("المشاريع", "✓", "✓", "✓", "✓"), ("المتغيّرات المخصّصة", "✗", "✓", "✓", "✓"),
            ("بيئات متعدّدة", "✗", "✗", "✓", "✓"), ("وضع الطابور", "✓", "✓", "✓", "✓"),
            ("نسخ رئيسي متعدّد", "✗", "✗", "✗", "✓"), ("تدفّق السجلّات", "✗", "✗", "✓", "✓"),
            ("مخزن أسرار خارجي", "✗", "✗", "✗", "✓"), ("تحكّم بالإصدارات", "✗", "✗", "✓", "✓"),
            ("تسجيل دخول موحّد", "✗", "✗", "✓", "✓")]
    for r, (label, *marks) in enumerate(rows):
        y = 118 + r * 46
        b.append(f'<line x1="40" y1="{y-14}" x2="{W-40}" y2="{y-14}" stroke="{LINE}" stroke-width="1" opacity="0.4"/>')
        b.append(f'<text x="{W-58}" y="{y+16}" text-anchor="start" direction="rtl" '
                 f'font-family="{FONT}" font-size="14" fill="{INK}">{esc(label)}</text>')
        for i, m in enumerate(marks):
            x = x0 + i * (cw + gap) + cw / 2
            col = OK if m == "✓" else ("#b91c1c" if m == "✗" else MID)
            b.append(f'<text x="{x}" y="{y+16}" text-anchor="middle" font-family="{FONT}" '
                     f'font-size="16" font-weight="700" fill="{col}">{m}</text>')
    b.append(f'<text x="{W/2}" y="{h-34}" text-anchor="middle" direction="rtl" '
             f'font-family="{FONT}" font-size="14" fill="{INK}">'
             'الرخصة ليست MIT: الاستخدام التجاري داخل شركتك مسموح، وإعادة توزيعه بغير مجانٍ ليست كذلك.</text>')
    body = "".join(b)
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" '
            f'width="{W}" height="{h}" viewBox="0 0 {W} {h}" role="img" '
            f'aria-label="مقارنة إصدارات n8n الأربعة">'
            f'<title>مقارنة إصدارات n8n الأربعة</title>'
            f'<rect width="{W}" height="{h}" fill="{PAPER}"/>{body}</svg>\n')


# ───────────────────────────── D8 ─────────────────────────────
def d8():
    b = []
    # main spine
    b.append(box(40, 60, 150, 56, "طلب خارجي", "Webhook", "pill"))
    b.append(edge(190, 88, 240, 88))
    b.append(box(240, 60, 150, 56, "وكيل", "AI Agent"))
    b.append(edge(390, 88, 440, 88))
    b.append(box(440, 60, 150, 56, "أدوات", "Tools"))
    b.append(edge(590, 88, 640, 88))
    b.append(box(640, 52, 150, 72, "موافقة بشرية", "Approval", "diamond"))
    b.append(edge(790, 88, 850, 88, "موافق", OK))
    b.append(box(850, 60, 180, 56, "تنفيذ الإجراء", "Side effect"))
    b.append(edge(940, 116, 940, 180, None, OK))
    b.append(box(850, 180, 180, 56, "سجّل النتيجة", "Log"))
    b.append(edge(1030, 208, 1090, 208, None, OK))
    b.append(box(1090, 180, 12, 56, "", "", "terminal"))

    # rejected: down out of the diamond, then back to the left
    b.append(edge(715, 124, 715, 196, None, WARN))
    b.append(edge(715, 196, 452, 196, "مرفوض", WARN))
    b.append(box(440, 168, 12, 56, "", "", "terminal"))

    # tool failure: down from Tools, then left into the error path
    b.append(edge(515, 116, 515, 290, None, WARN))
    b.append(edge(515, 290, 390, 290, None, WARN))
    b.append(box(200, 262, 190, 56, "معالجة الخطأ", "Error path", "hexerr"))
    b.append(direct(390, 290, 470, 290, None, WARN))
    b.append(box(470, 262, 180, 56, "تنبيهك", "Notify"))

    b.append(item(212, 76))
    b.append(caption(h=440, text="بنية المشروع الكامل: طلب، وكيل، أدوات، ثم بوابة موافقة قبل كل إجراء ذات أثر."))
    return svg("".join(b), "معمارية المشروع الكامل مع بوابة الموافقة", 440)


DIAGRAMS = [
    ("d1.svg", d1, "n8n-what-is-n8n-and-when-you-need-it",
     "سير عمل خطي بمُحفِّز وطلب وشرط، ثم مساران يلتقيان عند النهاية.",
     "مخطط يسار إلى يمين: مُحفِّز دوري يقود طلباً عبر الويب، ثم شرط يتفرّع إلى مسارين — "
     "صحيحاً يُرسل إشعاراً عبر Slack، وخطأً يؤرشف في Airtable — وينتهي المساران عند نقطة النهاية. "
     "مخطط يوضّح أن سير العمل واحد له مساران محتملان."),
    ("d2.svg", d2, "n8n-first-workflow-no-code",
     "تشريح العناصر الأربعة لسير العمل، ثم مثال عملي بمرحلتين.",
     "مخطط من مستويين: المستوى الأول يوضّح العناصر الأربعة — مُحفِّز وعقدتان وعقدة ثالثة — مع "
     "أسئلة تقابل كل جزء. المستوى الثاني مثال عملي: رسالة واردة، تحليل الحقول، ثم شرط يتفرّع "
     "إلى إشعار أو أرشفة. سهم يحمل رمز عنصر البيانات."),
    ("d3.svg", d3, "n8n-three-agents-explained",
     "ثلاثة مسارات متوازية تقارن الوكلاء الثلاثة في n8n.",
     "مخطط بثلاثة مسارات أفقية متجاورة، كل مسار داخل إطار متقطع بلون مختلف. المسار الأول: "
     "مُحفِّز يقود عقدة وكيل تقود الأدوات — هذا الوكيل يعيش داخل سير العمل. المسار الثاني: "
     "نموذج وتعليمات وقنوات — وكيل كمنتج مستقل في المشروع. المسار الثالث: وصفك يقود سير عمل "
     "جاهزاً لا يُنشر إلا بعد مراجعتك."),
    ("d4.svg", d4, "n8n-expressions-and-data",
     "عنصر واحد يتفرّع إلى ثلاثة، ثم دمج القيمة بتعبير.",
     "مخطط يُظهر طلباً واحداً يدخل عقدة تفريع العناصر فينقسم إلى ثلاثة عناصر متوازية، كل "
     "عنصر في مستطيل مستقل. تلتقي بعد ذلك عند عقدة واحدة تقرأ الحقل بتعبير ‎{{ $json.amount }}‎. "
     "الرمز ‎{ }‎ على السهم يوضّح أن البيانات تنتقل كعناصر."),
    ("d5.svg", d5, "n8n-flow-logic-errors-and-retries",
     "المسار الرئيسي، ومسار الخطأ المتقطّع مع حلقة إعادة المحاولة.",
     "مخطط يعرض المسار الرئيسي من المُحفِّز إلى استدعاء الواجهة، ثم—when يفشل— ينتقل"
     "إلى شكل سداسي متقطّع بالبرتقالي يمثّل الخطأ، ثم عقدة انتظار، ثم يعود السهم إلى عقدة "
     "الفشل ليُعيد المحاولة. يتفرّع أيضاً مسار إلى سير عمل معالجة الخطأ ينبّهك."),
    ("d6.svg", d6, "n8n-self-hosting-and-security",
     "معمارية وضع الطابور وحدّ تشفير بيانات الاعتماد.",
     "مخطط معماري: النسخة الرئيسية تولّد التنفيذ وتمرّره إلى وسيط Redis، ثم يسحبه عاملان "
     "متوازيان. في الأسفل مستطيل برتقالي يمثل حدّ التشفير، وداخله ثلاثة مخازن: قاعدة "
     "البيانات، ومتجه بيانات الاعتماد، وتخزين البيانات الثنائية. يجب أن يتشارك الجميع مفتاح التشفير."),
    ("d7.svg", d7, "n8n-licensing-and-editions-honestly",
     "جدول مقارنة إصدارات n8n الأربعة مع الميزات المقفلة.",
     "جدول من أربعة أعمدة يمثّل إصدارات n8n: المجتمع، المجتمع المسجَّل، الأعمال، المؤسسات. "
     "تسعة صفوف للميزات، وكل خلية إما علامة صح خضراء متاحة أو علامة خطأ حمراء مقفلة. "
     "الصف الأخير يميّز أن وضع الطابور متاح في المجتمع بينما النسخ المتعدد مقصور على المؤسسات."),
    ("d8.svg", d8, "n8n-production-project-end-to-end",
     "المعمارية الكاملة مع بوابة الموافقة ومسار الخطأ.",
     "مخطط يعرض البنية الكاملة: طلب خارجي، ثم وكيل، ثم أدوات، ثم بوابة موافقة بشرية. "
     "عند الموافقة ينفذ الإجراء ثم يُسجَّل، وعند الرفض يتوقف المسار. مخرج آخر من الأدوات "
     "يذهب إلى مسار معالجة الخطأ الذي ينبّهك. الرموز ‎{ }‎ على السهم تبيّن تدفق البيانات."),
]

if __name__ == "__main__":
    rows = ["| file | article-slug | caption-ar | alt-ar |",
            "|---|---|---|---|"]
    AR = re.compile(r"[؀-ۿ]")
    for name, fn, slug, cap, alt in DIAGRAMS:
        path = os.path.join(OUT, name)
        data = fn()
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(data)
        ET.fromstring(data)                      # raises if malformed
        assert "<image" not in data and "xlink" not in data, name
        assert AR.search(data), f"{name}: no Arabic"
        assert len(alt) <= 300 and len(alt) >= 5, f"{name}: alt {len(alt)}c"
        rows.append(f"| {name} | {slug} | {cap} | {alt} |")
        print(f"  {name}  {os.path.getsize(path):>6}b  xml-ok  self-contained  arabic-ok  alt={len(alt)}c")
    with open(os.path.join(OUT, "captions.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(rows) + "\n")
    print(f"\n  {len(DIAGRAMS)} diagrams written to {OUT}")