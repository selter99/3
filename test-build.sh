#!/bin/bash
set -e

echo "🔹 Local build..."
rm -rf node_modules dist
npm install
npm run build

echo "🔹 Simulate Stackblitz..."
rm -rf node_modules dist
npm install --no-save
npm run build

echo "🔹 Simulate Cloudflare Pages..."
rm -rf node_modules dist
npm ci
npm run build

echo "✅ All builds passed!"
