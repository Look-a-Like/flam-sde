# Real-Time Collaborative Drawing Canvas

Multi-user drawing application with real-time synchronization using WebSockets.

## Demo

**Live Demo**: https://flam-sde.onrender.com/

⚠️ **Note**: Initial load may take 30-60 seconds as the app is hosted on Render's free tier (server spins down after inactivity).

## Setup
```bash
npm install && npm start
```

Then open `http://localhost:3000` in your browser.

## Testing with Multiple Users

Open the application in multiple browser tabs/windows. Each instance represents a different user with a unique color. All users share the same canvas in real-time.

For testing across devices on the same network, use your local IP:
```
http://YOUR_IP_ADDRESS:3000
```

## Tech Stack

- **Frontend**: TypeScript, HTML5 Canvas API, Socket.io Client
- **Backend**: Node.js, Express, Socket.io

## Known Limitations

- No canvas persistence (state lost on server restart)
- Single room only (all users share one canvas)
- No user authentication

## Time Spent

**Total: ~14 hours**
- Setup & configuration: 1hr
- Server implementation: 3hr
- Client implementation: 5hr
- UI/UX: 2hr
- Testing & debugging: 2hr
- Documentation: 1hr