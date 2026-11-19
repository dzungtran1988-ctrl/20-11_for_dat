# Gửi bố — 20/11

A small personal website made as a Vietnamese Teachers' Day (20/11) gift for Dad:
an envelope that opens into a letter, four flip cards, a polaroid family album,
the main handwritten-style letter and a final "hug".

Plain HTML, CSS and JavaScript — no frameworks, no build step. It works on GitHub Pages as it is.

```
20-11-for-dad/
├── index.html            ← page structure (no personal text here)
├── css/style.css         ← all styling (colours are tokens at the top)
├── js/
│   ├── data.js           ← ✏️  ALL text + the photo list — edit this file
│   ├── main.js           ← envelope, cards, letter reveal, hug, music
│   └── gallery.js        ← polaroid album, lightbox, in-browser photos
├── assets/
│   ├── images/           ← your family photos
│   ├── audio/            ← piano.mp3 goes here
│   ├── textures/         ← paper grain
│   └── favicon.svg
└── .nojekyll             ← tells GitHub Pages to serve files as they are
```

---

## 1. Run it locally

You need a small local web server (some browsers block parts of a page opened by double-clicking).
From inside the project folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Other options: `npx serve`, or the "Live Server" extension in VS Code.

**Tip while editing:** add a section name to the address to skip the envelope,
e.g. `http://localhost:8000/#la-thu` (the letter). Sections: `#loi-gui`, `#bon-dieu`, `#ky-niem`, `#la-thu`, `#om-bo`.

## 2. Add family photos

1. Copy the photos into `assets/images/` (for example `photo-01.jpg`, `photo-02.jpg`…).
2. Open `js/data.js` and add one line per photo to the `memories` list at the top:

```js
const memories = [
  { src: "assets/images/photo-01.jpg", caption: "Một khoảnh khắc đáng nhớ", date: "Hè 2015" },
  { src: "assets/images/photo-02.jpg", caption: "", date: "", size: "lg" },
];
```

- `caption` and `date` are optional. Leave them `""` to show none.
- `size` is optional: `"sm"`, `"md"` or `"lg"` (otherwise sizes vary automatically).
- **File names are case-sensitive on GitHub Pages.** `Photo-01.JPG` ≠ `photo-01.jpg`.
- Use names **without accents or spaces** (`ca-nha.jpg`, not `Cả nhà.jpg`): accented names can be
  stored differently by macOS and the web server, and then the photo silently fails to load.
- Full-size originals are kept in `_anh-goc/`, which `.gitignore` keeps out of the repository.
  If you upload through the GitHub website instead of git, don't drag that folder in.
- A photo that can't be found is skipped automatically, and the browser console
  (F12 → Console) prints which path is wrong.
- For fast loading, resize photos to about 1600px on the longest side before adding them
  (on a Mac: open in Preview → Tools → Adjust Size).

> The album never shows placeholder memories. Until you add photos it shows a gentle
> empty state instead. Set `gallery.hideWhenEmpty: true` in `data.js` to hide the section
> completely when there are no photos.

## 3. Edit the letter, the cards and other text

Everything that is *said* on the page lives in `js/data.js`, grouped by section:

| Section | Key in `data.js` |
|---|---|
| Envelope | `envelope` |
| Opening quote + intro | `message` (`quote` is a list, one line per item) |
| Four flip cards | `cards.items` (`front`, `back`, `icon`) |
| Album text | `gallery` |
| The letter | `letter` (`paragraphs`, `closing`, `signature`, `dateLine`) |
| Final hug | `hug` |
| Footer | `footer` |

Rules for safe editing:

- Keep the straight quotes `"…"` around each text and the comma `,` after each item.
- Need a quote mark inside a sentence? Use curly quotes `“ ”`.
- `❤️` anywhere is drawn as a small amber heart that matches the design.
- Set a text to `""` to hide it.
- Card icons available: `book`, `sprout`, `feather`, `coffee`, `heart`, `home`, `star`.
- If the page shows **"Không đọc được nội dung"**, a comma or quote was probably removed by
  accident. The console (F12) shows the line number.

To change colours or fonts, edit the tokens at the top of `css/style.css` (`--cream`, `--navy`, `--amber`, …).

## 4. Background music

1. Put a real piano recording at `assets/audio/piano.mp3` (exactly this name).
2. That's it. A small round music button appears at the bottom-right.

- Music **never autoplays**. It starts only when someone taps the button.
- If someone turned music on before, it starts again when they open the envelope
  (that tap counts as their permission). Turn this off with `music.rememberPreference: false`.
- No file means no button. The page works normally, and the console notes that the file is missing.
- Use music you're allowed to share: your own recording, or a track with a free / CC0 licence
  (for example from the Free Music Archive or Pixabay Music; check each track's licence).
- Keep it small (a 2–4 minute MP3 at 128 kbps is ~2–4 MB). It loops.

## 5. Adding photos from the browser (optional), plus backup and restore

Under the album there is a discreet **"Thêm ảnh vào album"** panel (turn it off with
`gallery.allowUploads: false`).

- **Add:** choose one or more photos, optionally type a caption and a date, then press *Lưu vào album*.
  Photos are resized to 1600px and compressed to JPEG before saving, and stored in the browser's IndexedDB.
- **Delete one:** open it in the lightbox and press *Xoá ảnh này*.
- **Backup (Sao lưu):** downloads `album-tang-bo-YYYY-MM-DD.json` with all browser-added photos.
- **Restore (Khôi phục):** choose that `.json` file on any device/browser to bring the photos back.
  The file is checked first. Invalid files are rejected, broken entries are skipped,
  and photos already present are not duplicated.
- **Delete all (Xoá ảnh đã thêm):** removes only browser-added photos, after a confirmation.

## 6. Deploy to GitHub Pages

1. Create a new repository on GitHub (e.g. `20-11-for-dad`).
2. Upload **all** files and folders from this project, including `.nojekyll`
   (web upload: *Add file → Upload files*, or with git:
   `git init && git add . && git commit -m "Gift for Dad" && git branch -M main && git remote add origin <repo-url> && git push -u origin main`).
3. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   choose `main` and `/ (root)`, then **Save**.
4. After a minute the site is live at `https://<your-username>.github.io/20-11-for-dad/`.

All paths in the project are relative, so it works inside the repository sub-folder.

**Privacy:** the page asks search engines not to index it (`noindex`), but anyone with the link
can open it. On a free GitHub account the repository, **including the photos in `assets/images/`**,
must be public for Pages to work. If that's a concern, only include photos you're comfortable
sharing, or add photos through the browser panel on Dad's own device instead (see below).

## 7. Prepackaged photos vs. browser-stored photos

|  | Prepackaged (`assets/images/` + `data.js`) | Added in the browser (IndexedDB) |
|---|---|---|
| Who sees them | **Everyone** who opens the website | **Only that browser on that device** |
| Survives redeploys | Yes | Yes, but tied to the device |
| Syncs to other devices | Yes (they're part of the site) | **No.** Use Backup → Restore to move them |
| Can be lost when | You delete the files | Browser data is cleared, private/incognito window, or the browser frees space |
| Best for | The photos you want Dad to see wherever he opens the link | Adding photos on Dad's own phone/laptop, or trying things out |

In short: if you add photos through the browser on *your* laptop, Dad **won't** see them on *his*
phone. To show photos everywhere, put them in `assets/images/` and list them in `data.js`.
If you do add photos in the browser, make a backup (.json) and keep it safe.

---

### Accessibility & motion

- Every interaction works with a keyboard (Tab, Enter/Space; ← → and Esc in the photo viewer).
- Screen readers get the full text of each card and of the letter. Controls have Vietnamese labels.
- With *Reduce motion* turned on in the system settings, the envelope opens with a simple fade,
  cards cross-fade instead of flipping, and no hearts fly.
- Tested at 360, 390, 430, 768, 1024 and 1440px wide with no horizontal scrolling.
