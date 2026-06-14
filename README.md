# LaptopFinder

A simple web app to search laptops, filter by specs, and compare up to 4 at once.

HTML, CSS, and JavaScript. Laptop data is in `laptops.csv`.

**Live site:** https://yaminigonuguntla.github.io/laptop-finder/

## How it works

The app shows 150 laptops as cards. Each card has the name, price, and main specs.

**Search** - type a name and press Enter. Use × or Esc to clear the search. Your filters stay as they are.

**Filters** - pick brand, RAM, price, and more from the sidebar. Each checkbox can be off, include (✓), or exclude (✗). Click **Apply filters** when you're done. On a phone, open filters with the **☰ Filters** button.

**Keywords** - type any term to include or exclude it.

**Applied bar** - shows what's currently filtering the results. Click a tag to change it or remove it.

**Compare** - add up to 4 laptops to the bar at the bottom, then open the compare view to see specs side by side.

**Price popup** - click a card to see sample prices from four stores. The prices are fake; the links open a real search for that laptop on each store.

## Run locally

The app needs a local server. Open a terminal in this folder and run:

```bash
python -m http.server 5500
```

Then go to http://localhost:5500

Don't open `index.html` directly - the CSV won't load that way.

## Data

All laptops are in `laptops.csv`. Edit the file and refresh the page to see changes.
