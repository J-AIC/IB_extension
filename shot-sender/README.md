# Shot Sender - Standalone P2P Image Sender

This is a standalone web application that allows mobile devices to connect to the InsightBuddy Chrome extension and send images via P2P connection.

## Deployment Options

### Option 1: Deploy to Netlify (Recommended)

1. **Upload the `shot-sender` folder to Netlify:**
   - Go to https://netlify.com
   - Drag and drop the `shot-sender` folder
   - Get your deployed URL (e.g., `https://your-app.netlify.app`)

2. **Update the extension to use your URL:**
   - Edit `src/p2p/models/P2PModel.js`
   - Change the `senderUrl` to your deployed URL:
   ```javascript
   const senderUrl = `https://your-app.netlify.app/?peer=${peerId}`;
   ```

### Option 2: Deploy to GitHub Pages

1. **Create a new GitHub repository**
2. **Upload the contents of `shot-sender` folder**
3. **Enable GitHub Pages in repository settings**
4. **Update the extension with your GitHub Pages URL**

### Option 3: Use Any Web Server

1. **Upload `shot-sender` folder to any web hosting service**
2. **Update the extension with your domain URL**
3. **Ensure HTTPS is enabled for camera access**

## How It Works

1. **Desktop:** Click "Shot" button → QR code appears
2. **Mobile:** Scan QR code → opens sender page with peer ID
3. **Automatic connection** via WebRTC
4. **Take photo** and send to desktop
5. **Image appears** in desktop receiver

## Features

- 📱 Mobile-optimized interface
- 📸 Camera access with front/back switching
- 🔄 Real-time P2P connection
- 📤 Image capture and transmission
- ✨ Modern, intuitive UI
- 🌐 Works on any mobile browser

## Requirements

- HTTPS hosting (required for camera access)
- Modern mobile browser
- WebRTC support (available in all major browsers)

## Customization

You can customize the sender by:
- Changing colors and styling in the CSS
- Modifying the UI text and language
- Adding additional features like image filters
- Implementing QR code scanning (using a library like ZXing)

## Testing

To test locally:
1. Serve the folder using a local HTTPS server
2. Update the extension to use your local URL
3. Test the connection flow

For production, always use HTTPS hosting to enable camera access on mobile devices.