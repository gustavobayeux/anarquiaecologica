# Lycalopex - Territorial Observation

A static web application for mapping agro-industrial and agro-livestock structures with potential demand for building maintenance and safety services.

## Overview

**Lycalopex** is an urban-critical mapping tool that visualizes agro-industrial infrastructure across territories. The name references South American foxes affected by aggressive urban expansion in Latin America.

**Core Principles:**
- Territorial observation
- Spatial awareness
- Critical minimalism
- Industrial and urban sobriety

## Project Structure

```
lycalopex/
├── index.html          # Main HTML file
├── css/
│   └── style.css       # Styling (dark theme)
├── js/
│   ├── app.js          # Main application logic
│   ├── score.js        # Lycalopex scoring algorithm
│   └── api.js          # Data fetching and API integration
└── README.md           # This file
```

## Features

### 1. Interactive Map
- **Leaflet.js** map with dark mode aesthetic
- Centered on configurable regions (default: Brazil)
- Circle markers with color-coding by risk score

### 2. Data Integration
Currently uses sample data. Ready for integration with:
- Brazilian CNPJ public API
- OpenStreetMap Nominatim (geocoding)
- Municipal open data sources

### 3. Filters
- **Structure type**: silo, warehouse, slaughterhouse, other
- **Company age**: >= 10, 20, or 30 years
- **Minimum score**: 0-100

### 4. Lycalopex Score Algorithm

Scoring system (0-100 points):

| Criteria | Points |
|----------|--------|
| Company age >= 30 years | +30 |
| Company age >= 20 years | +20 |
| Company age >= 10 years | +10 |
| Silo/warehouse/slaughterhouse | +25 |
| Agro/industrial CNAE | +20 |
| Rural/industrial zone | +15 |

**Classifications:**
- **0–40**: Low potential
- **41–70**: Medium potential  
- **71–100**: High potential

### 5. Side Panel
Click any marker to view:
- Company name
- CNPJ
- Full address
- Establishment year
- Structure type
- Score with objective justification

### 6. Export
Download filtered results as CSV with all company data and scores.

## How to Use Locally

### Option A: Simple (No Server)
1. Navigate to the `lycalopex` folder
2. Double-click `index.html`
3. The app opens in your default browser

**Note:** Some features may be restricted due to browser CORS policies with `file://` URLs.

### Option B: Local Server (Recommended)

Using Python (built-in):
```bash
cd lycalopex
python3 -m http.server 8000
```

Then visit: `http://localhost:8000`

Using Node.js (if installed):
```bash
cd lycalopex
npx serve .
```

## How to Deploy to GitHub Pages

### Step 1: Push to GitHub

```bash
cd /path/to/anarquiaecologica
git add lycalopex/ .github/workflows/
git commit -m "Add Lycalopex project with GitHub Pages deployment"
git push origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under "Source", select:
   - **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)** (will change after workflow runs)
4. Click **Save**

### Step 3: Workflow Runs Automatically

The GitHub Actions workflow (`.github/workflows/deploy.yml`):
- Triggers on every push to `main`
- Builds and deploys the `lycalopex` folder to GitHub Pages
- Your site will be live at: `https://username.github.io/anarquiaecologica/`

**After first deploy:** Update Step 2 to point to the `gh-pages` branch if needed, or the `/ (root)` option will work automatically.

## Customization

### Change Map Region

Edit `lycalopex/js/app.js`, function `CONFIG`:

```javascript
const CONFIG = {
    centerLat: -14.2350,      // Latitude
    centerLng: -51.9253,       // Longitude
    initialZoom: 4,            // Zoom level (higher = more zoomed in)
    ...
};
```

**Example coordinates:**
- **Brazil center**: lat: -14.2350, lng: -51.9253
- **São Paulo**: lat: -23.5505, lng: -46.6333
- **Buenos Aires**: lat: -34.6037, lng: -58.3816

### Connect Real Data

In `lycalopex/js/api.js`, replace the `sampleData` array with actual API calls:

```javascript
async function fetchData() {
    const response = await fetch('https://your-api-endpoint.com/data');
    return await response.json();
}
```

### Modify Scoring Algorithm

Edit `lycalopex/js/score.js` to adjust point values based on your analysis criteria.

### Change Design Colors

Edit `lycalopex/css/style.css`, the `:root` section:

```css
:root {
    --bg-color: #1a1a1a;        /* Background */
    --panel-bg: #2c2c2c;        /* Panel */
    --text-color: #f5f5f5;      /* Text */
    --accent: #b7410e;          /* Accent (rust red) */
}
```

## Technical Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Mapping**: Leaflet.js (CDN)
- **Data**: Fetch API (for remote data)
- **Hosting**: GitHub Pages (static)
- **No dependencies**: No Node.js, no build tools, no database

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (responsive design included)

## API Notes

### CNPJ (Brazil)
Useful free APIs:
- BrasilAPI (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`)
- Requires rate-limit awareness

### Geocoding
- OpenStreetMap Nominatim: Free geocoding service
- Remember to add proper attribution in UI

### Rate Limits
When using public APIs:
- Add delay between requests
- Implement caching
- Respect Terms of Service

## License

This project is open-source. Adapt and distribute freely.

## Questions?

This is a **static application**—all code runs in the browser. No backend, no database, no credentials needed.

### Troubleshooting

**Map doesn't load?**
- Check internet connection (Leaflet loads from CDN)
- Open browser DevTools → Console for errors

**Markers not showing?**
- Verify coordinates are valid
- Check that data is loading by inspecting the Network tab

**Export gives empty CSV?**
- Apply filters first to get results
- Check that markers are visible on map

---

**Lycalopex**: Territorial Observation  
Inspired by urban-critical spatial analysis and agro-industrial infrastructure mapping.
