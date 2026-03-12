import { useState, useRef, useEffect } from "react";

const API = "https://pm-agent-avpl.onrender.com";

const G = {
  deepBlue: "#0C2340", digitalBlue: "#1B6CA8", codeBlue: "#5BA4CF",
  orange: "#E8521A", mint: "#3BBFAD", white: "#FFFFFF",
  grey: "#8C9BAA", silver: "#D3D9DF", light: "#EEF1F3", bg: "#F4F6F9",
};

const SLIDES = [
  { id: "cover",        label: "Kansi",                  icon: "🎯" },
  { id: "summary",      label: "Yhteenveto",              icon: "📊" },
  { id: "dependencies", label: "Kriittiset riippuvuudet", icon: "🔗" },
  { id: "gantt",        label: "Gantt-aikataulu",         icon: "📅" },
  { id: "roles",        label: "Roolit & vastuut",        icon: "👥" },
  { id: "risks",        label: "Riskirekisteri",          icon: "⚠️" },
  { id: "nextsteps",    label: "Seuraavat askeleet",      icon: "🚀" },
];

const SYSTEM = `Olet kokenut projektikonsultti Goforella. Kommunikoi AINA suomeksi.

KRIITTISET SÄÄNNÖT:
1. ÄLÄ KOSKAAN keksi tai oleta projektitietoja joita ei ole annettu
2. Jos lähdemateriaaleja on annettu, LUE NE TARKASTI ja käytä VAIN niissä olevia tietoja
3. Merkitse arviot selkeästi: (arvio) - vain kun käyttäjä on pyytänyt arviota
4. Jos jokin tieto puuttuu, KYSY se käyttäjältä - älä keksi
5. Ole ytimekäs ja käytännönläheinen
6. Kysy aina vahvistus ennen kuin siirryt eteenpäin`;

const PROPOSE = {
  cover: 'Ehdota kansidian sisaeltoe: projektin nimi, tagline (1 lause projektin ydinarvosta) ja meta (osapuolet, aikataulu). Kysy lopuksi: "Hyvaeksytkoe taemaen, vai muutettavaa?"',
  summary: 'Ehdota yhteenveto-dian sisaeltoe: 4 avainlukua ja tyoevaiheet. Merkitse kriittinen polku. Kysy: "Onko vaiheistus oikein?"',
  dependencies: 'Ehdota kriittiset riippuvuudet -dian sisaeltoe. Tunnista mitkaer ehdot TAEYTYYAE taeyttyae ennen etenemistae. Kysy: "Ovatko naemae ehdot oikein?"',
  gantt: 'Ehdota Gantt-aikataulu. Arvioi realistinen kesto, tunnista kriittinen polku. Kysy: "Onko aikataulu realistinen?"',
  roles: 'Ehdota roolit ja vastuut projektikohtaisesti. Kysy: "Ovatko roolit oikein?"',
  risks: 'Ehdota riskirekisteri. Arvioi tod.(1-5) x vaik.(1-5). KORKEA>=12, KESKI 6-11, MATALA<=5. Kysy: "Ovatko luokitukset oikein?"',
  nextsteps: 'Ehdota seuraavat askeleet prioriteettijaerjestykseessae. Merkitse kriittisimmaet. Kysy: "Ovatko prioriteetit oikeassa jaerjestykseessae?"',
};

const CONFIRM = {
  cover: 'Kaeisittele palaute kansidiaan. Kun hyvaeksytty, sano "Kansi sovittu." ja tallenna: [SLIDE_DATA:cover]{"title":"...","tagline":"...","meta":"...","projectLead":"..."}[/SLIDE_DATA]',
  summary: 'Kaeisittele palaute. Kun hyvaeksytty, sano "Yhteenveto sovittu." ja tallenna: [SLIDE_DATA:summary]{"keyFacts":["..."],"phases":["..."],"criticalPhases":["..."]}[/SLIDE_DATA]',
  dependencies: 'Kaeisittele palaute. Kun hyvaeksytty, sano "Kriittiset riippuvuudet sovittu." ja tallenna: [SLIDE_DATA:dependencies]{"conditions":[{"title":"...","desc":"...","critical":true}]}[/SLIDE_DATA]',
  gantt: 'Kaeisittele palaute. Kun hyvaeksytty, sano "Gantt sovittu." ja tallenna: [SLIDE_DATA:gantt]{"totalWeeks":9,"frozenWeek":7,"phases":[{"name":"...","start":1,"end":2,"critical":false}]}[/SLIDE_DATA]',
  roles: 'Kaeisittele palaute. Kun hyvaeksytty, sano "Roolit sovittu." ja tallenna: [SLIDE_DATA:roles]{"roles":[{"title":"...","org":"...","color":"orange","responsibilities":["..."]}]}[/SLIDE_DATA]',
  risks: 'Kaeisittele palaute. Kun hyvaeksytty, sano "Riskirekisteri sovittu." ja tallenna: [SLIDE_DATA:risks]{"risks":[{"desc":"...","prob":3,"impact":4,"level":"KORKEA","owner":"...","mitigation":"..."}]}[/SLIDE_DATA]',
  nextsteps: 'Kaeisittele palaute. Kun hyvaeksytty, sano "Seuraavat askeleet sovittu." ja lisaae ##ALL_SLIDES_DONE##. Tallenna: [SLIDE_DATA:nextsteps]{"steps":[{"action":"...","detail":"...","owner":"...","timing":"...","critical":true}]}[/SLIDE_DATA]',
};

async function callAPI(messages, extraSystem) {
  const system = extraSystem ? SYSTEM + "\n\n" + extraSystem : SYSTEM;
  const r = await fetch(API + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d.text;
}

function extractData(text) {
  const out = {};
  const re = /\[SLIDE_DATA:(\w+)\]([\s\S]*?)\[\/SLIDE_DATA\]/g;
  let m;
  while ((m = re.exec(text))) {
    try { out[m[1]] = JSON.parse(m[2].trim()); } catch {}
  }
  return out;
}

function strip(text) {
  return text.replace(/\[SLIDE_DATA:\w+\][\s\S]*?\[\/SLIDE_DATA\]/g, "")
             .replace("##ALL_SLIDES_DONE##", "").trim();
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
    done:       { bg: "#E8FAF7", border: G.mint,        color: G.mint,        sub: "Sovittu" },
  }[status] || { bg: G.light, border: G.silver, color: G.grey, sub: "" };
  return (
    <div style={{ background: cfg.bg, border: "1.5px solid " + cfg.border, borderRadius: 10, padding: "8px 12px", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 15 }}>{slide.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: cfg.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slide.label}</div>
        {cfg.sub && <div style={{ fontSize: 10, color: cfg.color, opacity: 0.75 }}>{cfg.sub}</div>}
      </div>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.border, flexShrink: 0 }} />
    </div>
  );
}

export default function App() {
  const [screen, setScreen]         = useState("intro");
  const [msgs, setMsgs]             = useState([]);       // {role, content} | {type:"divider", content}
  const [input, setInput]           = useState("");
  const [busy, setBusy]             = useState(false);
  const [slideIdx, setSlideIdx]     = useState(0);
  const [statuses, setStatuses]     = useState(() => Object.fromEntries(SLIDES.map(s => [s.id, "pending"])));
  const [collected, setCollected]   = useState({});
  const [building, setBuilding]     = useState(false);
  const [attachments, setAttachments] = useState([]);  // [{name, content}]
  const [docContext, setDocContext]   = useState("");   // accumulated file contents for system prompt
  const [dragOver, setDragOver]     = useState(false);
  const bottom = useRef();
  const fileInput = useRef();

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const history = () =>
    msgs.filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content }));

  // ── Core send ─────────────────────────────────────────────────────
  async function doSend() {
    const text = input.trim();
    const files = attachments;
    if (!text && files.length === 0) return;
    if (busy) return;

    // Build display + api text
    let display = text;
    let apiText = text;
    let newDocContext = docContext;
    if (files.length > 0) {
      const names = files.map(f => f.name).join(", ");
      const bodies = files.map(f => f.content).join("\n\n---\n\n");
      display = (text ? text + "\n\n" : "") + "📎 " + names;
      // File content goes BOTH into the message AND docContext for future slides
      apiText = (text ? text + "\n\n" : "Tässä on projektimateriaali:\n\n") + bodies;
      newDocContext = (docContext ? docContext + "\n\n---\n\n" : "PROJEKTIN LÄHDEMATERIAALIT:\n\n") + bodies;
      setDocContext(newDocContext);
    }

    setInput("");
    setAttachments([]);
    setMsgs(prev => [...prev, { role: "user", content: display }]);
    setBusy(true);

    if (screen === "interview") await runInterview(apiText, newDocContext);
    else if (screen === "planning") await runPlanning(apiText, newDocContext);

    setBusy(false);
  }

  // ── Interview ─────────────────────────────────────────────────────
  async function startInterview() {
    setScreen("interview");
    // Fixed opening message - no AI call needed
    const openingMsg = `Hei! Olen Goforen projektisuunnitelma-agentti.

Kerro projektistasi omin sanoin — mitä on tarkoitus tehdä, milloin, kenen kanssa ja mitkä ovat tärkeimmät haasteet. Voit myös liittää projektidokumentteja 📎-napista.

Kun olet kertonut riittävästi, alan ehdottamaan diasissältöjä yhdessä kanssasi.`;
    setMsgs([{ role: "assistant", content: openingMsg }]);
  }

  async function runInterview(userText, ctx) {
    const hist = [...history(), { role: "user", content: userText }];
    const r = await callAPI([
      ...hist,
      { role: "user", content: "[META] Riittaako tieto projektisuunnitelmaan? Tarvitset: tavoite + aikataulu + osapuolet. Jos puuttuu, kysy yksi kysymys. Jos riittaa, vastaa ja lisaa riville: ##READY_TO_PLAN##" }
    ], ctx || docContext);
    if (r.includes("##READY_TO_PLAN##")) {
      const c = strip(r.replace("##READY_TO_PLAN##", ""));
      setMsgs(prev => [...prev,
        { role: "assistant", content: c },
        { type: "divider", content: "Haastattelu valmis — aloitetaan suunnittelu" }
      ]);
      setScreen("planning");
      const newHist = [...hist, { role: "assistant", content: c }];
      await proposeSlide(0, newHist);
    } else {
      setMsgs(prev => [...prev, { role: "assistant", content: strip(r) }]);
    }
    // Update docContext with any new file content passed in
    if (ctx && ctx !== docContext) setDocContext(ctx);
  }

  // ── Planning ──────────────────────────────────────────────────────
  async function proposeSlide(idx, hist) {
    const slide = SLIDES[idx];
    setStatuses(prev => {
      const n = { ...prev };
      SLIDES.forEach((s, i) => { if (i === idx) n[s.id] = "proposing"; else if (i > idx) n[s.id] = "pending"; });
      return n;
    });
    const prompt = "[DIA " + (idx+1) + "/" + SLIDES.length + " - " + slide.label + " - EHDOTA]\n\n" + PROPOSE[slide.id];
    const r = await callAPI([...(hist || history()), { role: "user", content: prompt }], docContext);
    setMsgs(prev => [...prev,
      { type: "divider", content: "Dia " + (idx+1) + "/" + SLIDES.length + " — " + slide.icon + " " + slide.label },
      { role: "assistant", content: strip(r) }
    ]);
    setSlideIdx(idx);
    setStatuses(prev => ({ ...prev, [slide.id]: "confirming" }));
  }

  async function runPlanning(userText, ctx) {
    const slide = SLIDES[slideIdx];
    const hist = [...history(), { role: "user", content: userText }];
    const prompt = "[DIA " + (slideIdx+1) + "/" + SLIDES.length + " - " + slide.label + " - VAHVISTA]\n\n" + CONFIRM[slide.id] + "\n\nKayttajan vastaus: \"" + userText + "\"";
    const r = await callAPI([...hist, { role: "user", content: prompt }], ctx || docContext);
    const extracted = extractData(r);
    if (Object.keys(extracted).length) setCollected(prev => ({ ...prev, ...extracted }));
    const c = strip(r);
    setMsgs(prev => [...prev, { role: "assistant", content: c }]);
    if (r.includes("##ALL_SLIDES_DONE##")) {
      setStatuses(prev => ({ ...prev, [slide.id]: "done" }));
      setScreen("ready");
    } else if (c.includes("sovittu") && !c.includes("?")) {
      // Only advance if confirmed AND no question at end (AI isn't asking for more info)
      setStatuses(prev => ({ ...prev, [slide.id]: "done" }));
      const next = slideIdx + 1;
      if (next < SLIDES.length) setTimeout(() => proposeSlide(next), 600);
    }
  }

  // ── Files ─────────────────────────────────────────────────────────
  async function readFile(f) {
    // Plain text files — read directly
    if (f.name.match(/\.(txt|md|csv|json)$/i)) {
      const t = await f.text().catch(() => "");
      return { name: f.name, content: "[Tiedosto: " + f.name + "]\n" + t.substring(0, 5000) };
    }

    // PDF and images — send to backend which uses Claude API natively
    const mimeMap = {
      pdf: "application/pdf",
      jpg: "image/jpeg", jpeg: "image/jpeg",
      png: "image/png", gif: "image/gif", webp: "image/webp",
    };
    const ext = f.name.split(".").pop().toLowerCase();
    const mimeType = mimeMap[ext];

    if (mimeType) {
      try {
        // Convert to base64
        const buf = await f.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        const base64 = btoa(binary);

        const r = await fetch(API + "/api/extract-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mimeType, fileName: f.name }),
        });
        const d = await r.json();
        if (d.text) return { name: f.name, content: "[" + f.name + " — Claude luki:]\n" + d.text };
        return { name: f.name, content: "[" + f.name + ": " + (d.error || "luku epäonnistui") + "]" };
      } catch (e) {
        return { name: f.name, content: "[" + f.name + ": virhe — " + e.message + "]" };
      }
    }

    // Other files (docx, pptx, xlsx) — not supported yet
    return { name: f.name, content: "[" + f.name + " — tiedostotyyppiä ei tueta. Kopioi sisältö tekstinä.]" };
  }

  async function addFiles(fileList) {
    const arr = Array.from(fileList);
    const read = await Promise.all(arr.map(readFile));
    setAttachments(prev => [...prev, ...read]);
  }

  async function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
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
        } else {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
    } else files.push(...Array.from(e.dataTransfer.files));
    if (files.length) await addFiles(files);
  }

  // ── PPTX ─────────────────────────────────────────────────────────
  async function downloadPPTX() {
    setBuilding(true);
    try {
      const r = await fetch(API + "/api/build-pptx", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideData: collected }),
      });
      if (!r.ok) throw new Error("Virhe");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: "projektisuunnitelma.pptx" }).click();
      URL.revokeObjectURL(url);
    } catch (e) { alert("Virhe: " + e.message); }
    setBuilding(false);
  }

  const canSend = !busy && (input.trim().length > 0 || attachments.length > 0);
  const done = Object.values(statuses).filter(s => s === "done").length;

  // ── INTRO ─────────────────────────────────────────────────────────
  if (screen === "intro") return (
    <div style={{ minHeight: "100vh", background: G.deepBlue, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "'Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ width: 68, height: 68, background: G.orange, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: G.white, fontWeight: 700, margin: "0 auto 24px" }}>G</div>
        <h1 style={{ color: G.white, fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>Projektisuunnitelma-agentti</h1>
        <p style={{ color: G.codeBlue, fontSize: 14, lineHeight: 1.7, margin: "0 0 32px" }}>Rakennetaan projektisuunnitelmasi yhdessä, dia kerrallaan.<br/>Jokainen dia ehdotetaan — sinä vahvistat tai muutat.</p>
        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 20, marginBottom: 32, textAlign: "left" }}>
          {[["💬","Haastattelu","Kysyn perustiedot — voit myös liittää dokumentteja"],
            ["🤝","Dia kerrallaan","Ehdotan sisällön, sinä vahvistat"],
            ["⚙️","Oletukset näkyvissä","Merkitsen selkeästi mitä arvioin itse"],
            ["📊","Valmis PPTX","Gofore-pohjainen tiedosto ladattavaksi"]].map(([i,t,d]) => (
            <div key={t} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>{i}</span>
              <div><div style={{ color: G.white, fontWeight: 600, fontSize: 13 }}>{t}</div><div style={{ color: G.grey, fontSize: 12 }}>{d}</div></div>
            </div>
          ))}
        </div>
        <button onClick={startInterview} style={{ width: "100%", background: G.orange, color: G.white, border: "none", borderRadius: 12, padding: "14px 0", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
          Aloita haastattelu →
        </button>
      </div>
    </div>
  );

  // ── CHAT ──────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", display: "flex", fontFamily: "'Segoe UI',sans-serif", background: G.bg, overflow: "hidden" }}>

      {/* Sivupalkki */}
      {(screen === "planning" || screen === "ready") && (
        <div style={{ width: 196, background: G.white, borderRight: "1px solid " + G.silver, padding: "14px 12px", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
          <div style={{ color: G.grey, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Diat {done}/{SLIDES.length}
          </div>
          {SLIDES.map((s, i) => (
            <Pill key={s.id} slide={s} status={i <= slideIdx ? (statuses[s.id] || "pending") : "pending"} />
          ))}
          {screen === "ready" && (
            <button onClick={downloadPPTX} disabled={building}
              style={{ marginTop: "auto", paddingTop: 14, background: building ? G.grey : G.orange, color: G.white, border: "none", borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: building ? "not-allowed" : "pointer" }}>
              {building ? "⏳ Rakennetaan..." : "🚀 Lataa PPTX"}
            </button>
          )}
        </div>
      )}

      {/* Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: G.deepBlue, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, background: G.orange, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: G.white, fontWeight: 700, fontSize: 12 }}>G</div>
          <div>
            <div style={{ color: G.white, fontWeight: 600, fontSize: 13 }}>Projektisuunnitelma-agentti</div>
            <div style={{ color: G.codeBlue, fontSize: 11 }}>
              {screen === "interview" ? "📋 Haastattelu" :
               screen === "planning" ? SLIDES[slideIdx]?.icon + " " + SLIDES[slideIdx]?.label :
               "✅ Kaikki diat sovittu — paina Lataa PPTX"}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          style={{ flex: 1, overflowY: "auto", padding: "20px 16px", position: "relative" }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
          onDrop={onDrop}
        >
          {dragOver && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(27,108,168,0.1)", border: "2px dashed " + G.digitalBlue, borderRadius: 8, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ background: G.white, borderRadius: 12, padding: "24px 40px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                <div style={{ color: G.digitalBlue, fontWeight: 600 }}>Pudota tiedostot tai kansio tähän</div>
                <div style={{ color: G.grey, fontSize: 12, marginTop: 4 }}>pdf · docx · pptx · xlsx · txt · csv · json</div>
              </div>
            </div>
          )}
          {msgs.map((m, i) =>
            m.type === "divider"
              ? <Divider key={i} text={m.content} />
              : <Bubble key={i} role={m.role} content={m.content} />
          )}
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

        {/* Attachment tags */}
        {attachments.length > 0 && (
          <div style={{ background: G.white, borderTop: "1px solid " + G.silver, padding: "8px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {attachments.map((a, i) => (
              <div key={i} style={{ background: G.light, border: "1px solid " + G.silver, borderRadius: 6, padding: "3px 10px", fontSize: 12, color: G.deepBlue, display: "flex", alignItems: "center", gap: 6 }}>
                📄 {a.name}
                <span style={{ cursor: "pointer", color: G.grey, fontSize: 14, lineHeight: 1 }}
                  onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>×</span>
              </div>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div style={{ background: G.white, borderTop: "1px solid " + G.silver, padding: "12px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", maxWidth: 900, margin: "0 auto" }}>

            {/* File button */}
            <button title="Liitä tiedosto" onClick={() => fileInput.current?.click()}
              style={{ width: 36, height: 36, flexShrink: 0, alignSelf: "flex-end", background: "transparent", border: "1.5px dashed " + G.silver, borderRadius: 9, cursor: "pointer", fontSize: 16, color: G.grey }}>
              📎
            </button>
            <input ref={fileInput} type="file" multiple
              accept=".txt,.md,.csv,.json,.pdf,.docx,.pptx,.xlsx"
              style={{ display: "none" }}
              onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }}
            />

            {/* Textarea */}
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }}
              placeholder={screen === "interview" ? "Kerro projektistasi... (Enter lähettää · Shift+Enter = uusi rivi)" : "Kirjoita kommenttisi... (Enter lähettää · Shift+Enter = uusi rivi)"}
              style={{
                flex: 1, background: G.light, outline: "none", resize: "vertical",
                border: "1.5px solid " + (input.length > 0 ? G.digitalBlue : G.silver),
                borderRadius: 11, padding: "10px 14px", fontSize: 14,
                fontFamily: "inherit", lineHeight: 1.6, color: G.deepBlue,
                minHeight: 80, maxHeight: 220,
              }}
            />

            {/* Send button */}
            <button onClick={doSend} disabled={!canSend}
              style={{
                width: 38, height: 38, flexShrink: 0, alignSelf: "flex-end",
                background: canSend ? G.orange : G.silver,
                color: G.white, border: "none", borderRadius: "50%",
                fontSize: 18, cursor: canSend ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}