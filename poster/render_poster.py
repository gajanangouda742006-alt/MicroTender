from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import textwrap


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUT_PNG = ROOT / "microtender-poster-rendered.png"
OUT_PDF = ROOT / "microtender-poster-rendered.pdf"

W, H = 3300, 5100
MARGIN = 70
GAP = 30
COL_W = (W - 2 * MARGIN - 2 * GAP) // 3

BG = (255, 250, 252)
PANEL = (255, 255, 255)
BORDER = (232, 216, 227)
NAVY = (26, 37, 96)
NAVY2 = (30, 58, 138)
PINK = (225, 29, 116)
PURPLE = (124, 58, 237)
GREEN = (21, 128, 61)
BLUE = (29, 78, 216)
ORANGE = (234, 88, 12)
TEAL = (15, 118, 110)
TEXT = (35, 48, 71)
MUTED = (90, 101, 122)
LIGHT_BLUE = (239, 246, 255)


def load_font(size, bold=False):
    candidates = []
    if bold:
      candidates = [
          "C:/Windows/Fonts/arialbd.ttf",
          "C:/Windows/Fonts/calibrib.ttf",
          "C:/Windows/Fonts/segoeuib.ttf",
      ]
    else:
      candidates = [
          "C:/Windows/Fonts/arial.ttf",
          "C:/Windows/Fonts/calibri.ttf",
          "C:/Windows/Fonts/segoeui.ttf",
      ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


FONT_TITLE = load_font(110, bold=True)
FONT_SUBTITLE = load_font(42, bold=True)
FONT_TOP = load_font(54, bold=True)
FONT_H = load_font(34, bold=True)
FONT_SH = load_font(28, bold=True)
FONT_BODY = load_font(25, bold=False)
FONT_SMALL = load_font(21, bold=False)
FONT_STAT = load_font(50, bold=True)
FONT_TAG = load_font(26, bold=True)


def rrect(draw, xy, fill, outline=BORDER, radius=26, width=3):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def panel(draw, x, y, w, h, title, accent):
    rrect(draw, (x, y, x + w, y + h), PANEL)
    draw.rounded_rectangle((x, y, x + w, y + 62), radius=24, fill=accent, outline=accent)
    draw.text((x + 18, y + 13), title, fill=(255, 255, 255), font=FONT_H)
    return x + 18, y + 82, x + w - 18, y + h - 18


def draw_wrapped(draw, text, box, font, fill=TEXT, spacing=8):
    x1, y1, x2, y2 = box
    max_width = x2 - x1
    avg_char_width = max(font.size * 0.52, 8)
    wrap_chars = max(int(max_width / avg_char_width), 10)
    lines = []
    for para in text.split("\n"):
        if not para.strip():
            lines.append("")
            continue
        lines.extend(textwrap.wrap(para, width=wrap_chars))
    y = y1
    for line in lines:
        draw.text((x1, y), line, font=font, fill=fill)
        y += font.size + spacing
        if y > y2:
            break
    return y


def draw_bullets(draw, bullets, box, font=FONT_BODY, fill=TEXT):
    x1, y1, x2, y2 = box
    y = y1
    for bullet in bullets:
        bullet_text = f"- {bullet}"
        max_width = x2 - x1 - 10
        wrap_chars = max(int(max_width / max(font.size * 0.5, 8)), 12)
        lines = textwrap.wrap(bullet_text, width=wrap_chars)
        for line in lines:
            draw.text((x1, y), line, font=font, fill=fill)
            y += font.size + 8
            if y > y2:
                return y
        y += 6
    return y


def draw_meta_card(draw, x, y, w, h, title, lines):
    rrect(draw, (x, y, x + w, y + h), PANEL, radius=22)
    draw.text((x + 16, y + 12), title, font=FONT_SH, fill=PINK)
    cy = y + 54
    for line in lines:
        draw.text((x + 16, cy), line, font=FONT_BODY, fill=NAVY)
        cy += 32


def draw_architecture(draw, box):
    x1, y1, x2, y2 = box
    card_w = int((x2 - x1 - 84) / 3)
    card_h = 150
    yy = y1 + 18
    labels = [
        ("Frontend Layer", ["React + Vite", "Citizen, Vendor, Admin UI"]),
        ("Application Layer", ["Node.js + Express", "REST APIs + Socket.IO"]),
        ("Data Layer", ["MySQL Database", "Tables, keys, indexes"]),
    ]
    for i, (title, lines) in enumerate(labels):
        cx = x1 + i * (card_w + 42)
        rrect(draw, (cx, yy, cx + card_w, yy + card_h), LIGHT_BLUE, outline=(199, 215, 255), radius=20)
        draw.text((cx + 16, yy + 16), title, font=FONT_SH, fill=NAVY2)
        draw.text((cx + 16, yy + 62), lines[0], font=FONT_BODY, fill=TEXT)
        draw.text((cx + 16, yy + 96), lines[1], font=FONT_BODY, fill=TEXT)
        if i < 2:
            ax = cx + card_w + 10
            draw.text((ax, yy + 52), "->", font=FONT_TITLE, fill=BLUE)


def draw_feature_boxes(draw, box):
    x1, y1, x2, y2 = box
    items = [
        ("Citizen Complaint Filing", "Complaint form with category, location, and evidence image."),
        ("Micro-Tender Workflow", "Complaint-to-review-to-bidding lifecycle with tracked statuses."),
        ("Vendor Bidding", "Nearby vendors submit bids and estimated completion days."),
        ("Notifications and Ratings", "Alerts, work updates, completion review, and citizen feedback."),
    ]
    gap = 12
    bw = (x2 - x1 - gap) // 2
    bh = 118
    for idx, (title, desc) in enumerate(items):
        row = idx // 2
        col = idx % 2
        bx = x1 + col * (bw + gap)
        by = y1 + row * (bh + gap)
        rrect(draw, (bx, by, bx + bw, by + bh), (255, 251, 253), outline=(234, 199, 215), radius=18)
        draw.text((bx + 14, by + 12), title, font=FONT_SH, fill=NAVY)
        draw_wrapped(draw, desc, (bx + 14, by + 48, bx + bw - 14, by + bh - 12), FONT_SMALL, fill=TEXT, spacing=6)


def draw_timeline(draw, box):
    x1, y1, x2, y2 = box
    steps = [
        "Citizen submits complaint",
        "System stores complaint and provisional tender",
        "Admin reviews and approves",
        "Nearby vendors bid",
        "Admin assigns vendor",
        "Vendor posts work updates",
        "Admin verifies completion",
        "Citizen rates resolved work",
    ]
    step_w = int((x2 - x1 - 7 * 10) / 4)
    step_h = 78
    for idx, step in enumerate(steps):
        row = idx // 4
        col = idx % 4
        sx = x1 + col * (step_w + 10)
        sy = y1 + row * (step_h + 18)
        rrect(draw, (sx, sy, sx + step_w, sy + step_h), (243, 252, 250), outline=(201, 235, 229), radius=18)
        draw_wrapped(draw, step, (sx + 10, sy + 10, sx + step_w - 10, sy + step_h - 8), FONT_SMALL, fill=TEAL, spacing=4)


def draw_stack_chips(draw, box):
    x1, y1, x2, y2 = box
    chips = [
        "React 18", "Vite 6", "Tailwind CSS", "Node.js", "Express",
        "Socket.IO", "MySQL", "JWT Auth", "Multer Uploads", "Gemini + Rule Logic",
    ]
    x = x1
    y = y1
    for chip in chips:
        bbox = draw.textbbox((0, 0), chip, font=FONT_SMALL)
        cw = bbox[2] - bbox[0] + 28
        ch = 42
        if x + cw > x2:
            x = x1
            y += ch + 10
        rrect(draw, (x, y, x + cw, y + ch), LIGHT_BLUE, outline=(199, 215, 255), radius=20, width=2)
        draw.text((x + 14, y + 8), chip, font=FONT_SMALL, fill=BLUE)
        x += cw + 10


def draw_mock_screens(draw, box):
    x1, y1, x2, y2 = box
    gap = 16
    sw = (x2 - x1 - 2 * gap) // 3
    titles = ["Citizen Dashboard", "Vendor Panel", "Admin Analytics"]
    for i, title in enumerate(titles):
        sx = x1 + i * (sw + gap)
        sy = y1
        rrect(draw, (sx, sy, sx + sw, sy + 330), (248, 251, 255), outline=(216, 222, 234), radius=18)
        draw.text((sx + 14, sy + 12), title, font=FONT_SH, fill=NAVY)
        draw.rounded_rectangle((sx + 14, sy + 52, sx + sw - 14, sy + 72), radius=10, fill=(219, 234, 254))
        if i == 0:
            for c in range(3):
                draw.rounded_rectangle((sx + 14 + c * 92, sy + 90, sx + 88 + c * 92, sy + 144), radius=12, fill=(251, 207, 232))
            for r in range(3):
                draw.rounded_rectangle((sx + 14, sy + 162 + r * 44, sx + sw - 14, sy + 192 + r * 44), radius=10, fill=(219, 234, 254))
        elif i == 1:
            for r in range(5):
                draw.rounded_rectangle((sx + 14, sy + 92 + r * 44, sx + sw - 14, sy + 122 + r * 44), radius=10, fill=(219, 234, 254))
        else:
            base = sy + 260
            for b, h in enumerate([70, 120, 90, 150]):
                bx = sx + 28 + b * 60
                draw.rounded_rectangle((bx, base - h, bx + 34, base), radius=8, fill=(129, 140, 248))
            draw.pieslice((sx + sw - 130, sy + 120, sx + sw - 30, sy + 220), start=0, end=110, fill=(251, 113, 133))
            draw.pieslice((sx + sw - 130, sy + 120, sx + sw - 30, sy + 220), start=110, end=250, fill=(96, 165, 250))
            draw.pieslice((sx + sw - 130, sy + 120, sx + sw - 30, sy + 220), start=250, end=360, fill=(34, 197, 94))


def draw_stats(draw, box):
    x1, y1, x2, y2 = box
    items = [
        ("15 / 15", "runtime smoke checks passed"),
        ("MySQL", "database connection verified"),
        ("Build OK", "frontend production build passed"),
        ("3 Roles", "citizen, vendor, admin flows tested"),
    ]
    gap = 12
    bw = (x2 - x1 - gap) // 2
    bh = 122
    for idx, (big, small) in enumerate(items):
        row = idx // 2
        col = idx % 2
        bx = x1 + col * (bw + gap)
        by = y1 + row * (bh + gap)
        rrect(draw, (bx, by, bx + bw, by + bh), (248, 251, 255), outline=(216, 228, 248), radius=18)
        draw.text((bx + 16, by + 16), big, font=FONT_STAT, fill=NAVY2)
        draw_wrapped(draw, small, (bx + 16, by + 74, bx + bw - 16, by + bh - 12), FONT_SMALL, fill=MUTED, spacing=4)


def draw_future_grid(draw, box):
    x1, y1, x2, y2 = box
    items = [
        "Native mobile app for citizens and field vendors",
        "Live GIS mapping and zone-wise analytics dashboard",
        "True AI image verification with valid API integration",
        "Payment gateway and municipal ERP integration",
    ]
    gap = 14
    bw = (x2 - x1 - gap) // 2
    bh = 96
    for idx, item in enumerate(items):
        row = idx // 2
        col = idx % 2
        bx = x1 + col * (bw + gap)
        by = y1 + row * (bh + gap)
        rrect(draw, (bx, by, bx + bw, by + bh), (251, 252, 255), outline=(218, 230, 255), radius=18)
        draw_wrapped(draw, item, (bx + 14, by + 16, bx + bw - 14, by + bh - 12), FONT_BODY, fill=NAVY2, spacing=5)


def build():
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle((0, 0, W, H), radius=34, fill=BG, outline=(243, 217, 232), width=8)

    draw.rounded_rectangle((0, 0, W, 94), radius=0, fill=(108, 27, 106))
    draw.text((W // 2, 18), "DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING", anchor="ma", font=FONT_TOP, fill=(255, 255, 255))

    draw.ellipse((80, 130, 220, 270), fill=PURPLE)
    draw.rectangle((140, 180, 270, 295), fill=(255, 255, 255))
    draw.text((300, 125), "DBMS MINI PROJECT", font=FONT_SUBTITLE, fill=PINK)
    draw.text((300, 180), "MICROTENDER", font=FONT_TITLE, fill=NAVY)
    draw.text((300, 300), "AI-Augmented Civic Issue and Micro-Tender Management System", font=FONT_SUBTITLE, fill=NAVY2)
    tagline = (
        "A full-stack platform that converts citizen complaints into trackable micro-tenders, "
        "connects local vendors, supports workflow monitoring, and demonstrates practical relational database design."
    )
    draw_wrapped(draw, tagline, (300, 360, 2540, 450), FONT_BODY, fill=MUTED, spacing=6)

    badge_x = 2770
    for idx, label in enumerate(["MYSQL", "REACT", "EXPRESS"]):
        by = 150 + idx * 80
        rrect(draw, (badge_x, by, badge_x + 360, by + 58), PANEL, outline=(217, 184, 234), radius=18)
        draw.text((badge_x + 180, by + 15), label, anchor="ma", font=FONT_TAG, fill=(91, 21, 143))

    meta_y = 500
    card_w = (W - 2 * MARGIN - 3 * GAP) // 4
    meta = [
        ("Team Members", ["[Student Name 1]", "[Student Name 2]", "[Student Name 3]"]),
        ("Faculty Guide", ["[Guide Name]", "Department of CSE"]),
        ("Institution", ["[College / University Name]", "Academic Year 2025-26"]),
        ("Project Type", ["DBMS Mini Project", "Web Application + MySQL"]),
    ]
    for i, (title, lines) in enumerate(meta):
        draw_meta_card(draw, MARGIN + i * (card_w + GAP), meta_y, card_w, 150, title, lines)

    y = 690
    panel(draw, MARGIN, y, COL_W, 280, "1. Abstract", PINK)
    draw_wrapped(
        draw,
        "MicroTender is a smart civic-maintenance platform where citizens report public issues, administrators review them, and vendors bid to resolve them. The system unifies complaint registration, tender generation, assignment, work tracking, notifications, anti-fraud logging, and citizen ratings in one structured DBMS application.",
        (MARGIN + 18, y + 86, MARGIN + COL_W - 18, y + 250),
        FONT_BODY,
    )

    panel(draw, MARGIN + COL_W + GAP, y, COL_W, 280, "2. Problem Statement", PURPLE)
    draw_bullets(
        draw,
        [
            "Manual civic complaint handling is slow and hard to monitor.",
            "Transparency between citizen, authority, and vendor is limited.",
            "Bidding, work verification, and reporting are often fragmented.",
            "A relational DBMS workflow is needed for traceability and analytics.",
        ],
        (MARGIN + COL_W + GAP + 18, y + 86, MARGIN + 2 * COL_W + GAP - 18, y + 250),
    )

    panel(draw, MARGIN + 2 * (COL_W + GAP), y, COL_W, 280, "3. Objectives", GREEN)
    draw_bullets(
        draw,
        [
            "Design a normalized database for complaints, tenders, vendors, bids, and ratings.",
            "Automate complaint-to-tender conversion and lifecycle tracking.",
            "Support real-time updates, notifications, and completion review.",
            "Provide secure role-based access for citizen, vendor, and admin users.",
        ],
        (MARGIN + 2 * (COL_W + GAP) + 18, y + 86, W - MARGIN - 18, y + 250),
    )

    y += 310
    draw_architecture(draw, panel(draw, MARGIN, y, COL_W * 2 + GAP, 260, "4. System Architecture", BLUE))
    draw_feature_boxes(draw, panel(draw, MARGIN + 2 * (COL_W + GAP), y, COL_W, 380, "5. Key Features", ORANGE))

    y += 410
    draw_timeline(draw, panel(draw, MARGIN, y, COL_W * 2 + GAP, 230, "6. Workflow Lifecycle", TEAL))
    draw_bullets(
        draw,
        [
            "Primary keys and foreign keys across all core entities",
            "Unique constraints for email and duplicate rating control",
            "Status-driven tender and complaint workflow",
            "Indexes on complaints, tenders, vendors, and notifications",
        ],
        panel(draw, MARGIN + 2 * (COL_W + GAP), y, COL_W, 230, "7. DBMS Highlights", GREEN),
    )

    y += 260
    box = panel(draw, MARGIN, y, W - 2 * MARGIN, 1560, "8. ER Diagram and Database Design", PURPLE)
    er_path = ASSETS / "ERdiagramofdbms.png"
    er_img = Image.open(er_path).convert("RGB")
    er_area = (MARGIN + 30, y + 95, W - MARGIN - 30, y + 1170)
    er_w = er_area[2] - er_area[0]
    er_h = er_area[3] - er_area[1]
    er_img.thumbnail((er_w, er_h))
    ex = er_area[0] + (er_w - er_img.width) // 2
    ey = er_area[1] + (er_h - er_img.height) // 2
    rrect(draw, (er_area[0], er_area[1], er_area[2], er_area[3]), (252, 253, 255), outline=(223, 232, 245), radius=20)
    img.paste(er_img, (ex, ey))
    draw.text((MARGIN + 30, y + 1205), "Core Entities", font=FONT_SH, fill=NAVY)
    draw_wrapped(
        draw,
        "Users, Complaints, Micro_Tenders, Vendors, Applications, Work_Updates, Ratings, Notifications, and Fraud_Logs form the core relational design.",
        (MARGIN + 30, y + 1248, MARGIN + 1520, y + 1380),
        FONT_BODY,
    )
    draw.text((MARGIN + 1660, y + 1205), "Relationship Logic", font=FONT_SH, fill=NAVY)
    draw_wrapped(
        draw,
        "A user files complaints, complaints generate tenders, vendors submit applications, tenders receive work updates, and verified work later receives ratings and notifications.",
        (MARGIN + 1660, y + 1248, W - MARGIN - 30, y + 1380),
        FONT_BODY,
    )
    draw.text((MARGIN + 30, y + 1410), "Normalization", font=FONT_SH, fill=NAVY)
    draw_bullets(
        draw,
        [
            "1NF: Atomic attributes for all core tables",
            "2NF: Non-key data depends on the full primary key",
            "3NF: Repeated facts are separated into related tables",
            "Redundancy is reduced while supporting scalable query design",
        ],
        (MARGIN + 30, y + 1450, W - MARGIN - 30, y + 1530),
    )

    y += 1590
    draw_bullets(
        draw,
        [
            "1NF: Atomic user, complaint, bid, and rating fields",
            "2NF: Full functional dependency preserved",
            "3NF: Related facts moved into linked tables",
            "Schema is suitable for reporting and workflow tracking",
        ],
        panel(draw, MARGIN, y, COL_W, 250, "9. Normalization Summary", PINK),
    )
    draw_stack_chips(draw, panel(draw, MARGIN + COL_W + GAP, y, COL_W, 250, "10. Technology Stack", BLUE))
    draw_bullets(
        draw,
        [
            "JWT-based login and role authorization",
            "Password hashing with bcrypt",
            "Input validation and upload restrictions",
            "Fraud logging and audit-friendly workflow tables",
        ],
        panel(draw, MARGIN + 2 * (COL_W + GAP), y, COL_W, 250, "11. Security Features", TEAL),
    )

    y += 280
    draw_mock_screens(draw, panel(draw, MARGIN, y, COL_W * 2 + GAP, 430, "12. Interface Snapshots", ORANGE))
    draw_bullets(
        draw,
        [
            "Improves civic issue transparency and accountability",
            "Creates a traceable tendering workflow over a normalized database",
            "Supports ratings, notifications, and future analytics",
            "Demonstrates practical DBMS design with a real application",
        ],
        panel(draw, MARGIN + 2 * (COL_W + GAP), y, COL_W, 430, "13. Outcomes", GREEN),
    )

    y += 460
    stat_box = panel(draw, MARGIN, y, COL_W * 2 + GAP, 430, "14. Testing and Validation", PURPLE)
    draw_stats(draw, (stat_box[0], stat_box[1], stat_box[2], stat_box[1] + 260))
    draw_wrapped(
        draw,
        "Verified flows include login, complaint submission, approval, vendor bidding, assignment, work updates, admin verification feed, notification read flow, and citizen complaint detail tracking. Note: AI routes fall back when Gemini credentials are invalid, but the DBMS workflow remains functional.",
        (stat_box[0], stat_box[1] + 280, stat_box[2], stat_box[3]),
        FONT_BODY,
        fill=TEXT,
    )
    draw_future_grid(draw, panel(draw, MARGIN + 2 * (COL_W + GAP), y, COL_W, 430, "15. Future Scope", BLUE))

    footer_y = H - 135
    draw.rounded_rectangle((MARGIN, footer_y, W - MARGIN, H - 40), radius=22, fill=(255, 247, 251), outline=(240, 208, 222), width=3)
    draw.text((MARGIN + 20, footer_y + 22), "Poster Export Ready: You can submit this PNG/PDF directly or keep editing the HTML version.", font=FONT_BODY, fill=NAVY)
    draw.text((MARGIN + 20, footer_y + 62), "MicroTender DBMS Poster  |  Relational Database + Full-Stack Application", font=FONT_SH, fill=PINK)

    img.save(OUT_PNG, quality=95)
    img.save(OUT_PDF, "PDF", resolution=200.0)
    print(OUT_PNG)
    print(OUT_PDF)


if __name__ == "__main__":
    build()
