from pathlib import Path
from math import sin
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DOCS.mkdir(exist_ok=True)

REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size: int, bold: bool = False):
    return ImageFont.truetype(BOLD if bold else REGULAR, size)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def pill(draw, x, y, text, fill=(255, 255, 255, 18), fg="#edf1f7", size=13):
    f = font(size, True)
    left, top, right, bottom = draw.textbbox((0, 0), text, font=f)
    w = right - left + 28
    h = bottom - top + 14
    rounded(draw, (x, y, x + w, y + h), h // 2, fill)
    draw.text((x + 14, y + 6), text, font=f, fill=fg)
    return w


def base_frame():
    image = Image.new("RGB", (960, 540), "#090b10")
    d = ImageDraw.Draw(image, "RGBA")
    d.ellipse((-120, -180, 300, 240), fill=(255, 79, 102, 32))
    d.ellipse((660, -170, 1120, 290), fill=(62, 135, 238, 24))
    rounded(d, (42, 38, 918, 132), 22, (255, 255, 255, 12))
    d.text((68, 62), "OPENCOMPRESS STUDIO V2.1", font=font(13, True), fill="#ff6576")
    d.text((68, 86), "Local batch image compressor", font=font(29, True), fill="white")

    rounded(d, (42, 165, 290, 510), 22, "#10141d", (255, 255, 255, 18))
    rounded(d, (316, 165, 918, 510), 22, "#10141d", (255, 255, 255, 18))
    rounded(d, (65, 188, 267, 262), 16, (255, 255, 255, 12), (255, 255, 255, 24))
    d.text((95, 216), "Drop images here", font=font(15, True), fill="white")
    rounded(d, (65, 287, 267, 318), 9, (255, 255, 255, 18))
    rounded(d, (65, 331, 267, 362), 9, (255, 255, 255, 18))
    rounded(d, (65, 395, 267, 434), 12, "#ff6477")
    d.text((107, 407), "Compress images", font=font(13, True), fill="white")

    rounded(d, (339, 185, 714, 410), 16, "#151a24")
    rounded(d, (735, 185, 892, 410), 16, (255, 255, 255, 10))
    d.text((750, 215), "Original", font=font(10), fill="#8e98aa")
    d.text((822, 215), "2.4 MB", font=font(12, True), fill="white")
    d.text((750, 257), "Optimized", font=font(10), fill="#8e98aa")
    d.text((816, 257), "680 KB", font=font(12, True), fill="white")
    d.text((750, 299), "Saved", font=font(10), fill="#8e98aa")
    d.text((824, 299), "-72%", font=font(15, True), fill="#7ff3a2")
    rounded(d, (735, 353, 892, 393), 11, "#ff6477")
    d.text((773, 365), "Download ZIP", font=font(12, True), fill="white")
    rounded(d, (339, 431, 892, 476), 13, (255, 255, 255, 10))
    d.text((360, 446), "Batch results • local only • optional reSmush.it API", font=font(11), fill="#cbd4e2")
    return image


def status(image, step, text, progress):
    d = ImageDraw.Draw(image, "RGBA")
    rounded(d, (48, 141, 912, 165), 11, (4, 6, 10, 230), (255, 255, 255, 16))
    rounded(d, (57, 145, 94, 161), 8, "#ff6477")
    d.text((68, 147), step, font=font(8, True), fill="white")
    d.text((118, 146), text, font=font(10, True), fill="#edf1f7")
    rounded(d, (685, 149, 890, 157), 4, (255, 255, 255, 24))
    rounded(d, (685, 149, 685 + int(205 * max(0, min(1, progress))), 157), 4, "#ff6477")


def cursor(draw, x, y, click=False):
    points = [(x, y), (x + 2, y + 19), (x + 7, y + 14), (x + 12, y + 25), (x + 17, y + 22), (x + 12, y + 12), (x + 21, y + 11)]
    draw.polygon(points, fill="white", outline="#11151e")
    if click:
        draw.ellipse((x - 15, y - 15, x + 15, y + 15), outline=(255, 101, 118, 115), width=2)


def file_cards(image, count):
    d = ImageDraw.Draw(image, "RGBA")
    colors = ["#ff6778", "#3e87ee", "#7ff3a2", "#ffb45f", "#b67cff"]
    for i in range(min(count, 20)):
        col, row = i % 4, i // 4
        x, y = 72 + col * 47, 275 + row * 38
        rounded(d, (x, y, x + 38, y + 31), 6, (255, 255, 255, 15), (255, 255, 255, 22))
        d.rectangle((x + 4, y + 4, x + 34, y + 21), fill=colors[i % len(colors)])
        d.text((x + 5, y + 22), f"{i + 1:02d}.jpg", font=font(5), fill="#cbd4e2")


def autobest(image, phase):
    d = ImageDraw.Draw(image, "RGBA")
    rounded(d, (58, 279, 274, 326), 11, (255, 95, 112, 20), (255, 101, 118, 150), 2)
    d.text((73, 286), "Compression method", font=font(8), fill="#8e98aa")
    d.text((73, 303), "Auto Best local  ▾", font=font(10, True), fill="white")
    rounded(d, (355, 236, 702, 393), 14, (7, 10, 15, 225), (255, 255, 255, 20))
    d.text((370, 250), "Auto Best candidates", font=font(14, True), fill="white")
    rows = [("WebP", "680 KB", "Q82"), ("JPG", "745 KB", "Q82"), ("PNG", "1.8 MB", "Q90")]
    for i, row in enumerate(rows):
        y = 281 + i * 31
        rounded(d, (370, y, 686, y + 24), 8, (255, 255, 255, 16 if phase <= i else 25))
        d.text((382, y + 6), row[0], font=font(8, True), fill="#edf1f7")
        d.text((475, y + 6), row[1], font=font(8, True), fill="#7ff3a2" if i == 0 and phase >= 3 else "#cbd4e2")
        d.text((623, y + 6), row[2], font=font(8), fill="#8e98aa")


def before_after(image, split):
    d = ImageDraw.Draw(image, "RGBA")
    x1, y1, x2, y2 = 339, 185, 714, 410
    d.rectangle((x1, y1, x2, y2), fill="#202838")
    d.rectangle((x1 + split, y1, x2, y2), fill="#121720")
    cx, cy = 525, 298
    d.ellipse((cx - 80, cy - 80, cx + 80, cy + 80), fill="#f6f1ea")
    d.ellipse((cx - 43, cy - 50, cx + 43, cy + 50), fill="#ff6477")
    d.rectangle((cx - 14, cy - 72, cx + 14, cy + 72), fill="#11151d")
    sx = x1 + split
    d.line((sx, y1, sx, y2), fill="white", width=2)
    d.ellipse((sx - 8, cy - 8, sx + 8, cy + 8), fill="white")
    d.text((351, 197), "Before", font=font(8, True), fill="white")
    d.text((664, 197), "After", font=font(8, True), fill="white")


def generate_demo():
    fps = 4
    seconds = 18
    frames = []
    for n in range(fps * seconds):
        t = n / fps
        image = base_frame()
        d = ImageDraw.Draw(image, "RGBA")
        if t < 4:
            count = max(0, min(20, int((t - 0.5) * 7)))
            status(image, "1/4", f"Add a batch — {count}/20 images", (t - 0.5) / 3)
            file_cards(image, count)
            cursor(d, 178, 223, 2.25 < t < 2.75)
        elif t < 8:
            status(image, "2/4", "Choose Auto Best local — no cloud upload", (t - 4) / 4)
            file_cards(image, 20)
            autobest(image, min(3, int(max(0, t - 5) / 0.65)))
            cursor(d, 238, 304, 4.75 < t < 5.25)
        elif t < 13:
            status(image, "3/4", "Compare quality before vs after", (t - 8) / 5)
            split = int(40 + 285 * (0.5 + 0.5 * sin((t - 8) * 1.35)))
            before_after(image, split)
            cursor(d, 339 + split, 398)
        else:
            status(image, "4/4", "Export the optimized batch as one ZIP", (t - 13) / 5)
            before_after(image, 188)
            glow = int(130 + 80 * (0.5 + 0.5 * sin((t - 13) * 3)))
            rounded(d, (729, 347, 898, 401), 14, (255, 95, 112, glow), (255, 255, 255, 35), 2)
            d.text((768, 365), "Download ZIP", font=font(12, True), fill="white")
            cursor(d, 815, 375, 14.25 < t < 14.75)
            if t > 15:
                d.text((365, 450), "✓ Batch ready — 34.6 MB → 9.8 MB", font=font(10, True), fill="#7ff3a2")
        frames.append(image.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))

    frames[0].save(
        DOCS / "demo.gif",
        save_all=True,
        append_images=frames[1:],
        duration=250,
        loop=0,
        optimize=True,
        disposal=2,
    )


def generate_social_preview():
    image = Image.new("RGB", (1280, 640), "#090b10")
    d = ImageDraw.Draw(image, "RGBA")
    for radius in range(340, 0, -14):
        alpha = int(34 * (1 - radius / 340) ** 1.4)
        d.ellipse((160 - radius, 40 - radius, 160 + radius, 40 + radius), fill=(255, 79, 102, alpha))
    for radius in range(380, 0, -14):
        alpha = int(32 * (1 - radius / 380) ** 1.4)
        d.ellipse((1180 - radius, 110 - radius, 1180 + radius, 110 + radius), fill=(62, 135, 238, alpha))

    rounded(d, (58, 54, 268, 88), 17, (255, 95, 112, 32), (255, 101, 118, 80))
    d.text((78, 64), "OPENCOMPRESS", font=font(14, True), fill="#ff6576")
    d.text((58, 124), "Private-by-default", font=font(54, True), fill="white")
    d.text((58, 184), "batch image compression", font=font(54, True), fill="white")
    d.text((60, 258), "Compress • resize • convert • SEO rename • ZIP export", font=font(22), fill="#cbd4e2")
    x = 60
    for text in ["LOCAL FIRST", "AUTO BEST", "WEBP / JPG / PNG", "NO ACCOUNT"]:
        x += pill(d, x, 310, text) + 10

    rounded(d, (650, 348, 1220, 595), 24, "#10141d", (255, 255, 255, 25))
    rounded(d, (680, 378, 1005, 556), 18, "#1b2130")
    d.rectangle((680, 378, 842, 556), fill="#252c3b")
    d.ellipse((753, 418, 925, 552), fill="#f6f1ea")
    d.ellipse((786, 440, 891, 535), fill="#ff6477")
    d.line((842, 378, 842, 556), fill="white", width=2)
    d.text((694, 392), "Before", font=font(11, True), fill="white")
    d.text((934, 392), "After", font=font(11, True), fill="white")

    rounded(d, (1028, 378, 1192, 556), 15, (255, 255, 255, 12))
    d.text((1047, 400), "2.4 MB", font=font(17, True), fill="white")
    d.text((1047, 431), "→ 680 KB", font=font(17, True), fill="white")
    d.text((1047, 475), "-72%", font=font(28, True), fill="#7ff3a2")
    rounded(d, (1047, 519, 1175, 544), 10, "#ff6477")
    d.text((1069, 525), "ZIP export", font=font(10, True), fill="white")
    d.text((58, 555), "github.com/SLP-DEV1/OpenCompress", font=font(18, True), fill="#8e98aa")
    image.save(DOCS / "social-preview.png", optimize=True)


if __name__ == "__main__":
    generate_demo()
    generate_social_preview()
    print("Generated docs/demo.gif and docs/social-preview.png")
