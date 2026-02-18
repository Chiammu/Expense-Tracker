# Public Assets

## Required PWA Icons

The app requires the following icon files for Progressive Web App functionality:

- `icon-192.png` - 192x192px app icon
- `icon-512.png` - 512x512px app icon

### Generating Icons

You can generate these from a source image using:

1. **Online Tool**: https://realfavicongenerator.net/
2. **CLI Tool**: 
   ```bash
   npm install -g pwa-asset-generator
   pwa-asset-generator source-icon.png ./public
   ```

### Design Guidelines

- Use a simple, recognizable icon
- Ensure good contrast for visibility
- Test on both light and dark backgrounds
- Recommended: Expense/money-related imagery (wallet, coins, receipt)

### Fallback

Currently, the app references these icons but they're not included in the repository.
If icons are missing, browsers will use default PWA placeholders.

For production deployment, please add proper icons before going live.
