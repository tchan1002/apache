# Sherpa Chrome Extension

A Chrome extension that helps you find the best page on any website by leveraging the Pathfinder API.

## Features

- **One-click navigation**: Click the extension to be taken to the best page on the current site
- **Smart caching**: Uses 15-minute TTL caching for fast responses
- **Alternative suggestions**: Shows the next best page as an alternative
- **User feedback**: Collects feedback to improve recommendations
- **Minimal permissions**: Only requires access to current tab and Pathfinder API

## How it works

1. **Click the extension** on any webpage
2. **Sherpa analyzes** the current site using the Pathfinder API
3. **Navigate automatically** to the best page found
4. **See alternatives** and provide feedback to improve results

## Installation

### Development Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select this `sherpa` directory
5. The extension will appear in your toolbar

### Production Installation

*Coming soon - will be available on the Chrome Web Store*

## API Integration

The extension integrates with the Pathfinder API at:
- **Production**: `https://pathfinder-bay-mu.vercel.app/api/sherpa/v1`
- **Staging**: `https://<staging-domain>/api/sherpa/v1` (for development)

## Permissions

- `activeTab`: Access current tab URL
- `scripting`: Inject content scripts
- `storage`: Store local state
- `https://pathfinder-bay-mu.vercel.app/*`: Access Pathfinder API

## Privacy

- Only sends the current tab's URL to Pathfinder
- No personal data is collected or stored
- Respects robots.txt and site policies
- Data is not sold or shared

## Development

### File Structure

```
sherpa/
├── manifest.json          # Extension manifest
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic and API calls
├── content.js            # Content script (minimal)
├── content.css           # Content styles
├── background.js         # Background service worker
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### API Endpoints Used

- `POST /analyze` - Start analysis or get cached results
- `GET /jobs/{id}/status` - Poll job status
- `GET /results/head` - Get top results
- `POST /results/advance` - Get next alternative
- `POST /feedback` - Submit user feedback

## Version History

### v1.0.0
- Initial release
- Basic navigation to best page
- Alternative suggestions
- User feedback collection
- 15-minute caching

## Support

For issues or questions, please contact the development team.

---

**Sherpa** - Your guide to the best pages on any website.
