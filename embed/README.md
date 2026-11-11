# Embeddable Morse widget

Add this script to a page:

```html
<script src="https://morse-code-translator-jade.vercel.app/embed.js" data-width="100%" data-height="360"></script>
```

The script inserts a sandbox widget iframe hosted at `/embed/`. The widget runs its own lightweight Morse encoder/decoder locally. The embed route has a dedicated CSP rule that permits framing; other app routes remain protected by same-origin frame restrictions. The widget currently covers International A–Z and digits.
