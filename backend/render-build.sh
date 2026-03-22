#!/bin/bash
# Render build script — asentaa sekä Node.js että Python-riippuvuudet
set -e

echo "📦 Asennetaan Node.js -riippuvuudet..."
npm install

echo "🐍 Asennetaan Python-riippuvuudet..."
pip install python-pptx python-docx lxml || pip3 install python-pptx python-docx lxml || echo "⚠️ Python install failed, using JS fallback"

echo "📁 Tarkistetaan tiedostot..."
ls -la build_pptx.py build_docx.py Gofore_Template.pptx 2>/dev/null || echo "⚠️ Joitain tiedostoja puuttuu"
python3 --version 2>/dev/null || python --version 2>/dev/null || echo "⚠️ Python not found"
python3 -c "import pptx; print('✅ python-pptx OK')" 2>/dev/null || echo "⚠️ python-pptx not importable"
python3 -c "import docx; print('✅ python-docx OK')" 2>/dev/null || echo "⚠️ python-docx not importable"

echo "✅ Build valmis!"
