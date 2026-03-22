require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { users, projects, presentations, profiles } = require("./db");

const app = express();

// ═══ CORS: salli vain oma frontend ═══
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "https://pmagents.app,https://www.pmagents.app,http://localhost:5173").split(",");
app.use(cors({
  origin: function(origin, callback) {
    // Salli pyyntö ilman originia (esim. curl, Render health check)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error("CORS: origin not allowed: " + origin));
  }
}));
app.use(express.json({ limit: "10mb" }));

// ═══ RATE LIMITING ═══
// Chat API: 15 pyyntöä/min per IP (Anthropic-kutsut ovat kalliita)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: "Liian monta pyyntöä — odota hetki." },
  standardHeaders: true,
  legacyHeaders: false,
});
// Auth: 10 yritystä/min (estää brute force)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Liian monta kirjautumisyritystä." },
  standardHeaders: true,
  legacyHeaders: false,
});

if (!process.env.APP_PASSWORD) {
  console.warn("⚠️  APP_PASSWORD ei ole asetettu! Käytetään oletusta vain kehityksessä.");
}
const ACCESS_KEY = process.env.APP_PASSWORD || "AgenttiTestaus123";
const JWT_SECRET = process.env.JWT_SECRET || require("crypto").randomBytes(64).toString("hex");

// ═══ AUTH MIDDLEWARE ═══
const PUBLIC_PATHS = ["/health", "/api/auth/register", "/api/auth/login"];

function authMiddleware(req, res, next) {
  if (PUBLIC_PATHS.includes(req.path)) return next();
  const token = req.headers["x-session-token"];
  if (!token) return res.status(401).json({ error: "Token puuttuu" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Istunto vanhentunut" });
  }
}
app.use(authMiddleware);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══ REKISTERÖINTI (vaatii avaimen) ═══
app.post("/api/auth/register", authLimiter, (req, res) => {
  const { username, password, accessKey } = req.body;
  if (!username || !password || !accessKey) return res.status(400).json({ error: "Täytä kaikki kentät" });
  if (accessKey !== ACCESS_KEY) return res.status(401).json({ error: "Väärä avain" });
  if (password.length < 6) return res.status(400).json({ error: "Salasanan on oltava vähintään 6 merkkiä" });
  if (username.trim().length < 2) return res.status(400).json({ error: "Käyttäjänimi liian lyhyt" });
  const existing = users.getByUsername.get(username.trim());
  if (existing) return res.status(409).json({ error: "Käyttäjänimi on jo käytössä" });
  try {
    const hash = bcrypt.hashSync(password, 12);
    const result = users.create.run(username.trim(), hash);
    const userId = result.lastInsertRowid;
    users.updateLastLogin.run(userId);
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, user: { id: userId, username: username.trim(), is_admin: 0 } });
  } catch (err) {
    res.status(500).json({ error: "Rekisteröinti epäonnistui" });
  }
});

// ═══ KIRJAUTUMINEN (ei vaadi avainta) ═══
app.post("/api/auth/login", authLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Täytä kaikki kentät" });
  const user = users.getByUsername.get(username.trim());
  if (!user) return res.status(401).json({ error: "Väärä käyttäjänimi tai salasana" });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: "Väärä käyttäjänimi tai salasana" });
  users.updateLastLogin.run(user.id);
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, user: { id: user.id, username: user.username, is_admin: user.is_admin } });
});

// ═══ KÄYTTÄJÄTIEDOT ═══
app.get("/api/auth/me", (req, res) => {
  const user = users.getById.get(req.userId);
  if (!user) return res.status(404).json({ error: "Käyttäjää ei löydy" });
  res.json({ user });
});

// ═══ SALASANAN VAIHTO ═══
app.put("/api/auth/password", (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Täytä kaikki kentät" });
  if (newPassword.length < 6) return res.status(400).json({ error: "Salasanan on oltava vähintään 6 merkkiä" });
  const user = users.getByUsername.get(users.getById.get(req.userId)?.username);
  if (!user) return res.status(404).json({ error: "Käyttäjää ei löydy" });
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) return res.status(401).json({ error: "Väärä nykyinen salasana" });
  const hash = bcrypt.hashSync(newPassword, 12);
  users.resetPassword.run(hash, req.userId);
  res.json({ message: "Salasana vaihdettu!" });
});

// ═══ TILIN POISTO (itse) ═══
app.delete("/api/auth/me", (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Salasana vaaditaan" });
  const user = users.getByUsername.get(users.getById.get(req.userId)?.username);
  if (!user) return res.status(404).json({ error: "Käyttäjää ei löydy" });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: "Väärä salasana" });
  users.delete.run(req.userId);
  res.json({ message: "Tili poistettu" });
});

// ═══ PROJEKTIT (nimi + jaettu konteksti) ═══
app.get("/api/projects", (req, res) => {
  const list = projects.getByUser.all(req.userId);
  res.json({ projects: list });
});

app.post("/api/projects", (req, res) => {
  const { name, description, contextJson } = req.body;
  if (!name) return res.status(400).json({ error: "Nimi puuttuu" });
  try {
    const result = projects.create.run(req.userId, name.trim(), description || "", JSON.stringify(contextJson || {}));
    res.json({ id: result.lastInsertRowid, message: "Projekti luotu" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/projects/:id", (req, res) => {
  const project = projects.getById.get(req.params.id, req.userId);
  if (!project) return res.status(404).json({ error: "Projektia ei löydy" });
  project.context_json = JSON.parse(project.context_json || "{}");
  // Hae myös esitykset
  const preslist = presentations.getByProject.all(req.params.id, req.userId);
  res.json({ project, presentations: preslist });
});

app.put("/api/projects/:id", (req, res) => {
  const { name, description, contextJson } = req.body;
  const existing = projects.getById.get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: "Projektia ei löydy" });
  projects.update.run(
    name || existing.name, description ?? existing.description,
    JSON.stringify(contextJson || JSON.parse(existing.context_json || "{}")),
    req.params.id, req.userId
  );
  res.json({ message: "Projekti päivitetty" });
});

app.delete("/api/projects/:id", (req, res) => {
  projects.delete.run(req.params.id, req.userId);
  res.json({ message: "Projekti poistettu" });
});

// ═══ ESITYKSET (projektin alla) ═══
app.get("/api/projects/:pid/presentations", (req, res) => {
  const list = presentations.getByProject.all(req.params.pid, req.userId);
  res.json({ presentations: list });
});

app.post("/api/projects/:pid/presentations", (req, res) => {
  const { name, focusType, stateJson } = req.body;
  if (!name) return res.status(400).json({ error: "Nimi puuttuu" });
  // Varmista että projekti on käyttäjän
  const proj = projects.getById.get(req.params.pid, req.userId);
  if (!proj) return res.status(404).json({ error: "Projektia ei löydy" });
  try {
    const result = presentations.create.run(parseInt(req.params.pid), req.userId, name.trim(), focusType || "", JSON.stringify(stateJson || {}));
    res.json({ id: result.lastInsertRowid, message: "Esitys luotu" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/presentations/:id", (req, res) => {
  const pres = presentations.getById.get(req.params.id, req.userId);
  if (!pres) return res.status(404).json({ error: "Esitystä ei löydy" });
  pres.state_json = JSON.parse(pres.state_json || "{}");
  // Hae myös projektin jaettu konteksti
  const proj = projects.getById.get(pres.project_id, req.userId);
  const context = proj ? JSON.parse(proj.context_json || "{}") : {};
  res.json({ presentation: pres, projectContext: context, projectName: proj?.name || "" });
});

app.put("/api/presentations/:id", (req, res) => {
  const { name, focusType, stateJson } = req.body;
  const existing = presentations.getById.get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: "Esitystä ei löydy" });
  presentations.update.run(
    name || existing.name, focusType ?? existing.focus_type,
    JSON.stringify(stateJson || JSON.parse(existing.state_json || "{}")),
    req.params.id, req.userId
  );
  res.json({ message: "Esitys päivitetty" });
});

app.delete("/api/presentations/:id", (req, res) => {
  presentations.delete.run(req.params.id, req.userId);
  res.json({ message: "Esitys poistettu" });
});

// ═══ AGENTTIPROFIILIT ═══
app.get("/api/profiles", (req, res) => {
  const list = profiles.getByUser.all(req.userId);
  res.json({ profiles: list });
});

app.post("/api/profiles", (req, res) => {
  const { name, instructions } = req.body;
  if (!name) return res.status(400).json({ error: "Nimi puuttuu" });
  try {
    const result = profiles.create.run(req.userId, name.trim(), instructions || "");
    res.json({ id: result.lastInsertRowid, message: "Profiili tallennettu" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/profiles/:id", (req, res) => {
  const { name, instructions } = req.body;
  const existing = profiles.getById.get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: "Profiilia ei löydy" });
  profiles.update.run(name || existing.name, instructions ?? existing.instructions, req.params.id, req.userId);
  res.json({ message: "Profiili päivitetty" });
});

app.delete("/api/profiles/:id", (req, res) => {
  profiles.delete.run(req.params.id, req.userId);
  res.json({ message: "Profiili poistettu" });
});

// ═══ ADMIN-TOIMINNOT (vain admin-käyttäjille) ═══
function requireAdmin(req, res, next) {
  const user = users.getById.get(req.userId);
  if (!user || !user.is_admin) return res.status(403).json({ error: "Ei oikeuksia" });
  next();
}

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const list = users.getAll.all();
  res.json({ users: list });
});

app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.userId) return res.status(400).json({ error: "Et voi poistaa itseäsi" });
  users.delete.run(targetId);
  res.json({ message: "Käyttäjä poistettu" });
});

app.post("/api/admin/users/:id/reset-password", requireAdmin, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "Salasanan on oltava vähintään 6 merkkiä" });
  const target = users.getById.get(req.params.id);
  if (!target) return res.status(404).json({ error: "Käyttäjää ei löydy" });
  const hash = bcrypt.hashSync(newPassword, 12);
  users.resetPassword.run(hash, req.params.id);
  res.json({ message: "Salasana nollattu" });
});

app.get("/health", (req, res) => res.json({ status: "ok", ts: Date.now() }));

// ── Laskujen verifiointi ─────────────────────────────────────────
// Etsii AI:n tekstistä aritmeettisia väittämiä ja tarkistaa ne oikealla matematiikalla
app.post("/api/verify-numbers", (req, res) => {
  const { text } = req.body;
  if (!text) return res.json({ corrections: [], verified: true });

  const corrections = [];

  // Pattern 1: "X - Y = Z" tai "X + Y = Z" tai "X * Y = Z" tai "X / Y = Z"
  // Tukee k/M/milj suffixeja: "420k - 42k = 228k"
  const parseNum = (s) => {
    if (!s) return NaN;
    let n = s.replace(/\s/g, "").replace(",", ".");
    const multipliers = { k: 1000, K: 1000, "t€": 1000, M: 1e6, milj: 1e6, "M€": 1e6 };
    for (const [suffix, mult] of Object.entries(multipliers)) {
      if (n.endsWith(suffix)) { n = n.slice(0, -suffix.length); return parseFloat(n) * mult; }
    }
    // Prosentti
    if (n.endsWith("%")) return parseFloat(n.slice(0, -1));
    return parseFloat(n);
  };

  const formatNum = (n, original) => {
    if (!original) return String(n);
    // Palauta samassa yksikössä kuin alkuperäinen
    if (/k$/i.test(original.trim())) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
    if (/M€?$|milj/i.test(original.trim())) return (n / 1e6).toFixed(2) + "M";
    if (/%$/.test(original.trim())) return n.toFixed(1) + "%";
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(2);
  };

  // Etsii: "270k/v - 42k/v = 228k/v" tai "515 / 228 = 2,3"
  const calcPatterns = [
    // a OP b = c
    /(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)\s*([+\-\−×x*÷\/])\s*(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)\s*[=≈]\s*(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)/g,
    // a OP b OP c = d (ketjulaskut)
    /(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)\s*([+\-\−×x*÷\/])\s*(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)\s*([+\-\−×x*÷\/])\s*(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)\s*[=≈]\s*(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)/g,
  ];

  const doOp = (a, op, b) => {
    const ops = { "+": (x, y) => x + y, "-": (x, y) => x - y, "−": (x, y) => x - y,
      "*": (x, y) => x * y, "×": (x, y) => x * y, "x": (x, y) => x * y,
      "/": (x, y) => y !== 0 ? x / y : NaN, "÷": (x, y) => y !== 0 ? x / y : NaN };
    return (ops[op] || (() => NaN))(a, b);
  };

  // 3-osaiset laskut: a op b op c = d
  let m;
  const pat3 = /(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)\s*([+\-\−×x*÷\/])\s*(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)\s*([+\-\−×x*÷\/])\s*(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)\s*[=≈]\s*(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)/g;
  while ((m = pat3.exec(text)) !== null) {
    const [full, aStr, op1, bStr, op2, cStr, dStr] = m;
    const a = parseNum(aStr), b = parseNum(bStr), c = parseNum(cStr), claimed = parseNum(dStr);
    if ([a, b, c, claimed].some(isNaN)) continue;
    const actual = doOp(doOp(a, op1, b), op2, c);
    if (isNaN(actual)) continue;
    const tolerance = Math.max(Math.abs(claimed) * 0.02, 0.5);
    if (Math.abs(actual - claimed) > tolerance) {
      corrections.push({
        expression: full.trim(),
        claimed: formatNum(claimed, dStr),
        actual: formatNum(actual, dStr),
        claimedRaw: claimed,
        actualRaw: actual,
      });
    }
  }

  // 2-osaiset laskut: a op b = c
  const pat2 = /(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)\s*([+\-\−×x*÷\/])\s*(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)\s*[=≈]\s*(\d[\d\s,.']*(?:k|M|milj|M€|t€|%)?)/g;
  while ((m = pat2.exec(text)) !== null) {
    const [full, aStr, op, bStr, cStr] = m;
    // Ohita jos tämä kohta on jo löydetty 3-osaisena
    if (corrections.some(c => c.expression.includes(aStr) && c.expression.includes(bStr))) continue;
    const a = parseNum(aStr), b = parseNum(bStr), claimed = parseNum(cStr);
    if ([a, b, claimed].some(isNaN)) continue;
    const actual = doOp(a, op, b);
    if (isNaN(actual)) continue;
    const tolerance = Math.max(Math.abs(claimed) * 0.02, 0.5);
    if (Math.abs(actual - claimed) > tolerance) {
      corrections.push({
        expression: full.trim(),
        claimed: formatNum(claimed, cStr),
        actual: formatNum(actual, cStr),
        claimedRaw: claimed,
        actualRaw: actual,
      });
    }
  }

  // Pattern: prosenttilaskut "X on Y% Z:stä" → tarkista X = Z * Y/100
  const pctPat = /(\d[\d\s,.']*(?:k|M)?)\s+(?:on|=|eli)\s+(\d[\d,.]+)\s*%\s+(?:arvosta|summasta|of|kokonais)/gi;
  while ((m = pctPat.exec(text)) !== null) {
    // Tämä on informatiivinen — ei korjattava, mutta voidaan merkitä tulevaisuudessa
  }

  res.json({
    corrections,
    verified: corrections.length === 0,
    count: corrections.length,
  });
});

app.post("/api/extract-file", chatLimiter, async (req, res) => {
  const { base64, mimeType, fileName } = req.body;
  if (!base64 || !mimeType) return res.status(400).json({ error: "puuttuu" });
  // Tiedostokokorajoitus: ~10MB (base64 on ~33% isompi kuin alkuperäinen)
  const MAX_BASE64_SIZE = 14 * 1024 * 1024; // ~10MB tiedosto base64-koodattuna
  if (base64.length > MAX_BASE64_SIZE) return res.status(413).json({ error: "Tiedosto liian suuri (max 10MB)" });
  // Sallitut tiedostotyypit
  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!ALLOWED_TYPES.includes(mimeType)) return res.status(400).json({ error: "Tiedostotyyppi ei tuettu: " + mimeType });
  try {
    const block = mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } };
    const r = await client.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 8000,
      messages: [{ role: "user", content: [block, { type: "text", text: "Lue tiedosto (" + fileName + ") KOKONAAN, kaikki sivut alusta loppuun. Poimi KAIKKI oleellinen projektitieto: luvut, hinnat, aikataulut, taulukot, tarjoukset, yhteystiedot. ÄLÄ jätä mitään pois. Esitä suomeksi." }] }]
    });
    res.json({ text: r.content.find(b => b.type === "text")?.text || "" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ EXCEL-PARSINTA ═══
app.post("/api/extract-excel", chatLimiter, async (req, res) => {
  const { base64, fileName } = req.body;
  if (!base64) return res.status(400).json({ error: "Data puuttuu" });
  const MAX_BASE64_SIZE = 14 * 1024 * 1024;
  if (base64.length > MAX_BASE64_SIZE) return res.status(413).json({ error: "Tiedosto liian suuri (max 10MB)" });

  const tmpPath = path.join(__dirname, "tmp_excel_" + Date.now() + ".xlsx");
  try {
    // Tallenna base64 → tiedosto
    fs.writeFileSync(tmpPath, Buffer.from(base64, "base64"));

    // Parsitaan Pythonilla
    const pythonCmd = await findPython();
    if (!pythonCmd) throw new Error("Python not found");

    const text = await new Promise((resolve, reject) => {
      const proc = spawn(pythonCmd, ["-c", `
import sys, json
try:
    import openpyxl
    wb = openpyxl.load_workbook("${tmpPath.replace(/\\/g, "/")}", data_only=True)
    result = []
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        result.append(f"=== {sheet_name} ===")
        for row in ws.iter_rows(values_only=True):
            cells = [str(c) if c is not None else "" for c in row]
            if any(c.strip() for c in cells):
                result.append(" | ".join(cells))
    print("\\n".join(result[:500]))
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`], { timeout: 15000 });

      let stdout = "", stderr = "";
      proc.stdout.on("data", d => stdout += d);
      proc.stderr.on("data", d => stderr += d);
      proc.on("close", code => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(stderr || "Excel parsing failed"));
      });
      proc.on("error", reject);
    });

    res.json({ text: text.substring(0, 8000) });
  } catch (err) {
    console.error("Excel parse error:", err.message);
    res.status(500).json({ error: "Excel-tiedoston lukeminen epäonnistui: " + err.message });
  } finally {
    fs.unlink(tmpPath, () => {});
  }
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages, system, useSearch } = req.body;
  if (!messages?.length) return res.status(400).json({ error: "messages puuttuu" });
  try {
    const params = { model: "claude-sonnet-4-20250514", max_tokens: 4000, system: system || "Olet projektikonsultti.", messages };
    if (useSearch) params.tools = [{ type: "web_search_20250305", name: "web_search" }];
    const r = await client.messages.create(params);
    res.json({ text: r.content.filter(b => b.type === "text").map(b => b.text).join("\n") });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PPTX — Python stdin approach ──────────────────────────────────
app.post("/api/build-pptx", async (req, res) => {
  const { slideData, slideStructure, lang } = req.body;
  if (!slideData || !slideStructure?.length) return res.status(400).json({ error: "Data puuttuu" });

  for (const sd of slideStructure) {
    if (!slideData[sd.id]) slideData[sd.id] = getDefault(sd);
  }

  // Luo tiedostonimi projektin nimestä
  const titleSlide = slideStructure.find(s => s.layout === "title");
  const titleData = titleSlide ? slideData[titleSlide.id] : {};
  const projectName = (titleData.title || "presentation")
    .replace(/[^a-zäöåA-ZÄÖÅ0-9\s-]/g, "").trim().replace(/\s+/g, "_").substring(0, 50);
  const fileName = projectName + ".pptx";

  const outPath = path.join(__dirname, "pptx_" + Date.now() + ".pptx");
  const script = path.join(__dirname, "build_pptx.py");
  const tmpl = path.join(__dirname, "Gofore_Template.pptx");

  console.log("📁 Script:", script, "exists:", fs.existsSync(script));
  console.log("📁 Template:", tmpl, "exists:", fs.existsSync(tmpl));

  if (fs.existsSync(script) && fs.existsSync(tmpl)) {
    try {
      const pythonCmd = await findPython();
      if (pythonCmd) {
        console.log("🐍 Python:", pythonCmd);
        await runPython(pythonCmd, script, JSON.stringify({ slideData, slideStructure, lang: lang || "fi" }), outPath);

        if (fs.existsSync(outPath)) {
          console.log("✅ Gofore-template PPTX OK");
          return res.download(outPath, fileName, () => fs.unlink(outPath, () => {}));
        }
      }
    } catch (e) {
      console.error("❌ Python epäonnistui:", e.message);
      fs.unlink(outPath, () => {});
    }
  }

  // Fallback
  console.log("⚠️ Fallback: pptxgenjs");
  try {
    const fbPath = await buildFallbackPPTX(slideData, slideStructure);
    res.download(fbPath, fileName, () => fs.unlink(fbPath, () => {}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══ WORD (DOCX) BUILD ═══
app.post("/api/build-docx", async (req, res) => {
  const { documentText, chapters, lang } = req.body;
  if (!documentText) return res.status(400).json({ error: "Dokumenttiteksti puuttuu" });

  // Ota tiedostonimi ensimmäisestä luvusta tai oletusnimi
  const titleChapter = chapters?.find(s => s.layout === "title");
  const projectName = (titleChapter?.label || "dokumentti")
    .replace(/[^a-zäöåA-ZÄÖÅ0-9\s-]/g, "").trim().replace(/\s+/g, "_").substring(0, 50);
  const fileName = projectName + ".docx";

  const outPath = path.join(__dirname, "docx_" + Date.now() + ".docx");
  const script = path.join(__dirname, "build_docx.py");

  console.log("📁 DOCX Script:", script, "exists:", fs.existsSync(script));

  if (fs.existsSync(script)) {
    try {
      const pythonCmd = await findPython();
      if (pythonCmd) {
        console.log("🐍 Python (docx):", pythonCmd);
        await runPythonDocx(pythonCmd, script, JSON.stringify({ documentText, chapters: chapters || [], lang: lang || "fi" }), outPath);

        if (fs.existsSync(outPath)) {
          console.log("✅ Gofore DOCX OK");
          return res.download(outPath, fileName, () => fs.unlink(outPath, () => {}));
        }
      }
    } catch (e) {
      console.error("❌ Python DOCX epäonnistui:", e.message);
      fs.unlink(outPath, () => {});
    }
  }

  res.status(500).json({ error: "Word-dokumentin luonti epäonnistui" });
});

function runPythonDocx(cmd, script, jsonStr, outPath) {
  return new Promise((resolve, reject) => {
    const jsonPath = outPath.replace(".docx", ".json");
    let useTempFile = jsonStr.length > 50000;
    let args;

    if (useTempFile) {
      fs.writeFileSync(jsonPath, jsonStr, "utf-8");
      args = [script, "--file", jsonPath, outPath];
      console.log("📦 Python DOCX via temp file:", jsonStr.length, "bytes");
    } else {
      args = [script, "--stdin", outPath];
    }

    const proc = spawn(cmd, args, {
      cwd: path.dirname(script),
      timeout: 60000,
    });

    let stdout = "", stderr = "";
    proc.stdout.on("data", d => stdout += d);
    proc.stderr.on("data", d => stderr += d);

    proc.on("close", code => {
      if (useTempFile) fs.unlink(jsonPath, () => {});
      console.log("Python DOCX exit:", code, "stdout:", stdout.trim());
      if (stderr) console.error("Python DOCX stderr:", stderr.trim());
      code === 0 ? resolve(stdout) : reject(new Error(stderr || "exit " + code));
    });
    proc.on("error", (err) => {
      if (useTempFile) fs.unlink(jsonPath, () => {});
      reject(err);
    });

    if (!useTempFile) {
      proc.stdin.on("error", () => {});
      proc.stdin.write(jsonStr);
      proc.stdin.end();
    }
  });
}

function getDefaultDocx(sd) {
  const layout = sd.layout || "text";
  const defaults = {
    title: { title: sd.label || "", tagline: "", meta: "" },
    text: { heading: sd.label || "", content: "—" },
    table: { heading: sd.label || "", columns: ["—"], rows: [["—"]] },
    list: { heading: sd.label || "", items: ["—"], listType: "bullet" },
    summary: { heading: sd.label || "", content: "—" },
  };
  return defaults[layout] || defaults.text;
}

async function findPython() {
  for (const cmd of ["python3", "python"]) {
    try {
      await new Promise((ok, fail) => {
        const p = spawn(cmd, ["--version"]);
        p.on("close", code => code === 0 ? ok() : fail());
        p.on("error", fail);
      });
      return cmd;
    } catch { continue; }
  }
  return null;
}

function runPython(cmd, script, jsonStr, outPath) {
  return new Promise((resolve, reject) => {
    // Isoilla JSON-syötteillä stdin voi blokata → kirjoita temp-tiedostoon
    const jsonPath = outPath.replace(".pptx", ".json");
    let useTempFile = jsonStr.length > 50000; // >50KB → tiedosto
    let args;

    if (useTempFile) {
      fs.writeFileSync(jsonPath, jsonStr, "utf-8");
      args = [script, "--file", jsonPath, outPath];
      console.log("📦 Python via temp file:", jsonStr.length, "bytes");
    } else {
      args = [script, "--stdin", outPath];
    }

    const proc = spawn(cmd, args, {
      cwd: path.dirname(script),
      timeout: 60000, // 60s (oli 30s — pitkät esitykset voivat kestää)
    });

    let stdout = "", stderr = "";
    proc.stdout.on("data", d => stdout += d);
    proc.stderr.on("data", d => stderr += d);

    proc.on("close", code => {
      // Siivoa temp-tiedosto
      if (useTempFile) fs.unlink(jsonPath, () => {});
      console.log("Python exit:", code, "stdout:", stdout.trim());
      if (stderr) console.error("Python stderr:", stderr.trim());
      code === 0 ? resolve(stdout) : reject(new Error(stderr || "exit " + code));
    });
    proc.on("error", (err) => {
      if (useTempFile) fs.unlink(jsonPath, () => {});
      reject(err);
    });

    // Kirjoita stdin vain jos ei käytetä temp-tiedostoa
    if (!useTempFile) {
      proc.stdin.on("error", () => {}); // Estä EPIPE-kaatuminen
      proc.stdin.write(jsonStr);
      proc.stdin.end();
    }
  });
}

function getDefault(sd) {
  const m = { title:{title:sd.label||"",tagline:"",meta:""}, bullets:{heading:sd.label||"",bullets:["—"]},
    table:{heading:sd.label||"",columns:["—"],rows:[["—"]]}, cards:{heading:sd.label||"",cards:[{icon:"📌",title:"—",desc:"",level:"medium"}]},
    "two-col":{heading:sd.label||"",left:{title:"",items:["—"]},right:{title:"",items:[]}},
    gantt:{heading:sd.label||"",totalWeeks:8,phases:[{name:"—",start:1,end:4,critical:false}]},
    bar_chart:{heading:sd.label||"",categories:["A","B","C"],series:[{name:"Data",values:[0,0,0]}],unit:"",note:""},
    pie_chart:{heading:sd.label||"",slices:[{label:"—",value:100}],unit:"%",note:""},
    line_chart:{heading:sd.label||"",categories:["1","2","3"],series:[{name:"Data",values:[0,0,0]}],unit:"",note:""},
    kpi:{heading:sd.label||"",kpis:[{value:"—",label:"KPI",desc:""}],note:""} };
  return m[sd.layout] || m.bullets;
}

async function buildFallbackPPTX(data, structure) {
  const pptxgen = require("pptxgenjs");
  const pres = new pptxgen(); pres.layout = "LAYOUT_WIDE";
  const C = {deepBlue:"0C2340",digitalBlue:"1B6CA8",orange:"E8521A",mint:"3BBFAD",white:"FFFFFF",grey:"8C9BAA",silver:"D3D9DF",light:"EEF1F3"};
  const F = "Calibri";
  const hdr = (s,t) => { s.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:13.3,h:0.07,fill:{color:C.orange}}); s.addText(t,{x:0.5,y:0.15,w:11,h:0.5,fontSize:24,fontFace:F,bold:true,color:C.deepBlue,margin:0}); };

  for (const sd of structure) {
    const d = data[sd.id] || {};
    if (sd.layout==="title") {
      const s=pres.addSlide(); s.background={color:C.deepBlue};
      s.addText(d.title||"",{x:0.9,y:1.4,w:8.5,h:2.2,fontSize:36,fontFace:F,bold:true,color:C.white,margin:0});
      s.addText(d.tagline||"",{x:0.9,y:3.75,w:9,h:0.5,fontSize:15,fontFace:F,color:C.orange,margin:0});
      s.addText(d.meta||"",{x:0.9,y:4.35,w:9.5,h:0.32,fontSize:12,fontFace:F,color:C.silver,margin:0});
      if(d.projectLead) s.addText("PM: "+d.projectLead,{x:0.9,y:4.72,w:9.5,h:0.32,fontSize:12,fontFace:F,color:C.silver,margin:0});
      s.addText("GOFORE",{x:0.6,y:6.9,w:3,h:0.35,fontSize:12,fontFace:F,bold:true,color:C.orange,charSpacing:5,margin:0});
    } else if (sd.layout==="gantt") {
      const s=pres.addSlide(); s.background={color:C.white}; hdr(s,d.heading||sd.label);
      const tw=d.totalWeeks||8,phases=d.phases||[],wcw=(12.3-3.2)/tw,tl=0.4,tt=0.82,pcw=3.2,rh=0.48,hh=0.36;
      s.addShape(pres.shapes.RECTANGLE,{x:tl,y:tt,w:pcw,h:hh,fill:{color:C.deepBlue}});
      s.addText("Vaihe",{x:tl+0.1,y:tt,w:pcw,h:hh,fontSize:11,fontFace:F,bold:true,color:C.white,valign:"middle",margin:0});
      for(let w=0;w<tw;w++){const x=tl+pcw+w*wcw;s.addShape(pres.shapes.RECTANGLE,{x,y:tt,w:wcw,h:hh,fill:{color:C.deepBlue}});s.addText("Vk"+(w+1),{x,y:tt,w:wcw,h:hh,fontSize:8,fontFace:F,bold:true,color:C.white,align:"center",valign:"middle",margin:0});}
      phases.forEach((ph,ri)=>{const y=tt+hh+ri*rh,bg=ri%2===0?C.white:C.light;
        s.addShape(pres.shapes.RECTANGLE,{x:tl,y,w:pcw,h:rh,fill:{color:bg},line:{color:C.silver}});
        s.addText((ph.critical?"⬥ ":"")+(ph.name||""),{x:tl+0.1,y,w:pcw-0.15,h:rh,fontSize:10,fontFace:F,bold:ph.critical,color:ph.critical?C.orange:C.deepBlue,valign:"middle",margin:0});
        for(let w=0;w<tw;w++){const x=tl+pcw+w*wcw,active=w+1>=ph.start&&w+1<=ph.end;s.addShape(pres.shapes.RECTANGLE,{x,y,w:wcw,h:rh,fill:{color:active?(ph.critical?C.orange:C.digitalBlue):bg},line:{color:C.silver}});}});
    } else if (sd.layout==="table") {
      const s=pres.addSlide(); s.background={color:C.white}; hdr(s,d.heading||sd.label);
      const cols=d.columns||[],rows=d.rows||[];if(!cols.length)continue;
      const tw=12.3,tl=0.5,tt=0.82,rh=0.48,hh=0.38,cw=tw/cols.length;
      cols.forEach((c,ci)=>{s.addShape(pres.shapes.RECTANGLE,{x:tl+ci*cw,y:tt,w:cw,h:hh,fill:{color:C.deepBlue}});s.addText(c,{x:tl+ci*cw+0.06,y:tt,w:cw-0.1,h:hh,fontSize:11,fontFace:F,bold:true,color:C.white,valign:"middle",margin:0});});
      rows.forEach((row,ri)=>{const bg=ri%2===0?C.white:C.light,y=tt+hh+ri*rh;(row||[]).forEach((cell,ci)=>{if(ci>=cols.length)return;s.addShape(pres.shapes.RECTANGLE,{x:tl+ci*cw,y,w:cw,h:rh,fill:{color:bg},line:{color:C.silver}});s.addText(String(cell||""),{x:tl+ci*cw+0.06,y,w:cw-0.1,h:rh,fontSize:11,fontFace:F,color:C.deepBlue,valign:"middle",margin:0});});});
    } else if (sd.layout==="cards") {
      const s=pres.addSlide(); s.background={color:C.white}; hdr(s,d.heading||sd.label);
      const cards=d.cards||[],nc=Math.min(cards.length,3),cw=12.3/Math.max(nc,1);
      cards.slice(0,3).forEach((c,i)=>{const x=0.5+i*cw;
        s.addShape(pres.shapes.RECTANGLE,{x,y:1,w:cw-0.2,h:2.4,fill:{color:C.white},line:{color:C.silver}});
        s.addText((c.icon||"")+" "+c.title,{x:x+0.1,y:1.1,w:cw-0.4,h:0.44,fontSize:13,fontFace:F,bold:true,color:C.deepBlue,margin:0});
        s.addText(c.desc||"",{x:x+0.1,y:1.62,w:cw-0.4,h:1.6,fontSize:11,fontFace:F,color:C.grey,margin:0});});
    } else if (sd.layout==="two-col") {
      const s=pres.addSlide(); s.background={color:C.white}; hdr(s,d.heading||sd.label);
      [d.left||{},d.right||{}].forEach((col,ci)=>{const x=ci===0?0.5:6.9;
        s.addShape(pres.shapes.RECTANGLE,{x,y:0.82,w:6,h:0.38,fill:{color:ci===0?C.deepBlue:C.digitalBlue}});
        s.addText(col.title||"",{x:x+0.1,y:0.82,w:5.8,h:0.38,fontSize:12,fontFace:F,bold:true,color:C.white,valign:"middle",margin:0});
        (col.items||[]).slice(0,8).forEach((it,ii)=>{s.addText(it,{x:x+0.42,y:1.28+ii*0.55,w:5.4,h:0.48,fontSize:12,fontFace:F,color:C.deepBlue,valign:"middle",margin:0});});});
    } else {
      const s=pres.addSlide(); s.background={color:C.white}; hdr(s,d.heading||sd.label);
      const bullets=d.bullets||[];const fs2=bullets.length>7?11:bullets.length>5?12:13;const rh=bullets.length>7?0.55:bullets.length>5?0.6:0.7;
      bullets.slice(0,10).forEach((b,i)=>{s.addShape(pres.shapes.RECTANGLE,{x:0.5,y:0.88+i*rh,w:0.06,h:rh-0.2,fill:{color:C.orange}});s.addText(b,{x:0.75,y:0.88+i*rh,w:12,h:rh,fontSize:fs2,fontFace:F,color:C.deepBlue,valign:"middle",margin:0});});
    }
  }
  const es=pres.addSlide();es.background={color:C.deepBlue};es.addText("Pioneering\nan ethical\ndigital world.",{x:0.8,y:1.8,w:8,h:2.8,fontSize:34,fontFace:F,bold:true,color:C.white,margin:0});es.addText("GOFORE",{x:0.8,y:6.85,w:3,h:0.35,fontSize:12,fontFace:F,bold:true,color:C.orange,charSpacing:5,margin:0});
  const out=path.join(__dirname,"pptx_fb_"+Date.now()+".pptx");
  await pres.writeFile({fileName:out}); return out;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Gofore agentti portissa ${PORT}`));