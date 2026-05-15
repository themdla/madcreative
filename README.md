# MAD Creative

Static production site for MAD Creative.

## Add Work

Drop images or videos into the matching folder:

- `media/photography/`
- `media/design/`
- `media/digital-art/`
- `media/film/`

Subfolders become tags. For example:

```text
media/photography/portraits/01-neon-session.jpg
```

Shows as `Neon Session` with the tags `Photography | Portraits`.

Video files work in `media/film/`. For best browser support, use `.mp4` or `.webm`. Add a poster by placing a matching image next to the video:

```text
media/film/music-videos/01-opening-cut.mp4
media/film/music-videos/01-opening-cut-poster.jpg
```

Then rebuild the manifest:

```bash
npm run build:media
```

Optional sidecar metadata can override the title, alt text, and tags:

```json
{
  "title": "Opening Cut",
  "alt": "Behind the scenes still from Opening Cut",
  "tags": ["Music Video"]
}
```

Save it next to the media file with the same base name, like `01-opening-cut.json`.

## Local Preview

```bash
npm run build
npm run serve
```

Then open `http://localhost:4173`.
