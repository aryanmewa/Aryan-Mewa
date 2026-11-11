#!/bin/bash
# Update photos: reads the "profile-photo" and "gallery" folders and writes assets/photos.js,
# which is what the website uses to know which photos to show.
# Double-click this file (macOS), or run:  ./update-photos.command

cd "$(dirname "$0")" || exit 1
mkdir -p profile-photo gallery green-synthesis-report cv

# "When was this file added?" -> inode change time (set when a file lands in the folder).
if [ "$(uname)" = "Darwin" ]; then
  added() { stat -f %c "$1"; }
else
  added() { stat -c %Z "$1"; }
fi

is_image() {
  case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in
    *.jpg|*.jpeg|*.png|*.webp|*.avif|*.gif) return 0 ;;
    *) return 1 ;;
  esac
}
# Escape a string for use inside a JavaScript "double quoted" string.
js() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

# Caption for an image: the text file with the same name next to it (stage.jpg -> stage.txt).
caption_for() {
  local d b stem ext txt=""
  d="$(dirname "$1")"; b="$(basename "$1")"; stem="${b%.*}"
  for ext in txt TXT Txt; do
    if [ -f "$d/$stem.$ext" ]; then txt="$d/$stem.$ext"; break; fi
  done
  [ -z "$txt" ] && return 0
  tr '\r\n\t' '   ' < "$txt" | LC_ALL=C sed $'s/^\xEF\xBB\xBF//' | tr -d '\000-\010\013\014\016-\037' \
    | tr -s ' ' | sed -e 's/^ *//' -e 's/ *$//'
}
# Is there an image with the same name as this text file?
has_image_for() {
  local d b stem e
  d="$(dirname "$1")"; b="$(basename "$1")"; stem="${b%.*}"
  for e in jpg jpeg png webp avif gif JPG JPEG PNG WEBP AVIF GIF Jpg Jpeg Png; do
    [ -f "$d/$stem.$e" ] && return 0
  done
  return 1
}

skipped=""
note_skip() { skipped="$skipped
  - $1"; }

# ---------------------------------------------------------------- profile photo (latest wins)
portrait_json="null"
portrait_name=""
best=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  base="$(basename "$f")"
  case "$base" in .*|*.txt|*.md|*.TXT|*.MD) continue ;; esac
  if ! is_image "$base"; then note_skip "$f (not a supported image type)"; continue; fi
  case "$base" in *\"*|*\\*) note_skip "$f (rename it: no quotes or backslashes)"; continue ;; esac
  t="$(added "$f")"
  if [ "$t" -ge "$best" ]; then best="$t"; portrait_name="$f"; fi
done < <(find profile-photo -maxdepth 1 -type f 2>/dev/null)
if [ -n "$portrait_name" ]; then
  portrait_json="{\"src\":\"$(js "$portrait_name")\",\"added\":$best}"
fi

# ---------------------------------------------------------------- PDFs: green synthesis report and CV (newest PDF in each folder wins)
newest_pdf() {   # $1 = folder -> sets NP_NAME and NP_T
  NP_NAME=""; NP_T=0
  local f t
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$(basename "$f")" in *\"*|*\\*) note_skip "$f (rename it: no quotes or backslashes)"; continue ;; esac
    t="$(added "$f")"
    if [ "$t" -ge "$NP_T" ]; then NP_T="$t"; NP_NAME="$f"; fi
  done < <(find "$1" -maxdepth 1 -type f -iname '*.pdf' 2>/dev/null)
  # warn about files that are not PDFs (e.g. a Word CV)
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$(basename "$f")" in .*|README.txt|readme.txt) continue ;; esac
    note_skip "$f (only PDF files are used here; export it as a PDF)"
  done < <(find "$1" -maxdepth 1 -type f ! -iname '*.pdf' 2>/dev/null)
}
pdf_json() { if [ -n "$NP_NAME" ]; then printf '{"src":"%s","added":%s}' "$(js "$NP_NAME")" "$NP_T"; else printf 'null'; fi; }

newest_pdf green-synthesis-report; report_name="$NP_NAME"; report_json="$(pdf_json)"
newest_pdf cv;                     cv_name="$NP_NAME";     cv_json="$(pdf_json)"

# ---------------------------------------------------------------- gallery (newest first)
tmp="$(mktemp)"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  base="$(basename "$f")"
  case "$base" in
    .*|README.txt|readme.txt|*.md|*.MD) continue ;;
    *.txt|*.TXT|*.Txt)
      if ! has_image_for "$f"; then note_skip "$f (caption file with no photo of the same name)"; fi
      continue ;;
  esac
  if ! is_image "$base"; then note_skip "$f (not a supported image type)"; continue; fi
  case "$f" in *\"*|*\\*) note_skip "$f (rename it: no quotes or backslashes)"; continue ;; esac
  printf '%s\t%s\n' "$(added "$f")" "$f" >> "$tmp"
done < <(find gallery -maxdepth 2 -type f 2>/dev/null)

count=0
ncap=0
entries=""
while IFS="$(printf '\t')" read -r t f; do
  [ -z "$f" ] && continue
  rel="${f#gallery/}"
  case "$rel" in */*) activity="${rel%%/*}" ;; *) activity="" ;; esac
  cap="$(caption_for "$f")"
  [ -n "$cap" ] && ncap=$((ncap + 1))
  [ -n "$entries" ] && entries="$entries,"
  entries="$entries
    {\"src\":\"$(js "$f")\",\"activity\":\"$(js "$activity")\",\"caption\":\"$(js "$cap")\",\"added\":$t}"
  count=$((count + 1))
done < <(LC_ALL=C sort -t "$(printf '\t')" -k1,1nr -k2,2 "$tmp")
rm -f "$tmp"

out="assets/photos.js"
{
  echo "/* Written by update-photos.command. Do not edit by hand: re-run the script instead. */"
  echo "window.SITE_PHOTOS = {"
  echo "  \"portrait\": $portrait_json,"
  echo "  \"reports\": {\"greenSynthesis\": $report_json, \"cv\": $cv_json},"
  echo "  \"gallery\": [$entries"
  echo "  ]"
  echo "};"
} > "$out.tmp" && mv "$out.tmp" "$out"

echo "Photos updated."
if [ -n "$portrait_name" ]; then echo "  Profile photo : $portrait_name"; else echo "  Profile photo : none (put one in the profile-photo folder)"; fi
if [ -n "$report_name" ]; then echo "  Green synthesis report : $report_name"; else echo "  Green synthesis report : none (put a PDF in the green-synthesis-report folder)"; fi
if [ -n "$cv_name" ]; then echo "  CV                     : $cv_name"; else echo "  CV                     : none (put your CV PDF in the cv folder)"; fi
echo "  Gallery       : $count photo(s), $ncap with captions"
if [ -n "$skipped" ]; then echo; echo "Skipped:$skipped"; echo "(Supported: JPG, PNG, WebP, AVIF, GIF. Export HEIC photos as JPG first.)"; fi
echo
echo "Now refresh the website in your browser (Cmd+Shift+R)."
# Keep the window open when double-clicked.
if [ -t 0 ] && [ -z "$CI" ]; then read -r -p "Press Return to close. " _; fi
