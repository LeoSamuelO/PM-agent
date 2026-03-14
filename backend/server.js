require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");
// pdf-parse removed — using Claude API natively instead

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Terveystarkistus ──────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Gofore agentti toimii!" });
});

// ── File extract endpoint — uses Claude API to read any file ────────
app.post("/api/extract-file", async (req, res) => {
  const { base64, mimeType, fileName } = req.body;
  if (!base64 || !mimeType) return res.status(400).json({ error: "base64/mimeType puuttuu" });
  try {
    // Claude can natively read PDFs and images
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    if (!isImage && !isPdf) {
      return res.status(400).json({ error: "Tuetut tiedostotyypit: PDF ja kuvat" });
    }

    const contentBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } };

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          contentBlock,
          { type: "text", text: "Lue tämä tiedosto (" + fileName + ") tarkasti. Tiivistä kaikki projektisuunnittelun kannalta oleellinen tieto selkeästi suomeksi. Mainitse kaikki: tavoitteet, aikataulu, osapuolet, resurssit, rajoitteet, riskit, riippuvuudet, työpaketit. Älä keksi mitään — kirjoita vain mitä tiedostossa oikeasti lukee." }
        ]
      }]
    });

    const text = response.content.find(b => b.type === "text")?.text || "";
    res.json({ text });
  } catch (err) {
    console.error("Tiedostovirhe:", err.message);
    res.status(500).json({ error: "Tiedoston luku epäonnistui: " + err.message });
  }
});


// ── Chat-endpoint ─────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages, system } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages puuttuu" });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: system || "Olet kokenut projektikonsultti. Kommunikoi aina suomeksi. Ole ytimekäs ja käytännönläheinen.",
      messages,
    });

    const text = response.content.find((b) => b.type === "text")?.text || "";
    res.json({ text });
  } catch (err) {
    console.error("Claude API virhe:", err.message);
    res.status(500).json({ error: "API-kutsu epäonnistui: " + err.message });
  }
});

// ── PPTX-endpoint ─────────────────────────────────────────────────
app.post("/api/build-pptx", async (req, res) => {
  const { slideData, slideStructure } = req.body;
  if (!slideData) return res.status(400).json({ error: "slideData puuttuu" });
  try {
    const filePath = await buildPPTX(slideData, slideStructure || []);
    res.download(filePath, "projektisuunnitelma.pptx", (err) => {
      if (err) console.error("Latausvirhe:", err);
      fs.unlink(filePath, () => {});
    });
  } catch (err) {
    console.error("PPTX-virhe:", err.message, err.stack);
    res.status(500).json({ error: "PPTX-generointi epäonnistui: " + err.message });
  }
});

// ── PPTX-rakentaja ────────────────────────────────────────────────
async function buildPPTX(data, slideStructure) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";

  const C = {
    deepBlue: "0C2340", digitalBlue: "1B6CA8", codeBlue: "5BA4CF",
    orange: "E8521A", mint: "3BBFAD", white: "FFFFFF",
    grey: "8C9BAA", silver: "D3D9DF", light: "EEF1F3",
    red: "C0392B", yellow: "E67E22", green: "27AE60",
  };
  const F = "Calibri";
  const mkS = () => ({ type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.10 });
  const hdr = (s, title) => {
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.3, h: 0.07, fill: { color: C.orange }, line: { color: C.orange } });
    s.addText(title, { x: 0.5, y: 0.15, w: 11, h: 0.5, fontSize: 24, fontFace: F, bold: true, color: C.deepBlue, margin: 0 });
  };

  // Build each slide based on structure
  for (const slideDef of slideStructure) {
    const d = data[slideDef.id] || {};
    switch (slideDef.layout) {
      case "title":    buildTitleSlide(pres, d, C, F); break;
      case "gantt":    buildGanttSlide(pres, d, slideDef, C, F, hdr); break;
      case "table":    buildTableSlide(pres, d, slideDef, C, F, hdr); break;
      case "cards":    buildCardsSlide(pres, d, slideDef, C, F, hdr, mkS); break;
      case "two-col":  buildTwoColSlide(pres, d, slideDef, C, F, hdr, mkS); break;
      case "bullets":
      default:         buildBulletsSlide(pres, d, slideDef, C, F, hdr); break;
    }
  }

  // End slide
  { const s = pres.addSlide();
    s.background = { color: C.deepBlue };
    s.addShape(pres.shapes.OVAL, { x: 9.5, y: -1.5, w: 5.5, h: 5.5, fill: { color: C.digitalBlue, transparency: 75 }, line: { color: C.digitalBlue, transparency: 75 } });
    s.addShape(pres.shapes.OVAL, { x: 10.6, y: -0.2, w: 3.0, h: 3.0, fill: { color: C.mint, transparency: 80 }, line: { color: C.mint, transparency: 80 } });
    s.addText("Pioneering\nan ethical\ndigital world.", { x: 0.8, y: 1.8, w: 8, h: 2.8, fontSize: 34, fontFace: F, bold: true, color: C.white, lineSpacingMultiple: 1.2, margin: 0 });
    s.addText("GOFORE", { x: 0.8, y: 6.85, w: 3, h: 0.35, fontSize: 12, fontFace: F, bold: true, color: C.orange, charSpacing: 5, margin: 0 });
  }

  const outPath = path.join(__dirname, "pptx_" + Date.now() + ".pptx");
  await pres.writeFile({ fileName: outPath });
  return outPath;
}

function buildTitleSlide(pres, d, C, F) {
  const s = pres.addSlide();
  s.background = { color: C.deepBlue };
  s.addShape(pres.shapes.OVAL, { x: 9.8, y: -1.2, w: 4.5, h: 4.5, fill: { color: C.digitalBlue, transparency: 70 }, line: { color: C.digitalBlue, transparency: 70 } });
  s.addShape(pres.shapes.OVAL, { x: 10.8, y: -0.3, w: 2.8, h: 2.8, fill: { color: C.mint, transparency: 78 }, line: { color: C.mint, transparency: 78 } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.5, w: 0.08, h: 3.0, fill: { color: C.orange }, line: { color: C.orange } });
  s.addText(d.title || "Projektisuunnitelma", { x: 0.9, y: 1.4, w: 8.5, h: 2.2, fontSize: 36, fontFace: F, bold: true, color: C.white, lineSpacingMultiple: 1.15, margin: 0 });
  s.addText(d.tagline || "", { x: 0.9, y: 3.75, w: 9.0, h: 0.5, fontSize: 15, fontFace: F, color: C.orange, margin: 0 });
  s.addText(d.meta || "", { x: 0.9, y: 4.35, w: 9.5, h: 0.32, fontSize: 12, fontFace: F, color: C.silver, margin: 0 });
  if (d.projectLead) s.addText("Projektin johtaja: " + d.projectLead, { x: 0.9, y: 4.72, w: 9.5, h: 0.32, fontSize: 12, fontFace: F, color: C.silver, margin: 0 });
  s.addText("GOFORE", { x: 0.6, y: 6.9, w: 3, h: 0.35, fontSize: 12, fontFace: F, bold: true, color: C.orange, charSpacing: 5, margin: 0 });
}

function buildBulletsSlide(pres, d, def, C, F, hdr) {
  const s = pres.addSlide();
  s.background = { color: C.white };
  hdr(s, d.heading || def.label || "");
  const bullets = d.bullets || [];
  bullets.forEach((b, i) => {
    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 0.88 + i * 0.7, w: 0.06, h: 0.42, fill: { color: C.orange }, line: { color: C.orange } });
    s.addText(b, { x: 0.75, y: 0.88 + i * 0.7, w: 12.0, h: 0.56, fontSize: 13, fontFace: F, color: C.deepBlue, valign: "middle", margin: 0 });
  });
  if (d.note) s.addText(d.note, { x: 0.5, y: 6.6, w: 12.3, h: 0.35, fontSize: 11, fontFace: F, color: C.grey, italic: true, margin: 0 });
}

function buildTableSlide(pres, d, def, C, F, hdr) {
  const s = pres.addSlide();
  s.background = { color: C.white };
  hdr(s, d.heading || def.label || "");
  const cols = d.columns || [];
  const rows = d.rows || [];
  if (!cols.length) return;
  const tw = 12.3, tl = 0.5, tt = 0.82, rh = 0.48, hh = 0.38;
  const cw = tw / cols.length;
  cols.forEach((c, ci) => {
    s.addShape(pres.shapes.RECTANGLE, { x: tl + ci * cw, y: tt, w: cw, h: hh, fill: { color: C.deepBlue }, line: { color: C.deepBlue } });
    s.addText(c, { x: tl + ci * cw + 0.06, y: tt, w: cw - 0.1, h: hh, fontSize: 11, fontFace: F, bold: true, color: C.white, valign: "middle", margin: 0 });
  });
  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? C.white : C.light;
    const y = tt + hh + ri * rh;
    row.forEach((cell, ci) => {
      s.addShape(pres.shapes.RECTANGLE, { x: tl + ci * cw, y, w: cw, h: rh, fill: { color: bg }, line: { color: C.silver } });
      s.addText(String(cell || ""), { x: tl + ci * cw + 0.06, y, w: cw - 0.1, h: rh, fontSize: 11, fontFace: F, color: C.deepBlue, valign: "middle", margin: 0 });
    });
  });
}

function buildGanttSlide(pres, d, def, C, F, hdr) {
  const s = pres.addSlide();
  s.background = { color: C.white };
  hdr(s, d.heading || def.label || "Aikataulu");
  const totalWeeks = d.totalWeeks || 8;
  const frozenWeek = d.frozenWeek || null;
  const phases = d.phases || [];
  const wcw = (12.3 - 3.2) / totalWeeks;
  const tl = 0.4, tt = 0.82, pcw = 3.2, rh = 0.48, hh = 0.36;
  s.addShape(pres.shapes.RECTANGLE, { x: tl, y: tt, w: pcw, h: hh, fill: { color: C.deepBlue }, line: { color: C.deepBlue } });
  s.addText("Vaihe", { x: tl + 0.1, y: tt, w: pcw, h: hh, fontSize: 11, fontFace: F, bold: true, color: C.white, valign: "middle", margin: 0 });
  for (let w = 0; w < totalWeeks; w++) {
    const x = tl + pcw + w * wcw;
    const frozen = frozenWeek && w + 1 === frozenWeek;
    s.addShape(pres.shapes.RECTANGLE, { x, y: tt, w: wcw, h: hh, fill: { color: frozen ? C.red : C.deepBlue }, line: { color: C.deepBlue } });
    s.addText("Vk" + (w+1) + (frozen ? "\n🔒" : ""), { x, y: tt, w: wcw, h: hh, fontSize: frozen ? 7 : 8, fontFace: F, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
  }
  phases.forEach((ph, ri) => {
    const y = tt + hh + ri * rh;
    const rowBg = ri % 2 === 0 ? C.white : C.light;
    s.addShape(pres.shapes.RECTANGLE, { x: tl, y, w: pcw, h: rh, fill: { color: ph.critical ? "FFF2EC" : rowBg }, line: { color: C.silver } });
    s.addText((ph.critical ? "⬥ " : "") + (ph.name || ""), { x: tl + 0.1, y, w: pcw - 0.15, h: rh, fontSize: 10, fontFace: F, bold: ph.critical, color: ph.critical ? C.orange : C.deepBlue, valign: "middle", margin: 0 });
    for (let w = 0; w < totalWeeks; w++) {
      const x = tl + pcw + w * wcw;
      const active = w + 1 >= ph.start && w + 1 <= ph.end;
      const frozen = frozenWeek && w + 1 === frozenWeek;
      const fill = active ? (ph.critical ? C.orange : (w % 2 === 0 ? C.digitalBlue : C.mint)) : (frozen ? "FFE0D6" : rowBg);
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: wcw, h: rh, fill: { color: fill }, line: { color: C.silver } });
    }
  });
}

function buildCardsSlide(pres, d, def, C, F, hdr, mkS) {
  const s = pres.addSlide();
  s.background = { color: C.white };
  hdr(s, d.heading || def.label || "");
  const cards = d.cards || [];
  const levelColor = { high: C.red, medium: C.yellow, low: C.green, korkea: C.red, keski: C.yellow, matala: C.green };
  const cols = Math.min(cards.length, 3);
  const cw = 12.3 / cols;
  cards.forEach((card, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = 0.5 + col * cw, y = 1.0 + row * 2.7;
    const cc = levelColor[String(card.level || "").toLowerCase()] || C.digitalBlue;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw - 0.2, h: 2.4, fill: { color: C.white }, line: { color: C.silver }, shadow: mkS() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw - 0.2, h: 0.06, fill: { color: cc }, line: { color: cc } });
    s.addText(card.icon || "📌", { x: x + 0.1, y: y + 0.1, w: 0.5, h: 0.5, fontSize: 22, margin: 0 });
    s.addText(card.title || "", { x: x + 0.65, y: y + 0.1, w: cw - 1.0, h: 0.44, fontSize: 13, fontFace: F, bold: true, color: C.deepBlue, margin: 0 });
    s.addText(card.desc || "", { x: x + 0.1, y: y + 0.62, w: cw - 0.4, h: 1.6, fontSize: 11, fontFace: F, color: C.grey, lineSpacingMultiple: 1.3, margin: 0 });
  });
}

function buildTwoColSlide(pres, d, def, C, F, hdr, mkS) {
  const s = pres.addSlide();
  s.background = { color: C.white };
  hdr(s, d.heading || def.label || "");
  const left = d.left || {};
  const right = d.right || {};
  [left, right].forEach((col, ci) => {
    const x = ci === 0 ? 0.5 : 6.9;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 0.82, w: 6.0, h: 0.38, fill: { color: ci === 0 ? C.deepBlue : C.digitalBlue }, line: { color: C.deepBlue } });
    s.addText(col.title || "", { x: x + 0.1, y: 0.82, w: 5.8, h: 0.38, fontSize: 12, fontFace: F, bold: true, color: C.white, valign: "middle", margin: 0 });
    (col.items || []).forEach((item, ii) => {
      s.addShape(pres.shapes.OVAL, { x: x + 0.12, y: 1.34 + ii * 0.62, w: 0.2, h: 0.2, fill: { color: ci === 0 ? C.orange : C.mint }, line: { color: ci === 0 ? C.orange : C.mint } });
      s.addText(item, { x: x + 0.42, y: 1.28 + ii * 0.62, w: 5.4, h: 0.52, fontSize: 12, fontFace: F, color: C.deepBlue, valign: "middle", margin: 0 });
    });
  });
}

// ── Käynnistä palvelin ────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Gofore agentti käynnissä portissa ${PORT}`);
  console.log(`   Testaa: http://localhost:${PORT}/health`);
});