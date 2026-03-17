import { useState, useRef, useEffect, useCallback } from "react";

const API = "https://pm-agent-avpl.onrender.com";

const G = {
  deepBlue: "#0C2340", digitalBlue: "#1B6CA8", codeBlue: "#5BA4CF",
  orange: "#E8521A", mint: "#3BBFAD", white: "#FFFFFF",
  grey: "#8C9BAA", silver: "#D3D9DF", light: "#EEF1F3", bg: "#F4F6F9",
};

const TODAY = new Date().toLocaleDateString("fi-FI", { year: "numeric", month: "long", day: "numeric" });

const SYSTEM = `Olet kokenut projektikonsultti Goforella. Kommunikoi AINA suomeksi.
TÄNÄÄN ON: ${TODAY}.

ROOLISI:
- Olet osa sovellusta joka generoi PowerPoint-tiedoston automaattisesti.
- Sinun EI tarvitse itse tehdä PPTX-tiedostoa — sovellus hoitaa sen.
- Roolisi on kerätä ja hioa sisältö keskustelemalla käyttäjän kanssa.

PERUSSÄÄNNÖT:
1. ÄLÄ KOSKAAN keksi tai oleta projektitietoja joita ei ole annettu.
2. Jos lähdemateriaaleja on annettu, käytä VAIN niissä olevia tietoja.
3. Merkitse arviot selkeästi: "(arvio)".
4. Jos jokin tieto puuttuu, KYSY se käyttäjältä — älä keksi.
5. Ole ytimekäs ja käytännönläheinen — max 2-3 kappaletta per vastaus.
6. Käsittele VAIN sitä asiaa josta sinua pyydetään. Älä hyppää vaiheesta toiseen.
7. Kysy aina käyttäjältä mielipide ja odota vastaus ennen kuin etenet.`;

const PHASE_PROMPTS = {
  interview: `NYKYINEN VAIHE: Haastattelu
Tehtäväsi on kerätä projektitiedot. Kysy yksi asia kerrallaan.
Tarvitset vähintään: projektin tavoite, aikataulu, ja osapuolet.
Kun tiedot riittävät, lisää: ##READY_TO_PLAN##`,
  focus: `NYKYINEN VAIHE: Esityksen fokus`,
  insights: `NYKYINEN VAIHE: Tärkeimmät havainnot`,
  structure: `NYKYINEN VAIHE: Diarakenne`,
  planning: `NYKYINEN VAIHE: Diojen sisältö
Käsittele VAIN yksi dia kerrallaan.`,
};

const SEARCH_TRIGGERS = ["hae","etsi","googla","selvitä","tarkista netistä","hae tietoa","search"];

async function callAPI(messages, systemExtra, forceSearch) {
  const system = systemExtra ? SYSTEM + "\n\n" + systemExtra : SYSTEM;
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
  const useSearch = forceSearch || SEARCH_TRIGGERS.some(t => lastUserMsg.toLowerCase().includes(t));
  const r = await fetch(API + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": localStorage.getItem("pm_token") || "" },
    body: JSON.stringify({ messages, system, useSearch }),
  });
  const d = await r.json();
  if (r.status === 401) { localStorage.removeItem("pm_token"); window.location.reload(); }
  if (d.error) throw new Error(d.error);
  return d.text;
}

function extractTag(text, tag) {
  const re = new RegExp("\\[" + tag + "\\]([\\s\\S]*?)\\[\\/" + tag + "\\]");
  const m = text.match(re);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1].trim());
    if (tag === "STRUCTURE_DATA" && !Array.isArray(parsed)) return Object.values(parsed).filter(v => v && v.id);
    return parsed;
  } catch { return null; }
}

function extractSlideData(text) {
  const out = {};
  const re = /\[SLIDE_DATA:([\w_-]+)\]([\s\S]*?)\[\/SLIDE_DATA\]/g;
  let m;
  while ((m = re.exec(text))) { try { out[m[1]] = JSON.parse(m[2].trim()); } catch {} }
  return out;
}

function strip(text) {
  return text
    .replace(/\[SLIDE_DATA:[\w_-]+\][\s\S]*?\[\/SLIDE_DATA\]/g, "")
    .replace(/\[STRUCTURE_DATA\][\s\S]*?\[\/STRUCTURE_DATA\]/g, "")
    .replace(/\[FOCUS_TYPE\][\s\S]*?\[\/FOCUS_TYPE\]/g, "")
    .replace(/\[JÄRJESTELMÄOHJE[^\]]*\][\s\S]*?(?=\n\n|$)/g, "")
    .replace(/##[\w_]+##/g, "")
    .trim();
}

function isShortYes(text) {
  const w = text.trim().toLowerCase().split(/\s+/);
  if (w.length > 5) return false;
  return ["ok","joo","kyllä","selvä","hyvä","sopii","käy","juu","yes","jep","okei","sovittu","hyväksyn","edetään","aloitetaan","siirrytään","toimii"].some(x => w.includes(x));
}

const LAYOUT_DESC = {
  title: "otsikkodia", bullets: "bullet-lista (4-7 kohtaa)", table: "taulukko",
  gantt: "Gantt-kaavio", cards: "korttiruudukko (2-4 korttia)", "two-col": "kaksipalstainen",
};

const SLIDE_SCHEMAS = {
  title: '{"title":"...","tagline":"...","meta":"...","projectLead":"..."}',
  bullets: '{"heading":"...","bullets":["kohta 1","kohta 2"],"note":""}',
  table: '{"heading":"...","columns":["S1","S2"],"rows":[["a","b"]]}',
  gantt: '{"heading":"Aikataulu","totalWeeks":8,"frozenWeek":null,"phases":[{"name":"V","start":1,"end":2,"critical":false}]}',
  cards: '{"heading":"...","cards":[{"icon":"⚠️","title":"...","desc":"...","level":"high"}]}',
  "two-col": '{"heading":"...","left":{"title":"...","items":["..."]},"right":{"title":"...","items":["..."]}}',
};

function Divider({ text }) {
  return (<div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0" }}>
    <div style={{ flex:1, height:1, background:G.silver }} />
    <span style={{ background:G.light, border:"1px solid "+G.silver, borderRadius:20, padding:"3px 14px", fontSize:12, color:G.grey, fontWeight:600, whiteSpace:"nowrap" }}>{text}</span>
    <div style={{ flex:1, height:1, background:G.silver }} />
  </div>);
}

function Bubble({ role, content }) {
  const ai = role === "assistant";
  return (<div style={{ display:"flex", flexDirection:ai?"row":"row-reverse", gap:10, marginBottom:16, alignItems:"flex-start" }}>
    <div style={{ width:32, height:32, borderRadius:"50%", background:ai?G.deepBlue:G.orange, color:ai?G.orange:G.white, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, flexShrink:0, marginTop:2 }}>{ai?"G":"P"}</div>
    <div style={{ maxWidth:"76%", background:ai?G.white:G.deepBlue, color:ai?G.deepBlue:G.white, borderRadius:ai?"3px 14px 14px 14px":"14px 3px 14px 14px", padding:"12px 16px", fontSize:14, lineHeight:1.65, boxShadow:"0 1px 4px rgba(0,0,0,0.07)", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{content}</div>
  </div>);
}

function Pill({ slide, status }) {
  const cfg = { pending:{bg:G.light,border:G.silver,color:G.grey,sub:""}, proposing:{bg:"#FFF3EE",border:G.orange,color:G.orange,sub:"Ehdotettu"}, confirming:{bg:"#E8F4FB",border:G.digitalBlue,color:G.digitalBlue,sub:"Odottaa"}, done:{bg:"#E8FAF7",border:G.mint,color:G.mint,sub:"✓ Sovittu"} }[status] || {bg:G.light,border:G.silver,color:G.grey,sub:""};
  return (<div style={{ background:cfg.bg, border:"1.5px solid "+cfg.border, borderRadius:10, padding:"8px 12px", marginBottom:6, display:"flex", alignItems:"center", gap:8, transition:"all 0.2s" }}>
    <span style={{ fontSize:15 }}>{slide.icon||"📄"}</span>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:12, fontWeight:600, color:cfg.color, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{slide.label}</div>
      {cfg.sub && <div style={{ fontSize:10, color:cfg.color, opacity:0.8 }}>{cfg.sub}</div>}
    </div>
    <div style={{ width:7, height:7, borderRadius:"50%", background:cfg.border, flexShrink:0 }} />
  </div>);
}

export default function App() {
  const [screen, setScreen] = useState("intro");
  const [authed, setAuthed] = useState(!!localStorage.getItem("pm_token"));
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [slides, setSlides] = useState([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [statuses, setStatuses] = useState({});
  const [collected, setCollected] = useState({});
  const [building, setBuilding] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [docContext, setDocContext] = useState("");
  const [focusType, setFocusType] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const bottom = useRef(); const fileInput = useRef();
  const collectedRef = useRef({}); const proposingRef = useRef(false);
  const screenRef = useRef("intro"); const slideIdxRef = useRef(0);
  const slidesRef = useRef([]); const focusTypeRef = useRef("");
  const pendingStructRef = useRef(null); const pendingSlideRef = useRef(null);
  const docContextRef = useRef("");

  useEffect(() => { bottom.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, busy]);

  // KRIITTINEN: Synkronoi ref JA state samaan aikaan
  function setScreenSync(v) { setScreen(v); screenRef.current = v; console.log("🔄 screen →", v); }
  function setSlideIdxSync(v) { setSlideIdx(v); slideIdxRef.current = v; }

  const history = useCallback(() =>
    msgs.filter(m => m.role==="user"||m.role==="assistant").map(m => ({role:m.role,content:m.content})), [msgs]);
  const addMsg = useCallback((role, content) => setMsgs(p => [...p, {role, content}]), []);
  const addDivider = useCallback((text) => setMsgs(p => [...p, {type:"divider", content:text}]), []);

  const phaseSystem = useCallback(() => {
    const ctx = docContextRef.current; const focus = focusTypeRef.current;
    let extra = PHASE_PROMPTS[screenRef.current] || "";
    if (ctx) extra += "\n\nLÄHDEMATERIAALIT:\n" + ctx;
    if (focus) extra += "\n\nFOKUS: " + focus;
    return extra;
  }, []);

  // ═══ VAIHE 1: HAASTATTELU ═══
  function startInterview() {
    setScreenSync("interview");
    setMsgs([
      {type:"divider",content:"💬 Vaihe 1 — Haastattelu"},
      {role:"assistant",content:"Hei! Olen Goforen projektisuunnitelma-agentti.\n\nKerro projektistasi — mitä tehdään, milloin, kenen kanssa ja mitkä ovat tärkeimmät haasteet. Voit liittää dokumentteja 📎-napista.\n\n5 vaihetta:\n1️⃣ Projektitiedot  2️⃣ Fokus  3️⃣ Havainnot  4️⃣ Rakenne  5️⃣ Diat"},
    ]);
  }

  async function runInterview(userText, ctx) {
    const extra = ctx || docContextRef.current;
    const hist = [...history(), {role:"user",content:userText}];
    const r = await callAPI([...hist, {role:"user",content:
      `[JÄRJESTELMÄOHJE] Arvioi riittävätkö projektitiedot (tavoite+aikataulu+osapuolet).
Jos EI: kysy YKSI puuttuva tieto. Jos KYLLÄ: vastaa lyhyesti + ##READY_TO_PLAN##`}],
      PHASE_PROMPTS.interview + (extra ? "\n\nLÄHDEMATERIAALIT:\n"+extra : ""));
    addMsg("assistant", strip(r));
    if (r.includes("##READY_TO_PLAN##")) {
      await runFocusAsk([...hist, {role:"assistant",content:strip(r)}]);
    }
  }

  // ═══ VAIHE 2: FOKUS ═══
  async function runFocusAsk(hist) {
    setScreenSync("focus");
    addDivider("🎯 Vaihe 2 — Esityksen fokus");
    const r = await callAPI([...(hist||history()), {role:"user",content:
      `[JÄRJESTELMÄOHJE] Kerro 1 lauseella projektin tilanteesta ja kysy:
"Mihin tarkoitukseen tämä esitys tehdään?"
1. 📋 Yleinen projektisuunnitelma  2. ⚠️ Riskianalyysi  3. 📅 Aikataulukatsaus
4. 🚀 Kickoff-materiaali  5. 👥 Sidosryhmäraportti  6. 🔍 Muu
Odota vastaus.`}],
      PHASE_PROMPTS.focus + (docContextRef.current ? "\n\nLÄHDEMATERIAALIT:\n"+docContextRef.current : ""));
    addMsg("assistant", strip(r));
  }

  async function runFocusConfirm(userText) {
    const focus = userText.trim();
    setFocusType(focus); focusTypeRef.current = focus;
    setScreenSync("insights");
    addDivider("🔍 Vaihe 3 — Tärkeimmät havainnot");
    const hist = [...history(), {role:"user",content:userText}];
    const r = await callAPI([...hist, {role:"user",content:
      `[JÄRJESTELMÄOHJE] Käyttäjä valitsi fokukseksi: "${focus}"
1. Vahvista 1 lauseella  2. Listaa 4-6 havaintoa tämän fokuksen näkökulmasta
3. Kysy: "Oletko samaa mieltä? Voit lisätä, poistaa tai muuttaa."
ÄLÄ ehdota diarakennetta.`}], phaseSystem());
    addMsg("assistant", strip(r));
  }

  // ═══ VAIHE 3: HAVAINNOT ═══
  async function runInsightsConfirm(userText) {
    if (isShortYes(userText)) {
      addMsg("assistant", "Hienoa! Siirrytään rakentamaan diarakenne.");
      const hist = [...history(), {role:"user",content:userText}, {role:"assistant",content:"Hienoa! Siirrytään rakentamaan diarakenne."}];
      await runStructureAsk(hist);
      return;
    }
    const hist = [...history(), {role:"user",content:userText}];
    const r = await callAPI([...hist, {role:"user",content:
      `[JÄRJESTELMÄOHJE] Käyttäjä haluaa muuttaa havaintolistaa. Päivitä lista, näytä, kysy hyväksyntä.`}], phaseSystem());
    addMsg("assistant", strip(r));
  }

  // ═══ VAIHE 4: RAKENNE ═══
  async function runStructureAsk(hist) {
    setScreenSync("structure");
    addDivider("📐 Vaihe 4 — Diarakenne");
    const r = await callAPI([...(hist||history()), {role:"user",content:
      `[JÄRJESTELMÄOHJE] Fokus: "${focusTypeRef.current}"
Ehdota diarakenne (1 dia/rivi, numeroidut). Layoutit: title, bullets, table, gantt, cards, two-col
Kysy: "Hyväksytkö vai muutoksia?"
TÄRKEÄ — tallenna rakenne AINA näin:
[STRUCTURE_DATA][{"id":"kansi","label":"Kansi","icon":"🎯","layout":"title"},{"id":"toinen","label":"Toinen","icon":"📋","layout":"bullets"}][/STRUCTURE_DATA]
Joka dialla: id (pieniä_kirjaimia), label, icon, layout.`}], phaseSystem());
    const structure = extractTag(r, "STRUCTURE_DATA");
    if (structure && Array.isArray(structure) && structure.length > 0) {
      pendingStructRef.current = structure;
      console.log("✅ Rakenne:", structure.length, "diaa");
    } else {
      console.warn("⚠️ STRUCTURE_DATA puuttui, yritetään fallback");
      const fb = tryParseStructure(r);
      if (fb) { pendingStructRef.current = fb; console.log("✅ Fallback rakenne:", fb.length, "diaa"); }
    }
    addMsg("assistant", strip(r));
  }

  function tryParseStructure(text) {
    const lines = text.split("\n").filter(l => /^\d+\.\s/.test(l.trim()));
    if (!lines.length) return null;
    const kw = { kansi:"title", otsikko:"title", aikataulu:"gantt", gantt:"gantt",
      taulukko:"table", riski:"cards", kortti:"cards" };
    return lines.map((line, i) => {
      const iconM = line.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
      const icon = iconM ? iconM[1] : "📄";
      const labelM = line.match(/\d+\.\s*(?:\S+\s+)?(?:\*{0,2})([\wÀ-ÿ\s-]+?)(?:\*{0,2})\s*[—–-]/);
      const label = labelM ? labelM[1].trim() : "Dia " + (i+1);
      const id = label.toLowerCase().replace(/[^a-zäöå0-9]/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"") || "dia_"+(i+1);
      let layout = "bullets";
      for (const [k,v] of Object.entries(kw)) { if (line.toLowerCase().includes(k)) { layout=v; break; } }
      if (i===0 && /kansi|cover/i.test(line)) layout="title";
      return { id, label, icon, layout };
    });
  }

  // ═══ VAIHE 4b: RAKENNE — VAHVISTUS ═══
  // KRIITTINEN FIX: "joo" + tallennettu rakenne = siirry heti, ei AI-kutsua
  async function runStructureConfirm(userText) {
    const hasStruct = pendingStructRef.current && Array.isArray(pendingStructRef.current) && pendingStructRef.current.length > 0;

    if (isShortYes(userText) && hasStruct) {
      const confirmed = pendingStructRef.current;
      addMsg("assistant", "Rakenne vahvistettu! Aloitetaan diojen sisällöntuotanto.");
      setSlides(confirmed); slidesRef.current = confirmed;
      setStatuses(Object.fromEntries(confirmed.map(s => [s.id, "pending"])));
      setScreenSync("planning");
      setSlideIdxSync(0);
      addDivider("📄 Vaihe 5 — Diojen sisällöntuotanto");
      const hist = [...history(), {role:"user",content:userText}, {role:"assistant",content:"Rakenne vahvistettu! Aloitetaan diojen sisällöntuotanto."}];
      await proposeSlide(0, hist, confirmed);
      return;
    }
    if (isShortYes(userText) && !hasStruct) {
      addMsg("assistant", "Rakennetta ei saatu tallennettua. Generoidaan uudelleen...");
      await runStructureAsk(history());
      return;
    }
    // Muutoksia → AI
    const hist = [...history(), {role:"user",content:userText}];
    const r = await callAPI([...hist, {role:"user",content:
      `[JÄRJESTELMÄOHJE] Käyttäjä haluaa muuttaa rakennetta: "${userText}"
Tee muutokset, näytä uusi rakenne, kysy hyväksyntä.
Tallenna: [STRUCTURE_DATA][...JSON...][/STRUCTURE_DATA]`}], phaseSystem());
    const structure = extractTag(r, "STRUCTURE_DATA");
    if (structure && Array.isArray(structure) && structure.length > 0) pendingStructRef.current = structure;
    else { const fb = tryParseStructure(r); if (fb) pendingStructRef.current = fb; }
    addMsg("assistant", strip(r));
  }

  // ═══ VAIHE 5: DIOJEN SISÄLTÖ ═══
  async function proposeSlide(idx, hist, slidesArr) {
    if (proposingRef.current) return;
    proposingRef.current = true;
    try {
      const cur = slidesArr || slidesRef.current;
      setSlideIdxSync(idx);
      setStatuses(prev => {
        const n = {...prev};
        cur.forEach((s,i) => { if (i===idx) n[s.id]="proposing"; else if (n[s.id]!=="done") n[s.id]="pending"; });
        return n;
      });
      const slide = cur[idx];
      const schema = SLIDE_SCHEMAS[slide.layout] || '{"heading":"...","content":"..."}';
      const r = await callAPI([...(hist||history()), {role:"user",content:
        `[DIA ${idx+1}/${cur.length} — ${slide.label}]
Layout: ${LAYOUT_DESC[slide.layout] || "vapaa"}
Ehdota sisältö tälle dialle. Kysy: "Hyväksytkö vai muutoksia?"
TÄRKEÄ: Tallenna data AINA:
[SLIDE_DATA:${slide.id}]${schema}[/SLIDE_DATA]
Täytä schema projektin tiedoilla. Vain tämä dia.`}], phaseSystem());
      const extracted = extractSlideData(r);
      pendingSlideRef.current = extracted[slide.id] || null;
      if (pendingSlideRef.current) console.log("✅ Dia-data:", slide.id);
      else console.warn("⚠️ Dia-data puuttui:", slide.id);
      addDivider("📄 Dia "+(idx+1)+"/"+cur.length+" — "+(slide.icon||"")+" "+slide.label);
      addMsg("assistant", strip(r));
      setStatuses(prev => ({...prev, [slide.id]: "confirming"}));
    } finally { proposingRef.current = false; }
  }

  // ═══ VAIHE 5b: DIA VAHVISTUS ═══
  // KRIITTINEN FIX: "joo" + pending data = tallenna ja siirry, ei AI-kutsua
  async function runPlanning(userText) {
    const cur = slidesRef.current;
    const idx = slideIdxRef.current;
    const slide = cur[idx];
    const isLast = idx === cur.length - 1;

    if (isShortYes(userText)) {
      let slideData = pendingSlideRef.current;
      if (!slideData) {
        addMsg("assistant", "Tallennetaan...");
        slideData = await genSlideData(slide);
      }
      if (slideData) {
        const nc = {...collectedRef.current, [slide.id]: slideData};
        collectedRef.current = nc; setCollected(nc);
      }
      pendingSlideRef.current = null;
      setStatuses(prev => ({...prev, [slide.id]: "done"}));
      const next = idx + 1;
      if (!isLast && next < cur.length) {
        setSlideIdxSync(next);
        addMsg("assistant", "✓ "+slide.label+" tallennettu. Siirrytään seuraavaan diaan.");
        const hist = [...history(), {role:"user",content:userText}, {role:"assistant",content:"✓ "+slide.label+" tallennettu."}];
        setTimeout(() => proposeSlide(next, hist, cur), 300);
      } else {
        finishAndDownload(cur);
      }
      return;
    }
    // Muutoksia
    const schema = SLIDE_SCHEMAS[slide.layout] || '{"heading":"..."}';
    const hist = [...history(), {role:"user",content:userText}];
    const r = await callAPI([...hist, {role:"user",content:
      `[DIA ${idx+1}/${cur.length} — ${slide.label} — MUOKKAUS]
Käyttäjä haluaa muutoksia: "${userText}"
Muokkaa, näytä uusi versio, kysy hyväksyntä.
Tallenna: [SLIDE_DATA:${slide.id}]${schema}[/SLIDE_DATA]`}], phaseSystem());
    const extracted = extractSlideData(r);
    if (extracted[slide.id]) pendingSlideRef.current = extracted[slide.id];
    addMsg("assistant", strip(r));
  }

  async function genSlideData(slide) {
    const schema = SLIDE_SCHEMAS[slide.layout] || '{"heading":"..."}';
    try {
      const r = await callAPI([...history(), {role:"user",content:
        `[JÄRJESTELMÄOHJE] Generoi dialle "${slide.label}" (layout: ${slide.layout}) JSON:
${schema}
Vastaa VAIN JSON-objektilla. Ei selityksiä.`}], phaseSystem());
      const m = r.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch(e) { console.error("genSlideData:", e); }
    return null;
  }

  function finishAndDownload(slidesArr) {
    setScreenSync("ready");
    setMsgs(p => [...p,
      {type:"divider",content:"✅ Kaikki diat valmiit"},
      {role:"assistant",content:"Esitys on valmis! PowerPoint-lataus käynnistyy automaattisesti."},
      {type:"download"},
    ]);
    setTimeout(() => downloadPPTX(slidesArr), 800);
  }

  async function downloadPPTX(slidesArr) {
    setBuilding(true);
    try {
      const r = await fetch(API+"/api/build-pptx", {
        method:"POST", headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},
        body: JSON.stringify({ slideData:collectedRef.current, slideStructure:slidesArr||slidesRef.current }),
      });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error||"HTTP "+r.status); }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {href:url, download:"projektisuunnitelma.pptx"}).click();
      URL.revokeObjectURL(url);
    } catch(e) { alert("Virhe: "+e.message); }
    setBuilding(false);
  }

  async function readFile(f) {
    if (f.name.match(/\.(txt|md|csv|json)$/i)) {
      const t = await f.text().catch(()=>"");
      return {name:f.name, content:"["+f.name+"]\n"+t.substring(0,5000)};
    }
    const mimeMap = {pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",gif:"image/gif",webp:"image/webp"};
    const ext = f.name.split(".").pop().toLowerCase();
    const mimeType = mimeMap[ext];
    if (mimeType) {
      try {
        const buf = await f.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i=0; i<bytes.length; i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
        const base64 = btoa(binary);
        const r = await fetch(API+"/api/extract-file", {
          method:"POST", headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},
          body: JSON.stringify({base64, mimeType, fileName:f.name}),
        });
        const d = await r.json();
        return {name:f.name, content:"["+f.name+(d.text?" — sisältö:]\n"+d.text:": "+(d.error||"luku epäonnistui")+"]")};
      } catch(e) { return {name:f.name, content:"["+f.name+": virhe — "+e.message+"]"}; }
    }
    return {name:f.name, content:"["+f.name+" — tiedostotyyppiä ei tueta]"};
  }

  async function addFiles(fileList) {
    const read = await Promise.all(Array.from(fileList).map(readFile));
    setAttachments(p => [...p, ...read]);
  }

  async function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    const files = [];
    if (e.dataTransfer.items) {
      for (const item of Array.from(e.dataTransfer.items)) {
        if (item.kind!=="file") continue;
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          await new Promise(res => entry.createReader().readEntries(async entries => {
            for (const en of entries) if (en.isFile) await new Promise(r => en.file(f => {files.push(f);r();}));
            res();
          }));
        } else { const f=item.getAsFile(); if(f) files.push(f); }
      }
    } else files.push(...Array.from(e.dataTransfer.files));
    if (files.length) await addFiles(files);
  }

  async function doSend() {
    const text = input.trim(); const files = attachments;
    if (!text && !files.length) return; if (busy) return;
    let display=text, apiText=text, newCtx=docContext;
    if (files.length > 0) {
      const names=files.map(f=>f.name).join(", ");
      const bodies=files.map(f=>f.content).join("\n\n---\n\n");
      display = (text?text+"\n\n":"")+"📎 "+names;
      apiText = (text?text+"\n\n":"Tässä on projektimateriaali:\n\n")+bodies;
      newCtx = (docContext?docContext+"\n\n---\n\n":"LÄHDEMATERIAALIT:\n\n")+bodies;
      setDocContext(newCtx); docContextRef.current=newCtx;
    }
    setInput(""); setAttachments([]);
    setMsgs(p => [...p, {role:"user",content:display}]);
    setBusy(true);
    try {
      const s = screenRef.current;
      console.log("📤 doSend screen="+s+" text="+text.substring(0,30));
      if (s==="interview") await runInterview(apiText, newCtx);
      else if (s==="focus") await runFocusConfirm(apiText);
      else if (s==="insights") await runInsightsConfirm(apiText);
      else if (s==="structure") await runStructureConfirm(apiText);
      else if (s==="planning") await runPlanning(apiText);
    } catch(e) { console.error("❌",e); addMsg("assistant","⚠️ Virhe: "+e.message); }
    setBusy(false);
  }

  async function doLogin() {
    if (!pwInput) return;
    try {
      const r = await fetch(API+"/api/login", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pwInput})});
      const d = await r.json();
      if (d.token) { localStorage.setItem("pm_token",d.token); setAuthed(true); }
      else setPwError(true);
    } catch { setPwError(true); }
  }

  const canSend = !busy && (input.trim().length>0 || attachments.length>0);
  const doneCount = Object.values(statuses).filter(s=>s==="done").length;
  const showSidebar = slides.length>0 && (screen==="planning"||screen==="ready");
  const currentSlide = slides[slideIdx];

  if (!authed) return (
    <div style={{minHeight:"100vh",background:G.deepBlue,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{textAlign:"center",width:320}}>
        <div style={{width:60,height:60,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:G.white,fontWeight:700,margin:"0 auto 20px"}}>G</div>
        <h2 style={{color:G.white,marginBottom:8}}>Projektisuunnitelma-agentti</h2>
        <p style={{color:G.grey,fontSize:13,marginBottom:24}}>Syötä salasana</p>
        <input type="password" value={pwInput} onChange={e=>{setPwInput(e.target.value);setPwError(false);}} onKeyDown={e=>{if(e.key==="Enter")doLogin();}} placeholder="Salasana"
          style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid "+(pwError?G.orange:G.grey),background:"rgba(255,255,255,0.08)",color:G.white,fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:8}} />
        {pwError && <div style={{color:G.orange,fontSize:13,marginBottom:8}}>Väärä salasana</div>}
        <button onClick={doLogin} style={{width:"100%",background:G.orange,color:G.white,border:"none",borderRadius:10,padding:"12px 0",fontSize:15,fontWeight:700,cursor:"pointer"}}>Kirjaudu →</button>
      </div>
    </div>
  );

  if (screen==="intro") return (
    <div style={{minHeight:"100vh",background:G.deepBlue,display:"flex",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{maxWidth:480,width:"100%",textAlign:"center"}}>
        <div style={{width:68,height:68,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,color:G.white,fontWeight:700,margin:"0 auto 24px"}}>G</div>
        <h1 style={{color:G.white,fontSize:24,fontWeight:700,margin:"0 0 8px"}}>Projektisuunnitelma-agentti</h1>
        <p style={{color:G.codeBlue,fontSize:14,lineHeight:1.7,margin:"0 0 32px"}}>Rakennetaan projektisuunnitelmasi yhdessä, dia kerrallaan.</p>
        <div style={{background:"rgba(255,255,255,0.05)",borderRadius:14,padding:20,marginBottom:32,textAlign:"left"}}>
          {[["💬","Haastattelu","Kerro projektistasi"],["🔍","Oivallukset","Tunnistan riskit ja ehdotan rakennetta"],["🤝","Dia kerrallaan","Ehdotan sisällön, sinä vahvistat"],["📊","Valmis PPTX","Gofore-teemainen tiedosto"]].map(([i,t,d])=>
            <div key={t} style={{display:"flex",gap:12,marginBottom:14}}><span style={{fontSize:18}}>{i}</span><div><div style={{color:G.white,fontWeight:600,fontSize:13}}>{t}</div><div style={{color:G.grey,fontSize:12}}>{d}</div></div></div>
          )}
        </div>
        <button onClick={startInterview} style={{width:"100%",background:G.orange,color:G.white,border:"none",borderRadius:12,padding:"14px 0",fontSize:16,fontWeight:700,cursor:"pointer"}}>Aloita haastattelu →</button>
        <button onClick={async()=>{
          try{const td={slideData:{cover:{title:"Testi",tagline:"OK",meta:"2025",projectLead:"T"}},slideStructure:[{id:"cover",label:"Kansi",icon:"🎯",layout:"title"}]};
          const r=await fetch(API+"/api/build-pptx",{method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},body:JSON.stringify(td)});
          if(!r.ok){alert("Virhe");return;}const b=await r.blob();const u=URL.createObjectURL(b);Object.assign(document.createElement("a"),{href:u,download:"testi.pptx"}).click();URL.revokeObjectURL(u);}catch(e){alert(e.message);}
        }} style={{width:"100%",marginTop:8,background:"transparent",color:G.codeBlue,border:"1px solid "+G.codeBlue,borderRadius:12,padding:"10px 0",fontSize:13,cursor:"pointer"}}>🧪 Testaa PPTX</button>
      </div>
    </div>
  );

  return (
    <div style={{height:"100vh",display:"flex",fontFamily:"'Segoe UI',sans-serif",background:G.bg,overflow:"hidden"}}>
      {showSidebar && (
        <div style={{width:200,background:G.white,borderRight:"1px solid "+G.silver,padding:"14px 12px",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
          <div style={{color:G.grey,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Diat {doneCount}/{slides.length}</div>
          {slides.map(s => <Pill key={s.id} slide={s} status={statuses[s.id]||"pending"} />)}
          {(screen==="ready"||doneCount===slides.length) && (
            <button onClick={()=>downloadPPTX()} disabled={building}
              style={{background:building?G.grey:G.orange,color:G.white,border:"none",borderRadius:10,padding:"12px 0",fontSize:13,fontWeight:700,cursor:building?"not-allowed":"pointer",marginTop:16}}>
              {building?"⏳ Rakennetaan...":"🚀 Lataa PPTX"}
            </button>
          )}
        </div>
      )}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:G.deepBlue,padding:"8px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:28,height:28,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:G.white,fontWeight:700,fontSize:12}}>G</div>
          <div>
            <div style={{color:G.white,fontWeight:600,fontSize:13}}>Projektisuunnitelma-agentti</div>
            <div style={{color:G.codeBlue,fontSize:11}}>
              {screen==="interview"?"💬 Vaihe 1 — Haastattelu"
               :screen==="focus"?"🎯 Vaihe 2 — Fokus"
               :screen==="insights"?"🔍 Vaihe 3 — Havainnot"+(focusType?": "+focusType:"")
               :screen==="structure"?"📐 Vaihe 4 — Diarakenne"
               :screen==="planning"&&slides.length>0?"📄 Vaihe 5 — Dia "+(slideIdx+1)+"/"+slides.length+(currentSlide?" — "+(currentSlide.icon||"")+" "+currentSlide.label:"")
               :screen==="ready"?"✅ Valmis":""}
            </div>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"20px 16px",position:"relative"}}
          onDragOver={e=>{e.preventDefault();setDragOver(true);}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOver(false);}}
          onDrop={onDrop}>
          {dragOver && <div style={{position:"absolute",inset:0,background:"rgba(27,108,168,0.1)",border:"2px dashed "+G.digitalBlue,borderRadius:8,zIndex:10,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
            <div style={{background:G.white,borderRadius:12,padding:"24px 40px",textAlign:"center"}}><div style={{fontSize:36,marginBottom:8}}>📂</div><div style={{color:G.digitalBlue,fontWeight:600}}>Pudota tiedostot tähän</div></div>
          </div>}
          {msgs.map((m,i) => {
            if (m.type==="divider") return <Divider key={i} text={m.content} />;
            if (m.type==="download") return (
              <div key={i} style={{display:"flex",justifyContent:"center",margin:"12px 0"}}>
                <button onClick={()=>downloadPPTX()} disabled={building}
                  style={{background:building?G.grey:G.orange,color:G.white,border:"none",borderRadius:12,padding:"14px 32px",fontSize:15,fontWeight:700,cursor:building?"not-allowed":"pointer",boxShadow:"0 2px 8px rgba(232,82,26,0.3)"}}>
                  {building?"⏳ Rakennetaan...":"🚀 Lataa PowerPoint"}
                </button>
              </div>
            );
            return <Bubble key={i} role={m.role} content={m.content} />;
          })}
          {busy && <div style={{display:"flex",gap:10}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:G.deepBlue,color:G.orange,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12}}>G</div>
            <div style={{background:G.white,borderRadius:"3px 14px 14px 14px",padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}><span style={{color:G.grey,letterSpacing:6,fontSize:16}}>● ● ●</span></div>
          </div>}
          <div ref={bottom} />
        </div>
        {attachments.length>0 && <div style={{background:G.white,borderTop:"1px solid "+G.silver,padding:"8px 16px",display:"flex",flexWrap:"wrap",gap:6}}>
          {attachments.map((a,i)=><div key={i} style={{background:G.light,border:"1px solid "+G.silver,borderRadius:6,padding:"3px 10px",fontSize:12,color:G.deepBlue,display:"flex",alignItems:"center",gap:6}}>📄 {a.name}<span style={{cursor:"pointer",color:G.grey,fontSize:14}} onClick={()=>setAttachments(p=>p.filter((_,j)=>j!==i))}>×</span></div>)}
        </div>}
        <div style={{background:G.white,borderTop:"1px solid "+G.silver,padding:"12px 16px",flexShrink:0}}>
          <div style={{display:"flex",gap:8,alignItems:"flex-end",maxWidth:900,margin:"0 auto"}}>
            <button title="Liitä" onClick={()=>fileInput.current?.click()} style={{width:36,height:36,flexShrink:0,alignSelf:"flex-end",background:"transparent",border:"1.5px dashed "+G.silver,borderRadius:9,cursor:"pointer",fontSize:16,color:G.grey}}>📎</button>
            <input ref={fileInput} type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg" style={{display:"none"}} onChange={e=>{if(e.target.files?.length)addFiles(e.target.files);e.target.value="";}} />
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();doSend();}}}
              placeholder={screen==="interview"?"Kerro projektistasi...":screen==="focus"?"Valitse fokus (1-6)...":screen==="insights"?"Vahvista tai muokkaa...":screen==="structure"?"Hyväksy tai muokkaa...":"Kommentoi tai hyväksy..."}
              style={{flex:1,background:G.light,outline:"none",resize:"vertical",border:"1.5px solid "+(input.length>0?G.digitalBlue:G.silver),borderRadius:11,padding:"10px 14px",fontSize:14,fontFamily:"inherit",lineHeight:1.6,color:G.deepBlue,minHeight:80,maxHeight:220}} />
            <button onClick={doSend} disabled={!canSend}
              style={{width:38,height:38,flexShrink:0,alignSelf:"flex-end",background:canSend?G.orange:G.silver,color:G.white,border:"none",borderRadius:"50%",fontSize:18,cursor:canSend?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s"}}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}