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
  const { slideData } = req.body;

  if (!slideData) {
    return res.status(400).json({ error: "slideData puuttuu" });
  }

  try {
    const filePath = await buildPPTX(slideData);
    res.download(filePath, "projektisuunnitelma.pptx", (err) => {
      if (err) console.error("Latausvirhe:", err);
      // Poistetaan väliaikainen tiedosto latauksen jälkeen
      fs.unlink(filePath, () => {});
    });
  } catch (err) {
    console.error("PPTX-virhe:", err.message);
    res.status(500).json({ error: "PPTX-generointi epäonnistui: " + err.message });
  }
});

// ── PPTX-rakentaja ────────────────────────────────────────────────
async function buildPPTX(data) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";

  const C = {
    deepBlue: "0C2340", digitalBlue: "1B6CA8", codeBlue: "5BA4CF",
    orange: "E8521A", mint: "3BBFAD", white: "FFFFFF",
    grey: "8C9BAA", silver: "D3D9DF", light: "EEF1F3",
    red: "C0392B", yellow: "E67E22", green: "27AE60",
  };
  const FONT = "Calibri";
  const mkS = () => ({ type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.10 });

  const cover    = data.cover    || {};
  const summary  = data.summary  || {};
  const deps     = data.dependencies || {};
  const gantt    = data.gantt    || {};
  const roles    = data.roles    || {};
  const risks    = data.risks    || {};
  const nextsteps = data.nextsteps || {};

  // ── SLIDE 1: Kansi ───────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.deepBlue };
    s.addShape(pres.shapes.OVAL, { x: 9.8, y: -1.2, w: 4.5, h: 4.5, fill: { color: C.digitalBlue, transparency: 70 }, line: { color: C.digitalBlue, transparency: 70 } });
    s.addShape(pres.shapes.OVAL, { x: 10.8, y: -0.3, w: 2.8, h: 2.8, fill: { color: C.mint, transparency: 78 }, line: { color: C.mint, transparency: 78 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.5, w: 0.08, h: 3.0, fill: { color: C.orange }, line: { color: C.orange } });
    s.addText(cover.title || "Projektisuunnitelma", { x: 0.9, y: 1.4, w: 8.5, h: 2.2, fontSize: 36, fontFace: FONT, bold: true, color: C.white, lineSpacingMultiple: 1.15, margin: 0 });
    s.addText(cover.tagline || "", { x: 0.9, y: 3.75, w: 9.0, h: 0.5, fontSize: 15, fontFace: FONT, color: C.orange, margin: 0 });
    s.addText(cover.meta || "", { x: 0.9, y: 4.35, w: 9.5, h: 0.32, fontSize: 12, fontFace: FONT, color: C.silver, margin: 0 });
    if (cover.projectLead) {
      s.addText("Projektin johtaja: " + cover.projectLead, { x: 0.9, y: 4.72, w: 9.5, h: 0.32, fontSize: 12, fontFace: FONT, color: C.silver, margin: 0 });
    }
    s.addText("GOFORE", { x: 0.6, y: 6.9, w: 3, h: 0.35, fontSize: 12, fontFace: FONT, bold: true, color: C.orange, charSpacing: 5, margin: 0 });
  }

  // ── SLIDE 2: Yhteenveto ──────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.3, h: 0.07, fill: { color: C.orange }, line: { color: C.orange } });
    s.addText("Projektin yhteenveto", { x: 0.5, y: 0.18, w: 9, h: 0.5, fontSize: 25, fontFace: FONT, bold: true, color: C.deepBlue, margin: 0 });

    const facts = summary.keyFacts || ["–", "–", "–", "–"];
    const factLabels = ["Kokonaiskesto", "Työpakettia", "Toimittajaa", "Tavoite"];
    facts.slice(0, 4).forEach((f, i) => {
      const x = 0.5 + i * 3.1;
      s.addShape(pres.shapes.RECTANGLE, { x, y: 1.1, w: 2.85, h: 1.15, fill: { color: C.light }, line: { color: C.silver }, shadow: mkS() });
      s.addShape(pres.shapes.RECTANGLE, { x, y: 1.1, w: 2.85, h: 0.06, fill: { color: C.mint }, line: { color: C.mint } });
      s.addText(String(f), { x, y: 1.18, w: 2.85, h: 0.62, fontSize: 22, fontFace: FONT, bold: true, color: C.deepBlue, align: "center", margin: 0 });
      s.addText(factLabels[i], { x, y: 1.8, w: 2.85, h: 0.32, fontSize: 11, fontFace: FONT, color: C.grey, align: "center", margin: 0 });
    });

    s.addText("Työvaiheet", { x: 0.5, y: 2.42, w: 4, h: 0.3, fontSize: 12, fontFace: FONT, bold: true, color: C.deepBlue, margin: 0 });
    const phases = summary.phases || [];
    const criticals = new Set(summary.criticalPhases || []);
    phases.forEach((p, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.5 + col * 4.2, y = 2.78 + row * 0.82;
      const isCrit = criticals.has(p) || criticals.has(String(i));
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.0, h: 0.68, fill: { color: isCrit ? C.orange : C.light }, line: { color: isCrit ? C.orange : C.silver }, shadow: mkS() });
      s.addText(p, { x: x + 0.1, y, w: 3.8, h: 0.68, fontSize: 11, fontFace: FONT, bold: isCrit, color: isCrit ? C.white : C.deepBlue, valign: "middle", margin: 5 });
    });
  }

  // ── SLIDE 3: Riippuvuudet ────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.3, h: 0.07, fill: { color: C.orange }, line: { color: C.orange } });
    s.addText("Kriittiset riippuvuudet & ehdot", { x: 0.5, y: 0.18, w: 11, h: 0.5, fontSize: 25, fontFace: FONT, bold: true, color: C.deepBlue, margin: 0 });

    const conditions = deps.conditions || [];
    conditions.forEach((c, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.4 + col * 4.2, y = 1.1 + row * 2.28;
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 3.95, h: 2.0, fill: { color: C.white }, line: { color: c.critical ? C.orange : C.silver }, shadow: mkS() });
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 3.95, h: 0.07, fill: { color: c.critical ? C.orange : C.digitalBlue }, line: { color: c.critical ? C.orange : C.digitalBlue } });
      s.addText(c.title || "", { x: x + 0.14, y: y + 0.12, w: 3.65, h: 0.44, fontSize: 13, fontFace: FONT, bold: true, color: c.critical ? C.orange : C.deepBlue, margin: 0 });
      s.addText(c.desc || "", { x: x + 0.14, y: y + 0.62, w: 3.65, h: 1.25, fontSize: 11, fontFace: FONT, color: C.grey, lineSpacingMultiple: 1.3, margin: 0 });
    });
  }

  // ── SLIDE 4: Gantt ───────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.3, h: 0.07, fill: { color: C.orange }, line: { color: C.orange } });
    s.addText("Gantt-aikataulu", { x: 0.4, y: 0.15, w: 7, h: 0.46, fontSize: 24, fontFace: FONT, bold: true, color: C.deepBlue, margin: 0 });

    const totalWeeks = gantt.totalWeeks || 9;
    const frozenWeek = gantt.frozenWeek || null;
    const phases = gantt.phases || [];
    const wcw = (13.3 - 0.4 - 3.55) / totalWeeks;
    const tl = 0.4, tt = 1.0, pcw = 3.55, rh = 0.5, hh = 0.38;

    s.addShape(pres.shapes.RECTANGLE, { x: tl, y: tt, w: pcw, h: hh, fill: { color: C.deepBlue }, line: { color: C.deepBlue } });
    s.addText("Vaihe", { x: tl + 0.1, y: tt, w: pcw, h: hh, fontSize: 11, fontFace: FONT, bold: true, color: C.white, valign: "middle", margin: 0 });

    for (let w = 0; w < totalWeeks; w++) {
      const x = tl + pcw + w * wcw;
      const frozen = frozenWeek && w + 1 === frozenWeek;
      s.addShape(pres.shapes.RECTANGLE, { x, y: tt, w: wcw, h: hh, fill: { color: frozen ? C.red : C.deepBlue }, line: { color: C.deepBlue } });
      s.addText(`Vk ${w + 1}${frozen ? "\n🔒" : ""}`, { x, y: tt, w: wcw, h: hh, fontSize: frozen ? 7 : 9, fontFace: FONT, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    }

    phases.forEach((ph, ri) => {
      const y = tt + hh + ri * rh;
      const rowBg = ri % 2 === 0 ? C.white : C.light;
      s.addShape(pres.shapes.RECTANGLE, { x: tl, y, w: pcw, h: rh, fill: { color: ph.critical ? "FFF2EC" : rowBg }, line: { color: C.silver } });
      s.addText((ph.critical ? "⬥ " : "") + (ph.name || ""), { x: tl + 0.1, y, w: pcw - 0.15, h: rh, fontSize: 10, fontFace: FONT, bold: ph.critical, color: ph.critical ? C.orange : C.deepBlue, valign: "middle", margin: 0 });

      for (let w = 0; w < totalWeeks; w++) {
        const x = tl + pcw + w * wcw;
        const active = w + 1 >= ph.start && w + 1 <= ph.end;
        const frozen = frozenWeek && w + 1 === frozenWeek;
        const fill = active
          ? (ph.critical ? C.orange : (w % 2 === 0 ? C.digitalBlue : C.mint))
          : (frozen ? "FFE0D6" : rowBg);
        s.addShape(pres.shapes.RECTANGLE, { x, y, w: wcw, h: rh, fill: { color: fill }, line: { color: C.silver } });
      }
    });
  }

  // ── SLIDE 5: Roolit ──────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.3, h: 0.07, fill: { color: C.orange }, line: { color: C.orange } });
    s.addText("Roolit & vastuut", { x: 0.5, y: 0.18, w: 9, h: 0.5, fontSize: 25, fontFace: FONT, bold: true, color: C.deepBlue, margin: 0 });

    const colorMap = { orange: C.orange, blue: C.digitalBlue, mint: C.mint, deep: C.deepBlue, grey: C.grey, red: C.red };
    const roleList = roles.roles || [];
    roleList.forEach((r, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.4 + col * 4.25, y = 1.15 + row * 2.62;
      const rc = colorMap[r.color] || C.digitalBlue;
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.0, h: 2.38, fill: { color: C.white }, line: { color: C.silver }, shadow: mkS() });
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.0, h: 0.07, fill: { color: rc }, line: { color: rc } });
      s.addText(r.title || "", { x: x + 0.14, y: y + 0.1, w: 3.72, h: 0.36, fontSize: 13, fontFace: FONT, bold: true, color: C.deepBlue, margin: 0 });
      s.addText(r.org || "", { x: x + 0.14, y: y + 0.46, w: 3.72, h: 0.26, fontSize: 10, fontFace: FONT, color: rc, margin: 0 });
      (r.responsibilities || []).forEach((rs, ri2) => {
        s.addText([
          { text: "·  ", options: { color: rc, bold: true } },
          { text: rs, options: { color: C.deepBlue } },
        ], { x: x + 0.14, y: y + 0.76 + ri2 * 0.36, w: 3.72, h: 0.33, fontSize: 10, fontFace: FONT, margin: 0 });
      });
    });
  }

  // ── SLIDE 6: Riskit ──────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.3, h: 0.07, fill: { color: C.orange }, line: { color: C.orange } });
    s.addText("Riskirekisteri", { x: 0.5, y: 0.18, w: 9, h: 0.5, fontSize: 25, fontFace: FONT, bold: true, color: C.deepBlue, margin: 0 });
    s.addText("Taso = todennäköisyys × vaikutus  ·  KORKEA ≥ 12  ·  KESKI 6–11  ·  MATALA ≤ 5", { x: 0.5, y: 0.72, w: 12, h: 0.26, fontSize: 11, fontFace: FONT, color: C.grey, margin: 0 });

    const riskList = risks.risks || [];
    const cols = [
      { label: "Riski", w: 3.2 }, { label: "Tod.", w: 0.58 }, { label: "Vaik.", w: 0.58 },
      { label: "Taso", w: 1.05 }, { label: "Omistaja", w: 2.2 }, { label: "Lieventäminen", w: 5.39 },
    ];
    const tl = 0.3, tt = 1.08, rh = 0.58, hh = 0.34;
    let xo = tl;
    cols.forEach(c => {
      s.addShape(pres.shapes.RECTANGLE, { x: xo, y: tt, w: c.w, h: hh, fill: { color: C.deepBlue }, line: { color: C.deepBlue } });
      s.addText(c.label, { x: xo + 0.05, y: tt, w: c.w, h: hh, fontSize: 10, fontFace: FONT, bold: true, color: C.white, valign: "middle", margin: 0 });
      xo += c.w;
    });
    riskList.forEach((r, ri) => {
      const y = tt + hh + ri * rh;
      const bg = ri % 2 === 0 ? C.white : C.light;
      const tc = r.level === "KORKEA" ? C.red : r.level === "KESKI" ? C.yellow : C.green;
      let xp = tl;
      const vals = [r.desc || "", String(r.prob || ""), String(r.impact || ""), r.level || "", r.owner || "", r.mitigation || ""];
      cols.forEach((c, ci) => {
        const isLevel = ci === 3;
        s.addShape(pres.shapes.RECTANGLE, { x: xp, y, w: c.w, h: rh, fill: { color: isLevel ? tc : bg }, line: { color: C.silver } });
        s.addText(vals[ci], { x: xp + 0.05, y, w: c.w - 0.07, h: rh, fontSize: ci === 0 || ci === 5 ? 9 : 10, fontFace: FONT, bold: isLevel, color: isLevel ? C.white : C.deepBlue, align: ci >= 1 && ci <= 3 ? "center" : "left", valign: "middle", margin: 0 });
        xp += c.w;
      });
    });
  }

  // ── SLIDE 7: Seuraavat askeleet ──────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.3, h: 0.07, fill: { color: C.orange }, line: { color: C.orange } });
    s.addText("Seuraavat askeleet", { x: 0.5, y: 0.18, w: 9, h: 0.5, fontSize: 25, fontFace: FONT, bold: true, color: C.deepBlue, margin: 0 });

    const stepList = nextsteps.steps || [];
    stepList.forEach((st, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.4 + col * 6.35, y = 1.12 + row * 1.82;
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 6.1, h: 1.62, fill: { color: C.white }, line: { color: st.critical ? C.orange : C.silver }, shadow: mkS() });
      s.addShape(pres.shapes.OVAL, { x: x + 0.12, y: y + 0.12, w: 0.5, h: 0.5, fill: { color: st.critical ? C.orange : C.digitalBlue }, line: { color: st.critical ? C.orange : C.digitalBlue } });
      s.addText(String(i + 1).padStart(2, "0"), { x: x + 0.12, y: y + 0.12, w: 0.5, h: 0.5, fontSize: 11, fontFace: FONT, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      s.addText(st.action || "", { x: x + 0.76, y: y + 0.1, w: 5.1, h: 0.36, fontSize: 13, fontFace: FONT, bold: true, color: st.critical ? C.orange : C.deepBlue, margin: 0 });
      s.addText(st.detail || "", { x: x + 0.76, y: y + 0.48, w: 5.1, h: 0.5, fontSize: 10, fontFace: FONT, color: C.grey, lineSpacingMultiple: 1.2, margin: 0 });
      s.addText(`👤 ${st.owner || ""}  ·  ⏱ ${st.timing || ""}`, { x: x + 0.76, y: y + 1.08, w: 5.1, h: 0.32, fontSize: 10, fontFace: FONT, color: C.digitalBlue, margin: 0 });
    });
  }

  // ── SLIDE 8: Loppudia ────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.deepBlue };
    s.addShape(pres.shapes.OVAL, { x: 9.5, y: -1.5, w: 5.5, h: 5.5, fill: { color: C.digitalBlue, transparency: 75 }, line: { color: C.digitalBlue, transparency: 75 } });
    s.addShape(pres.shapes.OVAL, { x: 10.6, y: -0.2, w: 3.0, h: 3.0, fill: { color: C.mint, transparency: 80 }, line: { color: C.mint, transparency: 80 } });
    s.addText("Pioneering\nan ethical\ndigital world.", { x: 0.8, y: 1.8, w: 8, h: 2.8, fontSize: 34, fontFace: FONT, bold: true, color: C.white, lineSpacingMultiple: 1.2, margin: 0 });
    s.addText("GOFORE", { x: 0.8, y: 6.85, w: 3, h: 0.35, fontSize: 12, fontFace: FONT, bold: true, color: C.orange, charSpacing: 5, margin: 0 });
  }

  // ── Kirjoita tiedosto ────────────────────────────────────────────
  const outPath = path.join(__dirname, `pptx_${Date.now()}.pptx`);
  await pres.writeFile({ fileName: outPath });
  return outPath;
}

// ── Käynnistä palvelin ────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Gofore agentti käynnissä portissa ${PORT}`);
  console.log(`   Testaa: http://localhost:${PORT}/health`);
});