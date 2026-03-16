require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Auth middleware ───────────────────────────────────────────────
const PASSWORD = process.env.APP_PASSWORD || "AgenttiTestaus123";
app.use((req, res, next) => {
  if (req.path === "/health") return next(); // health check ei vaadi salasanaa
  const auth = req.headers["x-app-password"];
  if (auth !== PASSWORD) return res.status(401).json({ error: "Väärä salasana" });
  next();
});

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
  const { messages, system, useSearch } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages puuttuu" });
  }

  try {
    const params = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: system || "Olet kokenut projektikonsultti. Kommunikoi aina suomeksi. Ole ytimekäs ja käytännönläheinen.",
      messages,
    };

    // Lisää web search jos pyydetty tai viesti vaikuttaa hakevan tietoa netistä
    if (useSearch) {
      params.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }

    const response = await client.messages.create(params);

    // Kerää kaikki tekstiblokit yhteen (web search voi tuottaa useita)
    const text = response.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

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

  const payload = JSON.stringify({ slideData, slideStructure: slideStructure || [] });
  const outPath = path.join(__dirname, "pptx_" + Date.now() + ".pptx");
  const scriptPath = path.join(__dirname, "build_pptx.py");

  try {
    await new Promise((resolve, reject) => {
      execFile("python3", [scriptPath, payload, outPath], { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        if (!stdout.startsWith("OK:")) return reject(new Error("Build epäonnistui: " + stdout));
        resolve();
      });
    });

    res.download(outPath, "projektisuunnitelma.pptx", (err) => {
      if (err) console.error("Latausvirhe:", err);
      fs.unlink(outPath, () => {});
    });
  } catch (err) {
    console.error("PPTX-virhe:", err.message);
    res.status(500).json({ error: "PPTX-generointi epäonnistui: " + err.message });
  }
});

// ── Warmup-endpoint (estää cold start -ongelman) ──────────────────
app.get("/api/warmup", (req, res) => {
  res.json({ status: "warm", time: new Date().toISOString() });
});
// ── Käynnistä palvelin ────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Gofore agentti käynnissä portissa ${PORT}`);
  console.log(`   Testaa: http://localhost:${PORT}/health`);
});