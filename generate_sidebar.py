#!/usr/bin/env python3
"""
generate_sidebar.py
───────────────────
Scans the images folder for category subfolders and equipment images,
then generates the sidebar HTML block to paste into index.html.

Expected folder layout
──────────────────────
gymplanner/
  generate_sidebar.py   ← this script
  images/
    Artistic/
      Vault.png
      Balance beam.png
    Trampolining/
      Trampoline.png
    Mats & Flooring/
      Landing mat.png

Rules
─────
- Subfolder name  → category name shown in the sidebar
- Image filename  → equipment label (extension is stripped)
- Supported image types: png, jpg, jpeg, gif, webp, svg

After running, copy the content of sidebar.html and replace the
<aside class="sidebar">…</aside> block in index.html with it.
"""

import re
import sys
from pathlib import Path

# ═══════════════════════════════════════════════
# CONFIGURATION — edit these if needed
# ═══════════════════════════════════════════════

# Folder containing your category subfolders.
# Path(__file__).parent means "same folder as this script".
INPUT_FOLDER = Path(__file__).parent / "images"

# Where to write the result.
# Set to None to print to the terminal instead of a file.
OUTPUT_FILE = Path(__file__).parent / "sidebar.html"

# Web path prefix used in the HTML src attributes.
# Keep as "images" unless you move the images folder somewhere else.
IMG_ROOT = "images"

# Which categories start expanded in the sidebar.
# Options: "first" (only the first), "all", "none"
OPEN_MODE = "first"

# ═══════════════════════════════════════════════
# CATEGORY ICONS
# The first keyword that appears in the category name (case-insensitive)
# determines the icon. Add your own rows as needed.
# ═══════════════════════════════════════════════
CATEGORY_ICONS = [
    ("artistic",   "🤸"),
    ("trampolin",  "🔴"),
    ("mat",        "🟦"),
    ("floor",      "🟦"),
    ("condition",  "🟩"),
    ("training",   "🟩"),
    ("furniture",  "🪑"),
    ("safety",     "🛡️"),
    ("acrobat",    "⭐"),
    ("rhythmic",   "🎗️"),
    ("tumbl",      "🌀"),
    ("aerobic",    "💪"),
    ("parkour",    "🏃"),
]
DEFAULT_ICON = "📦"

# ═══════════════════════════════════════════════
# SUPPORTED IMAGE EXTENSIONS
# ═══════════════════════════════════════════════
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}


# ───────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────

def pick_icon(category_name):
    lower = category_name.lower()
    for keyword, icon in CATEGORY_ICONS:
        if keyword in lower:
            return icon
    return DEFAULT_ICON


def slugify(text):
    """'Balance beam' -> 'balance-beam'"""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def escape_html(text):
    return (text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;"))


# ───────────────────────────────────────────────
# Scan
# ───────────────────────────────────────────────

def scan_equipment():
    if not INPUT_FOLDER.is_dir():
        print(f"ERROR: Folder not found: {INPUT_FOLDER.resolve()}", file=sys.stderr)
        sys.exit(1)

    subdirs = sorted(
        [d for d in INPUT_FOLDER.iterdir() if d.is_dir()],
        key=lambda d: d.name.lower()
    )

    if not subdirs:
        print(f"WARNING: No subfolders found in {INPUT_FOLDER}.", file=sys.stderr)

    categories = []

    for subdir in subdirs:
        image_files = sorted(
            [f for f in subdir.iterdir()
             if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS],
            key=lambda f: f.stem.lower()
        )

        if not image_files:
            print(f"  (skipping empty folder: {subdir.name})", file=sys.stderr)
            continue

        items = []
        seen_ids = set()

        for img_file in image_files:
            label = img_file.stem
            slug  = slugify(label)

            # Handle duplicate slugs within the same category
            unique_slug = slug
            counter = 2
            while unique_slug in seen_ids:
                unique_slug = f"{slug}-{counter}"
                counter += 1
            seen_ids.add(unique_slug)

            # Always use forward slashes in the web path
            web_path = "/".join([IMG_ROOT.rstrip("/"), subdir.name, img_file.name])

            items.append({"id": unique_slug, "label": label, "img": web_path})

        categories.append({
            "name":  subdir.name,
            "icon":  pick_icon(subdir.name),
            "items": items,
        })

    return categories


# ───────────────────────────────────────────────
# Render
# ───────────────────────────────────────────────

def render_html(categories):
    lines = []
    lines.append('    <aside class="sidebar">')
    lines.append('      <p class="sidebar-hint">Drag items onto the floor to place them.<br>Drag a placed item to the bin to remove it.</p>')
    lines.append('')

    for i, cat in enumerate(categories):
        if OPEN_MODE == "all":
            is_open = "true"
        elif OPEN_MODE == "none":
            is_open = "false"
        else:
            is_open = "true" if i == 0 else "false"

        name = escape_html(cat["name"])
        lines.append(f'      <div class="category" data-open="{is_open}">')
        lines.append(f'        <button class="category-header">')
        lines.append(f'          <span class="category-icon">{cat["icon"]}</span>')
        lines.append(f'          <span class="category-name">{name}</span>')
        lines.append(f'          <span class="category-chevron">▾</span>')
        lines.append(f'        </button>')
        lines.append(f'        <ul class="category-items">')

        for item in cat["items"]:
            id_esc    = escape_html(item["id"])
            label_esc = escape_html(item["label"])
            img_esc   = escape_html(item["img"])

            lines.append(f'          <li class="equipment-item"')
            lines.append(f'              draggable="true"')
            lines.append(f'              data-id="{id_esc}"')
            lines.append(f'              data-label="{label_esc}"')
            lines.append(f'              data-img="{img_esc}">')
            lines.append(f'            <span class="item-label">{label_esc}</span>')
            lines.append(f'            <span class="item-count" data-for="{id_esc}">0</span>')
            lines.append(f'          </li>')

        lines.append(f'        </ul>')
        lines.append(f'      </div>')
        lines.append('')

    lines.append('    </aside>')
    return "\n".join(lines)


def print_summary(categories):
    total = sum(len(c["items"]) for c in categories)
    print(f"\n  Found {len(categories)} categories, {total} items:\n", file=sys.stderr)
    for cat in categories:
        print(f"  {cat['icon']}  {cat['name']}  ({len(cat['items'])} items)", file=sys.stderr)
        for item in cat["items"]:
            print(f"       - {item['label']}  ->  {item['img']}", file=sys.stderr)
    print("", file=sys.stderr)


# ───────────────────────────────────────────────
# Run
# ───────────────────────────────────────────────

categories = scan_equipment()

if not categories:
    print("ERROR: No equipment found. Check your folder structure.", file=sys.stderr)
    sys.exit(1)

print_summary(categories)
html = render_html(categories)

if OUTPUT_FILE:
    OUTPUT_FILE.write_text(html, encoding="utf-8")
    print(f"  Written to: {OUTPUT_FILE.resolve()}", file=sys.stderr)
else:
    print(html)
