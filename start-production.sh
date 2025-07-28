#!/bin/bash

# Production start script to bypass Vite host blocking
echo "🚀 Starting Strength Manager in production mode..."

# Kill any existing processes
pkill -f "node dist/index.js" || true
pkill -f "tsx server/index.ts" || true

# Build the application
echo "📦 Building application..."
npm run build

# Start production server
echo "🌐 Starting production server..."
NODE_ENV=production node dist/index.js

echo "✅ Server started successfully!"
echo "Access your app at: https://85942558-6680-4e56-bf29-60e270826306.replit.app"