# Maria & Johan

A mobile-friendly wedding website where guests can upload photos and browse the
shared gallery.

## Storage

Photos are uploaded directly to the web server:

- Optimized full-size images are stored in `uploads/`.
- Small and fast gallery thumbnails are stored in `uploads/thumbs/`.
- Gallery metadata is stored in `data/photos.json`.

The six fixed photos in `assets/photos/` are always displayed first. Guest
photos appear below them, newest first, with 24 photos shown per page.

## Deployment on Simply.com

Upload the contents of this directory to:

```text
/public_html/mariaochjohan
```

The `data`, `uploads`, and `uploads/thumbs` directories must be writable by PHP.
The normal directory permission on Simply.com is `755`. Use `775` if uploads
fail because of write permissions.

Do not delete the existing `data/photos.json` or `uploads/` directory during
future deployments, as they contain the guests’ uploaded photos.
