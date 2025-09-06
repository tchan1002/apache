# Sherpa Chrome Extension

A Chrome extension that answers questions about any website by leveraging the Pathfinder API's Q&A capabilities.

## Features

- **Ask questions**: Type any question about the current website
- **Get instant answers**: Receive AI-powered answers based on site content
- **Source attribution**: See which page the answer came from
- **One-click navigation**: Go directly to the source page
- **User feedback**: Help improve answer quality
- **Minimal permissions**: Only requires access to current tab and Pathfinder API

## How it works

1. **Click the extension** on any webpage
2. **Ask a question** like "forgot clinic phone number" or "how to contact support"
3. **Get an answer** with source attribution
4. **Navigate to source** if you want to see more details
5. **Provide feedback** to help improve future answers

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
- **Production**: `https://pathfinder-bay-mu.vercel.app/api`
- **Staging**: `https://<staging-domain>/api` (for development)

### API Endpoints Used

- `POST /query` - Ask questions about the current site
  - Sends: `{ question: string, siteId: string }`
  - Returns: `{ answer: string, sources: Array<{url, title, snippet}> }`

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
