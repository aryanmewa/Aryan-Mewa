# Aryan Mewa — Physics, Pedagogy & Creative Media Portfolio

A five-page portfolio for **Aryan Mewa** (Integrated B.Sc.–B.Ed. in Physics, IIT Jodhpur): one quiet, illustrated environment — afternoon light, original layered scenes, editorial type. Sections are separated by whitespace, thin rules and tonal washes rather than stacks of boxes. No frameworks, no build step.

## Pages

| Page | Scene | What it holds |
|---|---|---|
| `index.html` | Riverside, afternoon | Hero with your portrait, index of sections, **Gallery** (photos from the `gallery` folder), pull quote |
| `teaching.html` | School corridor | Principles, subject knowledge, skills |
| `projects.html` | Neem branch | Green-synthesis and Scratch game projects, toolbox |
| `experience.html` | Railway crossing | Prometeo 2026 media leadership, cinematography |
| `contact.html` | Residential street | Email (copy), campus address, CV |

## Your photos, report and CV: four folders

| Folder | What goes in it | Where it shows |
|---|---|---|
| `profile-photo/` | Your photograph (JPG, PNG, WebP or AVIF). The **most recently added** file is used. | Home page portrait |
| `gallery/` | Any number of photographs (JPG, PNG, WebP, AVIF, GIF) | Gallery section on the Home page |
| `cv/` | Your CV as a PDF (newest PDF is used) | "Download Curriculum Vitae (PDF)" button on the Contact page, and the "Curriculum Vitae" link on Home opens it; hidden until a PDF is added |
| `green-synthesis-report/` | The PDF of your green synthesis report or poster (newest PDF is used) | "Read the report (PDF)" button on the Projects page; hidden until a PDF is added |

**After adding, replacing or removing photos, double-click `update-photos.command`** (macOS; it can also be run in a terminal with `./update-photos.command`), then refresh the browser. The script reads the two folders and writes `assets/photos.js`, which is how the site knows what to show. A plain static web page cannot look inside a folder by itself, so this one step is needed. If macOS asks for permission the first time, right-click the file and choose **Open**.

**Profile photo.** Drop a new photo into `profile-photo/` and run the script: the newest one replaces the old. Older files can stay or be deleted. Until a photo is present, a labelled placeholder is shown.

**Gallery.** Photos placed directly in `gallery/` appear under "Moments". To group photos by event, make a sub-folder; its name becomes the heading (`gallery/Prometeo 2026/stage.jpg` → "Prometeo 2026"; `film-sets` → "Film sets"). **Captions:** to put text in the footer of a photo, save a plain text file with the *same name* next to it (`stage.jpg` → `stage.txt`) and run the script. The full text appears in a soft band at the bottom of the photo. Photos without a text file simply have no caption. Newest first. Original proportions are always kept. Photos are display-only: clicking one does nothing. Aim for about 2000 px on the long side so the page loads quickly.

**Publishing.** When you deploy the site, upload the `profile-photo/`, `gallery/`, `cv/` and `green-synthesis-report/` folders together with `assets/photos.js` (run the script first). Visitors see exactly what was in the folders when you last ran the script.

## Structure

```
index.html … contact.html
update-photos.command   rebuilds assets/photos.js from the two photo folders
profile-photo/          your profile photo (newest file is used)
gallery/                gallery photos (sub-folders = event headings)
green-synthesis-report/ the report PDF for the Projects page
cv/                     your CV (PDF) for the Contact page
assets/
  style.css     design tokens, layout, components
  site.js       nav, copy-email, CV note
  portrait.js   shows the profile photo
  gallery.js    gallery layout
  report.js     shows the report button when a PDF is present
  photos.js     generated list of photos (do not edit by hand)
  scenes/*.svg  original layered illustrations
```

Fonts (Cormorant Garamond, Inter) load from Google Fonts with native fallbacks.

## Design notes

- Palette lives in `:root` in `assets/style.css`. Body and caption text use darker ink tones for contrast; the nav is solid (no blur); grain sits behind content; blur in the illustrations is kept low so edges stay crisp.
- Motion is slow and optional and is disabled under `prefers-reduced-motion`.

## Dark mode

The round sun/moon button at the right of the menu bar switches between light and dark. The site always opens in the light (daylight) theme, whatever the visitor's system setting; if a visitor switches to dark, their choice is remembered in their browser. Dark mode keeps the same fonts, layout and artwork; the palette settles into slate blue and the illustrations are dimmed. The colours live in the `:root[data-theme="dark"]` block at the end of `assets/style.css`.

## Social links

LinkedIn and Instagram appear as round buttons on the Contact page and in every page's footer. To change a link, search the `.html` files for `linkedin.com/in/` or `instagram.com/` and replace the address (it appears in each page's footer and once more on `contact.html`).

## Updating your CV

Drop the new PDF into `cv/` and run `update-photos.command`. The newest PDF replaces the old one on the site.

## View locally

Double-click `index.html`, or run `python3 -m http.server 8000` here and open `http://localhost:8000`.
