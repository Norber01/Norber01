# Notes for Claude

- After making any change, always commit it, push it, and open a pull request into `main` without asking first.
  The owner merges pull requests themselves.
- The main project is the Poultry Tracker app in `poultry-tracker/` (see its README). It is served by GitHub Pages
  from `main`, so changes go live only after the pull request is merged.
- When changing files the app caches, raise the `?v=` number in `index.html`, `shop.html` and `sw.js`
  (and the `CACHE` name in `sw.js`) so phones download the new version.
