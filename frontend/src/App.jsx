import { useState, useRef, useEffect } from "react";

const API = "https://pm-agent-avpl.onrender.com";

const G = {
  deepBlue: "#0C2340", digitalBlue: "#1B6CA8", codeBlue: "#5BA4CF",
  orange: "#E8521A", mint: "#3BBFAD", white: "#FFFFFF",
  grey: "#8C9BAA", silver: "#D3D9DF", light: "#EEF1F3", bg: "#F4F6F9",
};

const _d = new Date(); const TODAY = _d.toLocaleDateString("fi-FI", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
const SYSTEM = `Olet kokenut projektikonsultti Goforella. Kommunikoi AINA suomeksi.
TÄNÄÄN ON: ${TODAY} — käytä tätä kun ehdotat päivämääriä tai arvioit aikatauluja.
KRIITTISET SÄÄNNÖT:
1. ÄLÄ KOSKAAN keksi tai oleta projektitietoja joita ei ole annettu
2. Jos lähdemateriaaleja on annettu, LUE NE TARKASTI ja käytä VAIN niissä olevia tietoja
3. Merkitse arviot selkeästi: (arvio)
4. Jos jokin tieto puuttuu, KYSY se käyttäjältä — älä keksi
5. Ole ytimekäs ja käytännönläheinen
6. TÄRKEÄÄ: Olet osa sovellusta joka AUTOMAATTISESTI generoi PowerPoint-tiedoston backendissä. ÄLÄ KOSKAAN sano että et pysty luomaan PowerPointtia tai PPTX-tiedostoja — sovellus hoitaa sen puolestasi. Roolisi on kerätä sisältö dioihin, ei itse tehdä tiedostoa.
7. KRIITTINEN DIA-SÄÄNTÖ: Kun käsittelet dioja, käsittele AINA VAIN YKSI DIA KERRALLAAN. ÄLÄ KOSKAAN generoi useiden diojen sisältöä samassa vastauksessa. Odota käyttäjän hyväksyntä ennen kuin siirryt seuraavaan diaan.`;

const SEARCH_TRIGGERS = ["hae", "etsi", "googla", "selvitä", "tarkista netistä", "hae tietoa", "hae netistä", "search", "find info"];

async function callAPI(messages, extraSystem, forceSearch) {
  const system = extraSystem ? SYSTEM + "\n\n" + extraSystem : SYSTEM;
  // Tunnista automaattisesti jos viesti pyytää hakemaan tietoa
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
  const useSearch = forceSearch || SEARCH_TRIGGERS.some(t => lastUserMsg.toLowerCase().includes(t));
  const r = await fetch(API + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json", "x-session-token": localStorage.getItem("pm_token") || "" },
    body: JSON.stringify({ messages, system, useSearch }),
  });
  const d = await r.json();
  if (r.status === 401) {
    localStorage.removeItem("pm_token");
    window.location.reload(); // Pakota uudelleen kirjautuminen
  }
  if (d.error) throw new Error(d.error);
  return d.text;
}

function extractTag(text, tag) {
  const re = new RegExp("\\[" + tag + "\\]([\\s\\S]*?)\\[\\/" + tag + "\\]");
  const m = text.match(re);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1].trim());
    if (tag === "STRUCTURE_DATA" && !Array.isArray(parsed))
      return Object.values(parsed).filter(v => v && v.id);
    return parsed;
  } catch { return null; }
}

function extractSlideData(text) {
  const out = {};
  const re = /\[SLIDE_DATA:([\w-]+)\]([\s\S]*?)\[\/SLIDE_DATA\]/g;
  let m;
  while ((m = re.exec(text))) {
    try { out[m[1]] = JSON.parse(m[2].trim()); } catch {}
  }
  return out;
}

function strip(text) {
  return text
    .replace(/\[SLIDE_DATA:[\w-]+\][\s\S]*?\[\/SLIDE_DATA\]/g, "")
    .replace(/\[STRUCTURE_DATA\][\s\S]*?\[\/STRUCTURE_DATA\]/g, "")
    .replace(/##[\w_]+##/g, "").trim();
}

function getPropose(slide) {
  const layouts = {
    title:    "otsikkodia — suuri projektin nimi, lyhyt tagline (1 lause), meta-tiedot",
    bullets:  "bullet-lista — selkeä otsikko + 4-7 tärkeää kohtaa ranskalaisilla viivoilla",
    table:    "taulukko — otsikko + sarakkeet ja rivit (max 8 riviä)",
    gantt:    "Gantt-kaavio — projektin vaiheet aikajanalla, viikot, kriittinen polku",
    cards:    "korttiruudukko — 2-4 korttia ikoneilla ja värikoodeilla",
    "two-col":"kaksipalstainen — vasen ja oikea sarake omilla otsikoillaan",
  };
  return `KÄSITTELE NYT VAIN TÄMÄ YKSI DIA: "${slide.label}"
ÄLÄ generoi muita dioja. ÄLÄ näytä muiden diojen sisältöä. VAIN tämä yksi.

Layout: ${layouts[slide.layout] || "vapaa rakenne"}

Ehdota konkreettinen sisältö tälle yhdelle dialle projektin tietojen pohjalta.
Perustele lyhyesti miksi tämä rakenne sopii.
Kysy lopuksi: "Hyväksytkö tämän sisällön ja rakenteen, vai muutettavaa?"`;
}

function getConfirm(slide, isLast) {
  const schemas = {
    title:    '{"title":"...","tagline":"...","meta":"...","projectLead":"..."}',
    bullets:  '{"heading":"...","bullets":["kohta 1","kohta 2"],"note":"..."}',
    table:    '{"heading":"...","columns":["Sarake1","Sarake2"],"rows":[["arvo1","arvo2"]]}',
    gantt:    '{"totalWeeks":8,"frozenWeek":7,"phases":[{"name":"Vaihe","start":1,"end":2,"critical":false}]}',
    cards:    '{"heading":"...","cards":[{"icon":"⚠️","title":"...","desc":"...","level":"high"}]}',
    "two-col":'{"heading":"...","left":{"title":"...","items":["..."]},"right":{"title":"...","items":["..."]}}',
  };
  const schema = schemas[slide.layout] || '{"heading":"...","content":"..."}';
  return `Käsittele käyttäjän palaute "${slide.label}" -diaan.

Jos käyttäjä hyväksyy (ok, joo, hyvä, kyllä, tämä käy, sovittu tms.) TAI haluaa pieniä muutoksia:
TEET NÄMÄ KAIKKI SAMASSA VASTAUKSESSA, JÄRJESTYKSESSÄ:
1. [SLIDE_DATA:${slide.id}]${schema}[/SLIDE_DATA]
2. Kerro 1 lauseella mitä tallensit
3. ##SLIDE_DONE##
${isLast ? "4. ##ALL_SLIDES_DONE##\n5. Kirjoita: 'Esitys on valmis ja PowerPoint generoidaan automaattisesti.'" : ""}

TÄRKEÄÄ: Kohdat 1, 2 ja 3 AINA kun käyttäjä hyväksyy. Ei poikkeuksia.
Jos käyttäjä haluaa isoja muutoksia: tee muutos ensin, näytä uusi versio, pyydä vahvistus.`;
}

function Divider({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
      <div style={{ flex: 1, height: 1, background: G.silver }} />
      <span style={{ background: G.light, border: "1px solid " + G.silver, borderRadius: 20, padding: "3px 14px", fontSize: 12, color: G.grey, fontWeight: 600, whiteSpace: "nowrap" }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: G.silver }} />
    </div>
  );
}

function Bubble({ role, content }) {
  const ai = role === "assistant";
  return (
    <div style={{ display: "flex", flexDirection: ai ? "row" : "row-reverse", gap: 10, marginBottom: 16, alignItems: "flex-start" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: ai ? G.deepBlue : G.orange, color: ai ? G.orange : G.white, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 2 }}>
        {ai ? "G" : "P"}
      </div>
      <div style={{ maxWidth: "76%", background: ai ? G.white : G.deepBlue, color: ai ? G.deepBlue : G.white, borderRadius: ai ? "3px 14px 14px 14px" : "14px 3px 14px 14px", padding: "12px 16px", fontSize: 14, lineHeight: 1.65, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {content}
      </div>
    </div>
  );
}

function Pill({ slide, status }) {
  const cfg = {
    pending:    { bg: G.light,   border: G.silver,      color: G.grey,        sub: "" },
    proposing:  { bg: "#FFF3EE", border: G.orange,      color: G.orange,      sub: "Ehdotettu" },
    confirming: { bg: "#E8F4FB", border: G.digitalBlue, color: G.digitalBlue, sub: "Tarkistuksessa" },
    done:       { bg: "#E8FAF7", border: G.mint,        color: G.mint,        sub: "✓ Sovittu" },
  }[status] || { bg: G.light, border: G.silver, color: G.grey, sub: "" };
  return (
    <div style={{ background: cfg.bg, border: "1.5px solid " + cfg.border, borderRadius: 10, padding: "8px 12px", marginBottom: 6, display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }}>
      <span style={{ fontSize: 15 }}>{slide.icon || "📄"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: cfg.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slide.label}</div>
        {cfg.sub && <div style={{ fontSize: 10, color: cfg.color, opacity: 0.8 }}>{cfg.sub}</div>}
      </div>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.border, flexShrink: 0 }} />
    </div>
  );
}

export default function App() {
  const [screen, setScreen]           = useState("intro");
  // Palauta kirjautumistila sivun päivityksen jälkeen
  const [authed, setAuthed]             = useState(!!localStorage.getItem("pm_token"));
  const [pwInput, setPwInput]           = useState("");
  const [pwError, setPwError]           = useState(false);
  const [msgs, setMsgs]               = useState([]);
  const [input, setInput]             = useState("");
  const [busy, setBusy]               = useState(false);
  const [slides, setSlides]           = useState([]);
  const [slideIdx, setSlideIdx]       = useState(0);
  const [statuses, setStatuses]       = useState({});
  const [collected, setCollected]     = useState({});
  const [building, setBuilding]       = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [docContext, setDocContext]   = useState("");
  const [focusType, setFocusType]     = useState(""); // käyttäjän valitsema esityksen fokus
  const [dragOver, setDragOver]       = useState(false);
  const bottom = useRef();
  const fileInput = useRef();
  const collectedRef  = useRef({});   // tuore slidedata downloadPPTX:lle
  const screenRef     = useRef("intro"); // tuore screen doSend:lle (stale closure fix)
  const slideIdxRef   = useRef(0);       // tuore slideIdx runPlanning:lle
  const slidesRef     = useRef([]);      // tuore slides runPlanning:lle
  const proposingRef  = useRef(false);   // estää proposeSlide tuplapyynnön

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { slideIdxRef.current = slideIdx; }, [slideIdx]);
  useEffect(() => { slidesRef.current = slides; }, [slides]);

  const history = () =>
    msgs.filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content }));

  async function doSend() {
    const text = input.trim();
    const files = attachments;
    if (!text && files.length === 0) return;
    if (busy) return;

    let display = text, apiText = text, newCtx = docContext;
    if (files.length > 0) {
      const names = files.map(f => f.name).join(", ");
      const bodies = files.map(f => f.content).join("\n\n---\n\n");
      display = (text ? text + "\n\n" : "") + "📎 " + names;
      apiText = (text ? text + "\n\n" : "Tässä on projektimateriaali:\n\n") + bodies;
      newCtx = (docContext ? docContext + "\n\n---\n\n" : "PROJEKTIN LÄHDEMATERIAALIT:\n\n") + bodies;
      setDocContext(newCtx);
    }

    setInput(""); setAttachments([]);
    setMsgs(prev => [...prev, { role: "user", content: display }]);
    setBusy(true);
    try {
      const s = screenRef.current; // ← aina tuore arvo, ei stale closure
      if (s === "interview")      await runInterview(apiText, newCtx);
      else if (s === "focus")     await runFocusConfirm(apiText);
      else if (s === "structure") await runStructureConfirm(apiText);
      else if (s === "planning")  await runPlanning(apiText);
    } catch (e) {
      setMsgs(prev => [...prev, { role: "assistant", content: "⚠️ Virhe: " + e.message }]);
    }
    setBusy(false);
  }

  async function doLogin() {
    if (!pwInput) return;
    try {
      const r = await fetch(API + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwInput }),
      });
      const d = await r.json();
      if (d.token) {
        localStorage.setItem("pm_token", d.token);
        setAuthed(true);
      } else {
        setPwError(true);
      }
    } catch {
      setPwError(true);
    }
  }

  function startInterview() {
    setScreen("interview");
    setMsgs([
      { type: "divider", content: "💬 Vaihe 1 — Haastattelu" },
      { role: "assistant", content: "Hei! Olen Goforen projektisuunnitelma-agentti.\n\nKerro projektistasi omin sanoin — mitä on tarkoitus tehdä, milloin, kenen kanssa ja mitkä ovat tärkeimmät haasteet tai rajoitteet. Voit myös liittää projektidokumentteja 📎-napista.\n\nEtenen kanssasi kolmessa vaiheessa:\n1️⃣ Kerätään projektitiedot\n2️⃣ Valitaan esityksen fokus ja vahvistetaan tärkeimmät havainnot\n3️⃣ Rakennetaan diat yhdessä" }
    ]);
  }

  async function runInterview(userText, ctx) {
    const hist = [...history(), { role: "user", content: userText }];
    const r = await callAPI([
      ...hist,
      { role: "user", content: "[META] Onko projektin perustiedot (tavoite + aikataulu + osapuolet) riittävällä tasolla? Jos ei, kysy yksi tärkein puuttuva tieto lyhyesti. Jos kyllä, vastaa lyhyesti ja lisää: ##READY_TO_PLAN##" }
    ], ctx || docContext);

    const c = strip(r);
    setMsgs(prev => [...prev, { role: "assistant", content: c }]);
    // Only transition if READY and no question mark at end (AI isn't still asking something)
    const lastSentence = c.trim().split("\n").filter(l => l.trim()).pop() || "";
    const stillAsking = lastSentence.includes("?");
    if (r.includes("##READY_TO_PLAN##") && !stillAsking) {
      await runFocus([...hist, { role: "assistant", content: c }]);
    }
    if (ctx && ctx !== docContext) setDocContext(ctx);
  }


  async function runFocus(hist) {
    setScreen("focus");
    screenRef.current = "focus";
    setMsgs(prev => [...prev, { type: "divider", content: "🎯 Vaihe 2 — Esityksen fokus" }]);
    const r = await callAPI([
      ...(hist || history()),
      { role: "user", content: `Projektin perustiedot on kerätty. Nyt selvitetään mitä tällä esityksellä halutaan saavuttaa.

Esittele lyhyesti (2-3 lausetta) mikä on projektin tilanne ja kerro sitten:
"Mihin tarkoitukseen tämä esitys tehdään? Valitse sopivin tai kuvaile oma:"

1. 📋 Yleinen projektisuunnitelma — kokonaiskuva projektin etenemisestä
2. ⚠️ Riskianalyysi — fokus riskeihin, riippuvuuksiin ja mitigointiin
3. 📅 Aikataulukatsaus — fokus aikatauluun, milestonehin ja kriittiseen polkuun
4. 🚀 Kickoff-materiaali — esitys projektin käynnistyskokoukseen
5. 👥 Sidosryhmäraportti — tilannekatsaus johdolle tai asiakkaalle
6. 🔍 Joku muu fokus — käyttäjä kertoo itse

Odota käyttäjän vastausta ennen kuin jatkat.` }
    ], docContext);
    setMsgs(prev => [...prev, { role: "assistant", content: strip(r) }]);
    if (hist) window.__focusHist = hist;
  }

  async function runFocusConfirm(userText) {
    const hist = [...history(), { role: "user", content: userText }];
    const r = await callAPI([
      ...hist,
      { role: "user", content: `Käyttäjä valitsi esityksen fokuksen: "${userText}"

Tee seuraavat asiat:
1. Vahvista valittu fokus lyhyesti (1 lause)
2. Listaa 3-5 tärkeintä projektiin liittyvää havaintoa JUURI tämän fokuksen näkökulmasta
3. Kysy: "Oletko samaa mieltä näistä havainnoista, vai haluatko nostaa jonkin muun asian esiin?"
4. Lisää: ##FOCUS_CONFIRMED## ja tallenna fokus: [FOCUS_TYPE]${userText}[/FOCUS_TYPE]

Älä vielä ehdota diarakennetta.` }
    ], docContext);

    const c = strip(r);
    const focusMatch = r.match(/\[FOCUS_TYPE\]([\s\S]*?)\[\/FOCUS_TYPE\]/);
    if (focusMatch) {
      setFocusType(focusMatch[1].trim());
      window.__focusType = focusMatch[1].trim();
    }
    setMsgs(prev => [...prev, { role: "assistant", content: c }]);

    // Jos käyttäjä vahvistaa havainnot, siirrytään rakenne-vaiheeseen
    const confirmed = r.includes("##FOCUS_CONFIRMED##");
    const msgWords = userText.trim().toLowerCase().split(/\s+/);
    const shortYes = msgWords.length <= 3 &&
      ["ok","joo","kyllä","selvä","hyvä","sopii","käy","juu","yes","jep"]
        .some(w => msgWords.includes(w));

    if (confirmed || shortYes) {
      await runInsightsAndStructure([...hist, { role: "assistant", content: c }]);
    }
  }

  async function runInsightsAndStructure(hist) {
    setScreen("structure");
    setMsgs(prev => [...prev, { type: "divider", content: "🔍 Vaihe 2 — Analyysi & esitysrakenne" }]);
    const r = await callAPI([
      ...(hist || history()),
      { role: "user", content: `Tee kaksi asiaa SELKEÄSTI EROTELTUINA:

## OSA 1: PROJEKTIN OIVALLUKSET
Listaa 3-5 tärkeintä havaintoa tästä projektista numerottuina (1. 2. 3. jne). Mitä PM:n täytyy erityisesti huomioida? Kriittiset riskit, aikataulupaine, pullonkaulat. Ole konkreettinen ja lyhyt.

## OSA 2: EHDOTETTU DIARAKENNE
Näytä ehdotettu rakenne SELKEÄNÄ LISTANA tässä muodossa (yksi dia per rivi):
1. 🎯 Kansi — projektin nimi ja perustiedot
2. 📊 Yhteenveto — ...
jne.

Perustele lyhyesti miksi juuri tämä rakenne sopii tälle projektille.

Kysy sitten: "Hyväksytkö tämän rakenteen, vai haluatko lisätä/poistaa/muuttaa jotain diaa?"

Esityksen fokus on: ${window.__focusType || "yleinen projektisuunnitelma"}

Ehdota diarakenne JUURI tälle fokukselle sopivaksi. Esim. riskifokuksessa enemmän riskidioja, kickoff-fokuksessa konkreettiset seuraavat askeleet jne.

Tallenna rakenne MYÖS koneellisessa muodossa (layouts: title|bullets|table|gantt|cards|two-col):
[STRUCTURE_DATA][{"id":"cover","label":"Kansi","icon":"🎯","layout":"title","reason":"..."}][/STRUCTURE_DATA]` }
    ], docContext);

    const structure = extractTag(r, "STRUCTURE_DATA");
    setMsgs(prev => [...prev, { role: "assistant", content: strip(r) }]);
    if (structure) window.__pendingStructure = structure;
  }

  async function runStructureConfirm(userText) {
    const hist = [...history(), { role: "user", content: userText }];
    const r = await callAPI([
      ...hist,
      { role: "user", content: `Käyttäjä kommentoi rakenne-ehdotustasi.

Jos käyttäjä hyväksyy rakenteen (ok, joo, hyvä, kyllä, sovittu, käy, selvä tms.):
- Kirjoita lyhyt vahvistus (1 lause)
- Lisää PAKOLLISESTI: ##STRUCTURE_CONFIRMED##
- Palauta rakenne TÄSMÄLLEEN: [STRUCTURE_DATA][{"id":"...","label":"...","icon":"...","layout":"title|bullets|table|gantt|cards|two-col"},...][/STRUCTURE_DATA]
- ÄLÄ aloita diojen sisältöä tässä — se tapahtuu automaattisesti seuraavassa vaiheessa

Jos käyttäjä haluaa muuttaa rakennetta: tee muutos, näytä uusi lista, pyydä vahvistus.
Palauta aina päivitetty [STRUCTURE_DATA] muutosten jälkeen.` }
    ], docContext);

    const structure = extractTag(r, "STRUCTURE_DATA");
    const c = strip(r);
    setMsgs(prev => [...prev, { role: "assistant", content: c }]);
    if (structure) window.__pendingStructure = structure;

    const rawStructure = window.__pendingStructure;
    const confirmedStructure = Array.isArray(rawStructure) ? rawStructure
      : rawStructure && typeof rawStructure === "object" ? Object.values(rawStructure)
      : null;

    const tagConfirm = r.includes("##STRUCTURE_CONFIRMED##");
    // shortYes: max 3 sanaa, tunnistetut hyväksyntäsanat
    const msgWords = userText.trim().toLowerCase().split(/\s+/);
    const shortYes = msgWords.length <= 3 &&
      ["ok","joo","kyllä","selvä","hyvä","sopii","käy","juu","yes","jep","kyl"]
        .some(w => msgWords.includes(w));
    const positiveInReply = ["vahvistettu","hyväksytty","aloitetaan","siirrytään","sovittu","edetään"]
      .some(kw => c.toLowerCase().includes(kw));

    const isConfirmed = (tagConfirm || shortYes || positiveInReply)
      && confirmedStructure && confirmedStructure.length > 0;

    if (isConfirmed) {
      setSlides(confirmedStructure);
      slidesRef.current = confirmedStructure;
      setStatuses(Object.fromEntries(confirmedStructure.map(s => [s.id, "pending"])));
      setMsgs(prev => [...prev, { type: "divider", content: "✅ Vaihe 3 — Diojen sisällöntuotanto" }]);
      setScreen("planning");
      screenRef.current = "planning";
      setSlideIdx(0);
      slideIdxRef.current = 0;
      await proposeSlide(0, [...hist, { role: "assistant", content: c }], confirmedStructure);
    }
  }

  async function proposeSlide(idx, hist, slidesArr) {
    if (proposingRef.current) { console.log("proposeSlide already running, skipping"); return; }
    proposingRef.current = true;
    try {
    const cur = slidesArr || slides;
    setSlideIdx(idx);
    setStatuses(prev => {
      const n = { ...prev };
      cur.forEach((s, i) => { if (i === idx) n[s.id] = "proposing"; else if (n[s.id] !== "done") n[s.id] = "pending"; });
      return n;
    });
    const slide = cur[idx];
    const r = await callAPI([
      ...(hist || history()),
      { role: "user", content: "[DIA " + (idx+1) + "/" + cur.length + " — " + slide.label + "]\n\n" + getPropose(slide) }
    ], docContext);
    setMsgs(prev => [...prev,
      { type: "divider", content: "📄 Dia " + (idx+1) + "/" + cur.length + " — " + (slide.icon || "") + " " + slide.label },
      { role: "assistant", content: strip(r) }
    ]);
    setStatuses(prev => ({ ...prev, [slide.id]: "confirming" }));
    } finally { proposingRef.current = false; }
  }

  async function runPlanning(userText) {
    const cur = slidesRef.current;   // ← tuore, ei stale closure
    const idx = slideIdxRef.current; // ← tuore, ei stale closure
    const slide = cur[idx];
    const isLast = idx === cur.length - 1;
    const hist = [...history(), { role: "user", content: userText }];
    const r = await callAPI([
      ...hist,
      { role: "user", content: "[DIA " + (idx+1) + "/" + cur.length + " — " + slide.label + " — VAHVISTA]\n\n" + getConfirm(slide, isLast) + "\n\nKäyttäjän vastaus: \"" + userText + "\"" }
    ], docContext);

    const extracted = extractSlideData(r);
    if (Object.keys(extracted).length) {
      const newCollected = { ...collectedRef.current, ...extracted };
      collectedRef.current = newCollected;   // ← päivitä ref välittömästi
      setCollected(newCollected);
    }
    const c = strip(r);
    setMsgs(prev => [...prev, { role: "assistant", content: c }]);

    // Tunnistus: tagi on ensisijainen, fallback NLP jos AI unohtaa tagin
    const tagDone = r.includes("##SLIDE_DONE##") || r.includes("##ALL_SLIDES_DONE##");
    const hasData = Object.keys(extracted).length > 0;
    const lastLine = c.split("\n").filter(l => l.trim()).pop() || "";
    const noQuestion = !lastLine.includes("?");
    const positiveWords = ["hyväksytty", "tallennettu", "valmis", "sovittu", "siirrytään", "loistava", "erinomainen", "generoi", "powerpoint"];
    const positiveReply = positiveWords.some(kw => c.toLowerCase().includes(kw));
    // Fallback 1: data tallennettu + positiivinen vastaus ilman kysymystä
    const fallback1 = hasData && positiveReply && noQuestion;
    // Fallback 2: viimeinen dia + positiivinen vastaus ilman kysymystä (vaikka ei dataa)
    const fallback2 = isLast && positiveReply && noQuestion;
    const slideDone = tagDone || fallback1 || fallback2;
    const allDone   = r.includes("##ALL_SLIDES_DONE##") || (slideDone && isLast);

    if (slideDone) {
      setStatuses(prev => ({ ...prev, [slide.id]: "done" }));
      const next = idx + 1;
      if (!allDone && next < cur.length) {
        setSlideIdx(next);
        slideIdxRef.current = next;  // ← sync heti
        setTimeout(() => proposeSlide(next, null, cur), 600);
      } else {
        setScreen("ready");
        setMsgs(prev => [...prev,
          { type: "divider", content: "✅ Kaikki diat valmiit — ladataan PowerPoint..." },
          { role: "assistant", content: "Esitys on valmis! PowerPoint-lataus käynnistyy automaattisesti.\n\nJos lataus ei käynnisty, paina alla olevaa nappia:" },
          { type: "download" }
        ]);
        setTimeout(() => downloadPPTX(cur), 800);
      }
    }
  }

  async function readFile(f) {
    if (f.name.match(/\.(txt|md|csv|json)$/i)) {
      const t = await f.text().catch(() => "");
      return { name: f.name, content: "[" + f.name + "]\n" + t.substring(0, 5000) };
    }
    const mimeMap = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
    const ext = f.name.split(".").pop().toLowerCase();
    const mimeType = mimeMap[ext];
    if (mimeType) {
      try {
        const buf = await f.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        const base64 = btoa(binary);
        const r = await fetch(API + "/api/extract-file", {
          method: "POST", headers: { "Content-Type": "application/json", "x-session-token": localStorage.getItem("pm_token") || "" },
          body: JSON.stringify({ base64, mimeType, fileName: f.name }),
        });
        const d = await r.json();
        return { name: f.name, content: "[" + f.name + (d.text ? " — Claude luki:]\n" + d.text : ": " + (d.error || "luku epäonnistui") + "]") };
      } catch (e) {
        return { name: f.name, content: "[" + f.name + ": virhe — " + e.message + "]" };
      }
    }
    return { name: f.name, content: "[" + f.name + " — kopioi sisältö tekstinä, tiedostotyyppiä ei tueta]" };
  }

  async function addFiles(fileList) {
    const read = await Promise.all(Array.from(fileList).map(readFile));
    setAttachments(prev => [...prev, ...read]);
  }

  async function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    const files = [];
    if (e.dataTransfer.items) {
      for (const item of Array.from(e.dataTransfer.items)) {
        if (item.kind !== "file") continue;
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          await new Promise(res => entry.createReader().readEntries(async entries => {
            for (const en of entries) if (en.isFile) await new Promise(r => en.file(f => { files.push(f); r(); }));
            res();
          }));
        } else { const f = item.getAsFile(); if (f) files.push(f); }
      }
    } else files.push(...Array.from(e.dataTransfer.files));
    if (files.length) await addFiles(files);
  }

  async function downloadPPTX(slidesArr) {
    setBuilding(true);
    try {
      const r = await fetch(API + "/api/build-pptx", {
        method: "POST", headers: { "Content-Type": "application/json", "x-session-token": localStorage.getItem("pm_token") || "" },
        body: JSON.stringify({ slideData: collectedRef.current, slideStructure: slidesArr || slidesRef.current }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "HTTP " + r.status);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: "projektisuunnitelma.pptx" }).click();
      URL.revokeObjectURL(url);
    } catch (e) { alert("Virhe: " + e.message); }
    setBuilding(false);
  }

  const canSend = !busy && (input.trim().length > 0 || attachments.length > 0);
  const doneCount = Object.values(statuses).filter(s => s === "done").length;
  const showSidebar = screen === "planning" || screen === "ready";
  const currentSlide = slides[slideIdx];

  if (!authed) return (
    <div style={{ minHeight: "100vh", background: G.deepBlue, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI',sans-serif" }}>
      <div style={{ textAlign: "center", width: 320 }}>
        <div style={{ width: 60, height: 60, background: G.orange, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: G.white, fontWeight: 700, margin: "0 auto 20px" }}>G</div>
        <h2 style={{ color: G.white, marginBottom: 8 }}>Projektisuunnitelma-agentti</h2>
        <p style={{ color: G.grey, fontSize: 13, marginBottom: 24 }}>Syötä salasana jatkaaksesi</p>
        <input
          type="password"
          value={pwInput}
          onChange={e => { setPwInput(e.target.value); setPwError(false); }}
          onKeyDown={e => { if (e.key === "Enter") doLogin(); }}
          placeholder="Salasana"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid " + (pwError ? G.orange : G.grey), background: "rgba(255,255,255,0.08)", color: G.white, fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
        />
        {pwError && <div style={{ color: G.orange, fontSize: 13, marginBottom: 8 }}>Väärä salasana</div>}
        <button onClick={doLogin}
          style={{ width: "100%", background: G.orange, color: G.white, border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Kirjaudu →
        </button>
      </div>
    </div>
  );

  if (screen === "intro") return (
    <div style={{ minHeight: "100vh", background: G.deepBlue, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "'Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ width: 68, height: 68, background: G.orange, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: G.white, fontWeight: 700, margin: "0 auto 24px" }}>G</div>
        <h1 style={{ color: G.white, fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>Projektisuunnitelma-agentti</h1>
        <p style={{ color: G.codeBlue, fontSize: 14, lineHeight: 1.7, margin: "0 0 32px" }}>Rakennetaan projektisuunnitelmasi yhdessä, dia kerrallaan.<br/>Rakenne räätälöidään projektisi mukaan.</p>
        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 20, marginBottom: 32, textAlign: "left" }}>
          {[
            ["💬", "Haastattelu", "Kerro projektistasi — liitä myös dokumentteja"],
            ["🔍", "Oivallukset & rakenne", "Tunnistan riskit ja ehdotan räätälöityä rakennetta"],
            ["🤝", "Dia kerrallaan", "Ehdotan sisällön ja layoutin, sinä vahvistat"],
            ["📊", "Valmis PPTX", "Gofore-teemainen tiedosto ladattavaksi"],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <div>
                <div style={{ color: G.white, fontWeight: 600, fontSize: 13 }}>{title}</div>
                <div style={{ color: G.grey, fontSize: 12 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={startInterview} style={{ width: "100%", background: G.orange, color: G.white, border: "none", borderRadius: 12, padding: "14px 0", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
          Aloita haastattelu →
        </button>
        <button onClick={async () => {
          try {
            const testData = {
              slideData: { cover: { title: "Testiprojekti", tagline: "Testi toimii!", meta: "Gofore · 2025", projectLead: "Leo" } },
              slideStructure: [{ id: "cover", label: "Kansi", icon: "🎯", layout: "title" }]
            };
            const r = await fetch(API + "/api/build-pptx", { method: "POST", headers: { "Content-Type": "application/json", "x-session-token": localStorage.getItem("pm_token") || "" }, body: JSON.stringify(testData) });
            if (!r.ok) { const e = await r.json().catch(() => ({})); alert("Virhe: " + (e.error || r.status)); return; }
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            Object.assign(document.createElement("a"), { href: url, download: "testi.pptx" }).click();
            URL.revokeObjectURL(url);
          } catch(e) { alert("Yhteysvirhe: " + e.message); }
        }} style={{ width: "100%", marginTop: 8, background: "transparent", color: G.codeBlue, border: "1px solid " + G.codeBlue, borderRadius: 12, padding: "10px 0", fontSize: 13, cursor: "pointer" }}>
          🧪 Testaa PPTX-lataus
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", fontFamily: "'Segoe UI',sans-serif", background: G.bg, overflow: "hidden" }}>
      {showSidebar && (
        <div style={{ width: 200, background: G.white, borderRight: "1px solid " + G.silver, padding: "14px 12px", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
          <div style={{ color: G.grey, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Diat {doneCount}/{slides.length}
          </div>
          {slides.map(s => <Pill key={s.id} slide={s} status={statuses[s.id] || "pending"} />)}
          {(screen === "ready" || (slides.length > 0 && doneCount === slides.length)) && (
            <button onClick={downloadPPTX} disabled={building}
              style={{ background: building ? G.grey : G.orange, color: G.white, border: "none", borderRadius: 10, padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: building ? "not-allowed" : "pointer", marginTop: 16 }}>
              {building ? "⏳ Rakennetaan..." : "🚀 Lataa PPTX"}
            </button>
          )}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: G.deepBlue, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, background: G.orange, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: G.white, fontWeight: 700, fontSize: 12 }}>G</div>
          <div>
            <div style={{ color: G.white, fontWeight: 600, fontSize: 13 }}>Projektisuunnitelma-agentti</div>
            <div style={{ color: G.codeBlue, fontSize: 11 }}>
              {screen === "interview"  ? "💬 Vaihe 1 — Haastattelu" :
               screen === "focus"      ? "🎯 Vaihe 2 — Esityksen fokus" :
               screen === "structure"  ? "🔍 Vaihe 3 — Diarakenne" :
               screen === "planning" && currentSlide ? "📄 Dia " + (slideIdx+1) + "/" + slides.length + " — " + (currentSlide.icon||"") + " " + currentSlide.label :
               screen === "ready"     ? "✅ Kaikki diat sovittu" : ""}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", position: "relative" }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
          onDrop={onDrop}>
          {dragOver && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(27,108,168,0.1)", border: "2px dashed " + G.digitalBlue, borderRadius: 8, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ background: G.white, borderRadius: 12, padding: "24px 40px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                <div style={{ color: G.digitalBlue, fontWeight: 600 }}>Pudota tiedostot tähän</div>
                <div style={{ color: G.grey, fontSize: 12, marginTop: 4 }}>pdf · kuva · txt · csv · json</div>
              </div>
            </div>
          )}
          {msgs.map((m, i) => {
            if (m.type === "divider") return <Divider key={i} text={m.content} />;
            if (m.type === "download") return (
              <div key={i} style={{ display:"flex", justifyContent:"center", margin:"12px 0" }}>
                <button onClick={() => downloadPPTX(slidesRef.current)} disabled={building}
                  style={{ background: building ? G.grey : G.orange, color:G.white, border:"none", borderRadius:12, padding:"14px 32px", fontSize:15, fontWeight:700, cursor:building?"not-allowed":"pointer", boxShadow:"0 2px 8px rgba(232,82,26,0.3)" }}>
                  {building ? "⏳ Rakennetaan..." : "🚀 Lataa PowerPoint"}
                </button>
              </div>
            );
            return <Bubble key={i} role={m.role} content={m.content} />;
          })}
          {busy && (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: G.deepBlue, color: G.orange, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>G</div>
              <div style={{ background: G.white, borderRadius: "3px 14px 14px 14px", padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <span style={{ color: G.grey, letterSpacing: 6, fontSize: 16 }}>● ● ●</span>
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>

        {attachments.length > 0 && (
          <div style={{ background: G.white, borderTop: "1px solid " + G.silver, padding: "8px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {attachments.map((a, i) => (
              <div key={i} style={{ background: G.light, border: "1px solid " + G.silver, borderRadius: 6, padding: "3px 10px", fontSize: 12, color: G.deepBlue, display: "flex", alignItems: "center", gap: 6 }}>
                📄 {a.name}
                <span style={{ cursor: "pointer", color: G.grey, fontSize: 14 }} onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}>×</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: G.white, borderTop: "1px solid " + G.silver, padding: "12px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", maxWidth: 900, margin: "0 auto" }}>
            <button title="Liitä tiedosto" onClick={() => fileInput.current?.click()}
              style={{ width: 36, height: 36, flexShrink: 0, alignSelf: "flex-end", background: "transparent", border: "1.5px dashed " + G.silver, borderRadius: 9, cursor: "pointer", fontSize: 16, color: G.grey }}>📎</button>
            <input ref={fileInput} type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg"
              style={{ display: "none" }}
              onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
            <textarea value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }}
              placeholder={screen === "interview" ? "Kerro projektistasi... (Enter lähettää · Shift+Enter = uusi rivi)" : screen === "focus"     ? "Valitse fokus tai kuvaile mitä haluat esitykseltä..." :
                screen === "structure" ? "Hyväksy rakenne tai ehdota muutoksia..." : "Kommentoi tai hyväksy ehdotus..."}
              style={{ flex: 1, background: G.light, outline: "none", resize: "vertical", border: "1.5px solid " + (input.length > 0 ? G.digitalBlue : G.silver), borderRadius: 11, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", lineHeight: 1.6, color: G.deepBlue, minHeight: 80, maxHeight: 220 }} />
            <button onClick={doSend} disabled={!canSend}
              style={{ width: 38, height: 38, flexShrink: 0, alignSelf: "flex-end", background: canSend ? G.orange : G.silver, color: G.white, border: "none", borderRadius: "50%", fontSize: 18, cursor: canSend ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}