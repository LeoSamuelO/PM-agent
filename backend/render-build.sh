#!/bin/bash
# Render build script — asentaa sekä Node.js että Python-riippuvuudet
set -e

echo "📦 Asennetaan Node.js -riippuvuudet..."
npm install

echo "🐍 Asennetaan Python-riippuvuudet..."
pip install python-pptx lxml

echo "✅ Build valmis!"
