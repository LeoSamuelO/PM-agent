import { useState, useRef, useEffect, useCallback } from "react";

// ── Asetukset ──────────────────────────────────────────────────────
const API = "https://pm-agent-avpl.onrender.com";

const G = {
  deepBlue: "#0C2340", digitalBlue: "#1B6CA8", codeBlue: "#5BA4CF",
  orange: "#E8521A", mint: "#3BBFAD", white: "#FFFFFF",
  grey: "#8C9BAA", silver: "#D3D9DF", light: "#EEF1F3", bg: "#F4F6F9",
};

const TODAY = new Date().toLocaleDateString("fi-FI", {
  year: "numeric", month: "long", day: "numeric",
});

// ── System prompt – pysyy muuttumattomana koko session ajan ────────
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
7. Kysy aina käyttäjältä mielipide ja odota vastaus ennen kuin etenet.

TÄRKEÄÄ TAGEISTA:
- Kun sinua pyydetään tuottamaan dataa tietyssä [TAG]-formaatissa, tuota VAIN pyydetyt tagit.
- ÄLÄ KOSKAAN näytä tageja käyttäjälle selitetekstinä — ne ovat koneluettavaa dataa.
- Seliteteksti tulee tagien ULKOPUOLELLE, ei sisälle.`;

// ── Vaihekohtaiset systeemiohjeet (lisätään system promptiin) ───────
const PHASE_PROMPTS = {
  interview: `NYKYINEN VAIHE: Haastattelu
Tehtäväsi on kerätä projektitiedot. Kysy yksi asia kerrallaan.
Tarvitset vähintään: projektin tavoite, aikataulu, ja osapuolet.
Kun tiedot riittävät, lisää vastaukseesi: ##READY_TO_PLAN##
Mutta jos käyttäjä vielä selittää, ÄLÄ lisää tagia — odota luonnollinen pysähdyspaikka.`,

  focus: `NYKYINEN VAIHE: Esityksen fokus
Käyttäjä valitsee mihin tarkoitukseen esitys tehdään.
SINUN pitää vain kysyä fokus ja odottaa vastaus. Älä tee mitään muuta.`,

  insights: `NYKYINEN VAIHE: Tärkeimmät havainnot
Käyttäjä käy läpi projektin tärkeimmät havainnot valitun fokuksen näkökulmasta.
Keskustele havainnoista, kysy mielipiteitä, ja odota hyväksyntä.
Kun käyttäjä hyväksyy, lisää: ##INSIGHTS_CONFIRMED##`,

  structure: `NYKYINEN VAIHE: Diarakenne
Ehdota ja keskustele diarakenteesta. Odota hyväksyntä.
Kun käyttäjä hyväksyy, lisää: ##STRUCTURE_CONFIRMED##`,

  planning: `NYKYINEN VAIHE: Diojen sisältö
Käsittele VAIN yksi dia kerrallaan. Odota käyttäjän hyväksyntä ennen seuraavaa.`,
};

// ── API-kutsun apufunktiot ─────────────────────────────────────────
const SEARCH_TRIGGERS = [
  "hae", "etsi", "googla", "selvitä", "tarkista netistä",
  "hae tietoa", "hae netistä", "search", "find info",
];

async function callAPI(messages, systemExtra, forceSearch) {
  const system = systemExtra ? SYSTEM + "\n\n" + systemExtra : SYSTEM;
  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const useSearch =
    forceSearch ||
    SEARCH_TRIGGERS.some((t) => lastUserMsg.toLowerCase().includes(t));

  const r = await fetch(API + "/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-token": localStorage.getItem("pm_token") || "",
    },
    body: JSON.stringify({ messages, system, useSearch }),
  });

  const d = await r.json();
  if (r.status === 401) {
    localStorage.removeItem("pm_token");
    window.location.reload();
  }
  if (d.error) throw new Error(d.error);
  return d.text;
}

// ── Parsinta-aputyökalut ──────────────────────────────────────────
function extractTag(text, tag) {
  const re = new RegExp("\\[" + tag + "\\]([\\s\\S]*?)\\[\\/" + tag + "\\]");
  const m = text.match(re);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1].trim());
    if (tag === "STRUCTURE_DATA" && !Array.isArray(parsed))
      return Object.values(parsed).filter((v) => v && v.id);
    return parsed;
  } catch {
    return null;
  }
}

function extractSlideData(text) {
  const out = {};
  const re = /\[SLIDE_DATA:([\w_-]+)\]([\s\S]*?)\[\/SLIDE_DATA\]/g;
  let m;
  while ((m = re.exec(text))) {
    try {
      out[m[1]] = JSON.parse(m[2].trim());
    } catch {}
  }
  return out;
}

/** Poistaa KAIKKI sisäiset tagit ennen näyttämistä käyttäjälle */
function strip(text) {
  return text
    .replace(/\[SLIDE_DATA:[\w_-]+\][\s\S]*?\[\/SLIDE_DATA\]/g, "")
    .replace(/\[STRUCTURE_DATA\][\s\S]*?\[\/STRUCTURE_DATA\]/g, "")
    .replace(/\[FOCUS_TYPE\][\s\S]*?\[\/FOCUS_TYPE\]/g, "")
    .replace(/##[\w_]+##/g, "")
    .trim();
}

/** Palauttaa true jos teksti näyttää lyhyeltä hyväksynnältä */
function isShortYes(text) {
  const w = text.trim().toLowerCase().split(/\s+/);
  if (w.length > 5) return false;
  const yesWords = [
    "ok", "joo", "kyllä", "selvä", "hyvä", "sopii", "käy",
    "juu", "yes", "jep", "okei", "sovittu", "hyväksyn",
    "edetään", "aloitetaan", "siirrytään",
  ];
  return yesWords.some((x) => w.includes(x));
}

// ── Dia-ehdotuksen prompt ─────────────────────────────────────────
function getPropose(slide, idx, total) {
  const layouts = {
    title:     "otsikkodia — suuri projektin nimi, lyhyt tagline (1 lause), meta-tiedot",
    bullets:   "bullet-lista — selkeä otsikko + 4–7 kohtaa ranskalaisilla viivoilla",
    table:     "taulukko — otsikko + sarakkeet ja rivit (max 8 riviä)",
    gantt:     "Gantt-kaavio — projektin vaiheet aikajanalla, viikot, kriittinen polku",
    cards:     "korttiruudukko — 2–4 korttia ikoneilla ja värikoodeilla",
    "two-col": "kaksipalstainen — vasen ja oikea sarake omilla otsikoillaan",
  };
  return `Käsittele NYT dia ${idx + 1}/${total}: "${slide.label}"
Layout: ${layouts[slide.layout] || "vapaa rakenne"}

Ehdota konkreettinen sisältö tälle dialle projektin tietojen pohjalta.
Perustele lyhyesti miksi tämä rakenne sopii.
Kysy lopuksi: "Hyväksytkö tämän, vai haluatko muutoksia?"

TÄRKEÄÄ: Älä käsittele muita dioja. Vain tämä yksi.`;
}

// ── Dia-vahvistuksen prompt ────────────────────────────────────────
function getConfirm(slide, isLast) {
  const schemas = {
    title:
      '{"title":"...","tagline":"...","meta":"...","projectLead":"..."}',
    bullets:
      '{"heading":"...","bullets":["kohta 1","kohta 2"],"note":"valinnainen huomio"}',
    table:
      '{"heading":"...","columns":["Sarake1","Sarake2"],"rows":[["arvo1","arvo2"]]}',
    gantt:
      '{"heading":"Aikataulu","totalWeeks":8,"frozenWeek":7,"phases":[{"name":"Vaihe","start":1,"end":2,"critical":false}]}',
    cards:
      '{"heading":"...","cards":[{"icon":"⚠️","title":"...","desc":"...","level":"high"}]}',
    "two-col":
      '{"heading":"...","left":{"title":"...","items":["..."]},"right":{"title":"...","items":["..."]}}',
  };
  const schema = schemas[slide.layout] || '{"heading":"...","content":"..."}';

  return `Käsittele käyttäjän palaute diaan "${slide.label}".

Jos käyttäjä HYVÄKSYY (ok, joo, hyvä, kyllä, sopii, käy, sovittu tms.) tai haluaa vain pieniä muutoksia:

1. Tuota tagi: [SLIDE_DATA:${slide.id}]<JSON yllä olevan skeeman mukaan>[/SLIDE_DATA]
2. Kirjoita 1 lause: "Tallennettu. ${isLast ? "Kaikki diat on nyt käsitelty!" : "Siirrytään seuraavaan diaan."}"
3. Lisää: ##SLIDE_DONE##
${isLast ? "4. Lisää: ##ALL_SLIDES_DONE##" : ""}

JSON-skeema: ${schema}

Jos käyttäjä haluaa ISOJA muutoksia: tee muutos, näytä uusi versio, kysy hyväksyntä uudelleen.
ÄLÄ lisää ##SLIDE_DONE## tagia jos muutoksia tehdään — odota uusi hyväksyntä.`;
}

// ── UI-komponentit ────────────────────────────────────────────────
function Divider({ text }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, margin: "20px 0",
      }}
    >
      <div style={{ flex: 1, height: 1, background: G.silver }} />
      <span
        style={{
          background: G.light, border: "1px solid " + G.silver,
          borderRadius: 20, padding: "3px 14px", fontSize: 12,
          color: G.grey, fontWeight: 600, whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: G.silver }} />
    </div>
  );
}

function Bubble({ role, content }) {
  const ai = role === "assistant";
  return (
    <div
      style={{
        display: "flex", flexDirection: ai ? "row" : "row-reverse",
        gap: 10, marginBottom: 16, alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: "50%",
          background: ai ? G.deepBlue : G.orange,
          color: ai ? G.orange : G.white,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 2,
        }}
      >
        {ai ? "G" : "P"}
      </div>
      <div
        style={{
          maxWidth: "76%",
          background: ai ? G.white : G.deepBlue,
          color: ai ? G.deepBlue : G.white,
          borderRadius: ai ? "3px 14px 14px 14px" : "14px 3px 14px 14px",
          padding: "12px 16px", fontSize: 14, lineHeight: 1.65,
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function Pill({ slide, status }) {
  const cfg = {
    pending:    { bg: G.light,   border: G.silver,      color: G.grey,        sub: "" },
    proposing:  { bg: "#FFF3EE", border: G.orange,      color: G.orange,      sub: "Ehdotettu" },
    confirming: { bg: "#E8F4FB", border: G.digitalBlue, color: G.digitalBlue, sub: "Odottaa" },
    done:       { bg: "#E8FAF7", border: G.mint,        color: G.mint,        sub: "✓ Sovittu" },
  }[status] || { bg: G.light, border: G.silver, color: G.grey, sub: "" };
  return (
    <div
      style={{
        background: cfg.bg, border: "1.5px solid " + cfg.border,
        borderRadius: 10, padding: "8px 12px", marginBottom: 6,
        display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
      }}
    >
      <span style={{ fontSize: 15 }}>{slide.icon || "📄"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12, fontWeight: 600, color: cfg.color,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {slide.label}
        </div>
        {cfg.sub && (
          <div style={{ fontSize: 10, color: cfg.color, opacity: 0.8 }}>
            {cfg.sub}
          </div>
        )}
      </div>
      <div
        style={{
          width: 7, height: 7, borderRadius: "50%",
          background: cfg.border, flexShrink: 0,
        }}
      />
    </div>
  );
}

// ── Pääkomponentti ─────────────────────────────────────────────────
export default function App() {
  // ── Tilat ──
  const [screen, setScreen]           = useState("intro");
  const [authed, setAuthed]           = useState(!!localStorage.getItem("pm_token"));
  const [pwInput, setPwInput]         = useState("");
  const [pwError, setPwError]         = useState(false);
  const [msgs, setMsgs]              = useState([]);
  const [input, setInput]            = useState("");
  const [busy, setBusy]              = useState(false);
  const [slides, setSlides]          = useState([]);
  const [slideIdx, setSlideIdx]      = useState(0);
  const [statuses, setStatuses]      = useState({});
  const [collected, setCollected]    = useState({});
  const [building, setBuilding]      = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [docContext, setDocContext]   = useState("");
  const [focusType, setFocusType]    = useState("");
  const [dragOver, setDragOver]      = useState(false);

  // ── Refit (stale closure -suoja) ──
  const bottom         = useRef();
  const fileInput      = useRef();
  const collectedRef   = useRef({});
  const proposingRef   = useRef(false);
  const screenRef      = useRef("intro");
  const slideIdxRef    = useRef(0);
  const slidesRef      = useRef([]);
  const focusTypeRef   = useRef("");
  const pendingStructRef = useRef(null);
  const docContextRef  = useRef("");

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { slideIdxRef.current = slideIdx; }, [slideIdx]);
  useEffect(() => { slidesRef.current = slides; }, [slides]);
  useEffect(() => { docContextRef.current = docContext; }, [docContext]);

  // ── Apufunktiot ──
  const history = useCallback(
    () =>
      msgs
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
    [msgs]
  );

  const addMsg = useCallback((role, content) => {
    setMsgs((prev) => [...prev, { role, content }]);
  }, []);

  const addDivider = useCallback((text) => {
    setMsgs((prev) => [...prev, { type: "divider", content: text }]);
  }, []);

  const phaseSystem = useCallback(
    (phase) => {
      const ctx = docContextRef.current;
      const focus = focusTypeRef.current;
      let extra = PHASE_PROMPTS[phase] || "";
      if (ctx) extra += "\n\nPROJEKTIN LÄHDEMATERIAALIT:\n" + ctx;
      if (focus) extra += "\n\nVALITTU FOKUS: " + focus;
      return extra;
    },
    []
  );

  // ══════════════════════════════════════════════════════════════════
  // VAIHE 1: Haastattelu
  // ══════════════════════════════════════════════════════════════════
  function startInterview() {
    setScreen("interview");
    setMsgs([
      { type: "divider", content: "💬 Vaihe 1 — Haastattelu" },
      {
        role: "assistant",
        content:
          "Hei! Olen Goforen projektisuunnitelma-agentti.\n\nKerro projektistasi — mitä tehdään, milloin, kenen kanssa ja mitkä ovat tärkeimmät haasteet. Voit liittää dokumentteja 📎-napista.\n\n5 vaihetta:\n1️⃣ Projektitiedot  2️⃣ Fokus  3️⃣ Havainnot  4️⃣ Rakenne  5️⃣ Diat",
      },
    ]);
  }

  async function runInterview(userText, ctx) {
    const extra = ctx || docContextRef.current;
    const hist = [...history(), { role: "user", content: userText }];

    const r = await callAPI(
      [
        ...hist,
        {
          role: "user",
          content: `[JÄRJESTELMÄOHJE — älä näytä tätä käyttäjälle]
Arvioi onko projektin perustiedot (tavoite + aikataulu + osapuolet) riittävällä tasolla.
- Jos EI: kysy YKSI tärkein puuttuva tieto lyhyesti. Älä lisää ##READY_TO_PLAN##.
- Jos KYLLÄ: vastaa lyhyesti ja lisää ##READY_TO_PLAN## loppuun.
Vastaa aina luonnollisesti suomeksi.`,
        },
      ],
      PHASE_PROMPTS.interview + (extra ? "\n\nLÄHDEMATERIAALIT:\n" + extra : "")
    );

    const clean = strip(r);
    addMsg("assistant", clean);

    if (r.includes("##READY_TO_PLAN##")) {
      // Siirry fokus-vaiheeseen
      await runFocusAsk([...hist, { role: "assistant", content: clean }]);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // VAIHE 2: Fokus — KYSY (erillinen kutsu)
  // ══════════════════════════════════════════════════════════════════
  async function runFocusAsk(hist) {
    setScreen("focus");
    screenRef.current = "focus";
    addDivider("🎯 Vaihe 2 — Esityksen fokus");

    const r = await callAPI(
      [
        ...(hist || history()),
        {
          role: "user",
          content: `[JÄRJESTELMÄOHJE]
Kerro 1 lauseella projektin tilanteesta ja kysy:
"Mihin tarkoitukseen tämä esitys tehdään?"

1. 📋 Yleinen projektisuunnitelma
2. ⚠️ Riskianalyysi
3. 📅 Aikataulukatsaus
4. 🚀 Kickoff-materiaali
5. 👥 Sidosryhmäraportti johdolle/asiakkaalle
6. 🔍 Muu — kuvaile itse

ÄLÄ tee mitään muuta — vain tämä kysymys. Odota vastaus.`,
        },
      ],
      phaseSystem("focus")
    );

    addMsg("assistant", strip(r));
    // Odota käyttäjän vastaus — palataan doSend → runFocusConfirm
  }

  // ══════════════════════════════════════════════════════════════════
  // VAIHE 2b: Fokus — VAHVISTA ja siirry havaintoihin
  // ══════════════════════════════════════════════════════════════════
  async function runFocusConfirm(userText) {
    const hist = [...history(), { role: "user", content: userText }];

    // Tallenna fokus paikallisesti (ei tarvita AI:ta)
    const focus = userText.trim();
    setFocusType(focus);
    focusTypeRef.current = focus;

    // Siirry suoraan insights-vaiheeseen
    setScreen("insights");
    screenRef.current = "insights";
    addDivider("🔍 Vaihe 3 — Tärkeimmät havainnot");

    const r = await callAPI(
      [
        ...hist,
        {
          role: "user",
          content: `[JÄRJESTELMÄOHJE]
Käyttäjä valitsi fokukseksi: "${focus}"

Tehtäväsi:
1. Vahvista valinta 1 lauseella
2. Listaa 4–6 tärkeintä havaintoa/riskiä JUURI tämän fokuksen näkökulmasta (perustuen annettuihin projektitietoihin)
3. Kysy: "Oletko samaa mieltä? Voit lisätä, poistaa tai muuttaa havaintoja."

ÄLÄ ehdota diarakennetta vielä. ÄLÄ siirry eteenpäin.`,
        },
      ],
      phaseSystem("insights")
    );

    addMsg("assistant", strip(r));
    // Odota käyttäjän vastaus → runInsightsConfirm
  }

  // ══════════════════════════════════════════════════════════════════
  // VAIHE 3: Havainnot — VAHVISTA
  // ══════════════════════════════════════════════════════════════════
  async function runInsightsConfirm(userText) {
    const hist = [...history(), { role: "user", content: userText }];

    const r = await callAPI(
      [
        ...hist,
        {
          role: "user",
          content: `[JÄRJESTELMÄOHJE]
Käyttäjä kommentoi havaintoja (fokus: "${focusTypeRef.current}").

- Jos käyttäjä HYVÄKSYY (ok, joo, hyvä, kyllä, selvä, sopii tms.):
  Kirjoita: "Hienoa, siirrytään rakentamaan diarakenne."
  Lisää: ##INSIGHTS_CONFIRMED##

- Jos käyttäjä haluaa MUUTTAA: päivitä lista, näytä se, kysy uudelleen.
  ÄLÄ lisää ##INSIGHTS_CONFIRMED##.`,
        },
      ],
      phaseSystem("insights")
    );

    const clean = strip(r);
    addMsg("assistant", clean);

    const confirmed = r.includes("##INSIGHTS_CONFIRMED##") || isShortYes(userText);

    if (confirmed) {
      await runStructureAsk([...hist, { role: "assistant", content: clean }]);
    }
    // Muuten odota lisää keskustelua → doSend kutsuu runInsightsConfirm uudelleen
  }

  // ══════════════════════════════════════════════════════════════════
  // VAIHE 4: Rakenne — EHDOTA
  // ══════════════════════════════════════════════════════════════════
  async function runStructureAsk(hist) {
    setScreen("structure");
    screenRef.current = "structure";
    addDivider("📐 Vaihe 4 — Diarakenne");

    const r = await callAPI(
      [
        ...(hist || history()),
        {
          role: "user",
          content: `[JÄRJESTELMÄOHJE]
Fokus: "${focusTypeRef.current}"

Ehdota diarakenne (yksi dia per rivi, numeroidut):
Esim:
1. 🎯 Kansi — projektin nimi ja tiivistelmä
2. 📋 Yleiskatsaus — tavoitteet ja konteksti
jne.

Layout-vaihtoehdot: title, bullets, table, gantt, cards, two-col

Kysy lopuksi: "Hyväksytkö tämän rakenteen vai haluatko muutoksia?"

Tallenna rakenne MYÖS koneluettavasti:
[STRUCTURE_DATA][{"id":"kansi","label":"Kansi","icon":"🎯","layout":"title"},{"id":"yleiskatsaus","label":"Yleiskatsaus","icon":"📋","layout":"bullets"}][/STRUCTURE_DATA]

ID-kentässä VAIN pieniä kirjaimia ja alaviivoja.`,
        },
      ],
      phaseSystem("structure")
    );

    const structure = extractTag(r, "STRUCTURE_DATA");
    if (structure) pendingStructRef.current = structure;

    addMsg("assistant", strip(r));
    // Odota käyttäjän vastaus → runStructureConfirm
  }

  // ══════════════════════════════════════════════════════════════════
  // VAIHE 4b: Rakenne — VAHVISTA
  // ══════════════════════════════════════════════════════════════════
  async function runStructureConfirm(userText) {
    const hist = [...history(), { role: "user", content: userText }];

    const r = await callAPI(
      [
        ...hist,
        {
          role: "user",
          content: `[JÄRJESTELMÄOHJE]
Käyttäjä kommentoi rakenne-ehdotustasi.

Jos HYVÄKSYY (ok, joo, hyvä, kyllä, selvä, sopii, käy tms.):
- Kirjoita: "Rakenne vahvistettu! Aloitetaan diojen sisällöntuotanto."
- Lisää: ##STRUCTURE_CONFIRMED##
- Palauta: [STRUCTURE_DATA][...sama tai päivitetty JSON...][/STRUCTURE_DATA]

Jos haluaa MUUTTAA: tee muutos, näytä uusi lista, kysy hyväksyntä uudelleen.
ÄLÄ lisää ##STRUCTURE_CONFIRMED## jos muutoksia tehdään.

ID-kentässä VAIN pieniä kirjaimia ja alaviivoja.`,
        },
      ],
      phaseSystem("structure")
    );

    const structure = extractTag(r, "STRUCTURE_DATA");
    if (structure) pendingStructRef.current = structure;

    const clean = strip(r);
    addMsg("assistant", clean);

    // Tarkista vahvistus
    const tagOk = r.includes("##STRUCTURE_CONFIRMED##");
    const shortYes = isShortYes(userText);

    const raw = pendingStructRef.current;
    const confirmed = Array.isArray(raw) ? raw : null;

    if ((tagOk || shortYes) && confirmed && confirmed.length > 0) {
      // Siirry planning-vaiheeseen
      setSlides(confirmed);
      slidesRef.current = confirmed;
      setStatuses(Object.fromEntries(confirmed.map((s) => [s.id, "pending"])));
      setScreen("planning");
      screenRef.current = "planning";
      setSlideIdx(0);
      slideIdxRef.current = 0;
      addDivider("📄 Vaihe 5 — Diojen sisällöntuotanto");
      await proposeSlide(
        0,
        [...hist, { role: "assistant", content: clean }],
        confirmed
      );
    }
    // Muuten odota lisää keskustelua
  }

  // ══════════════════════════════════════════════════════════════════
  // VAIHE 5: Diojen sisältö — EHDOTA
  // ══════════════════════════════════════════════════════════════════
  async function proposeSlide(idx, hist, slidesArr) {
    if (proposingRef.current) return;
    proposingRef.current = true;
    try {
      const cur = slidesArr || slidesRef.current;
      setSlideIdx(idx);
      slideIdxRef.current = idx;
      setStatuses((prev) => {
        const n = { ...prev };
        cur.forEach((s, i) => {
          if (i === idx) n[s.id] = "proposing";
          else if (n[s.id] !== "done") n[s.id] = "pending";
        });
        return n;
      });

      const slide = cur[idx];
      const r = await callAPI(
        [
          ...(hist || history()),
          {
            role: "user",
            content:
              `[DIA ${idx + 1}/${cur.length} — ${slide.label}]\n\n` +
              getPropose(slide, idx, cur.length),
          },
        ],
        phaseSystem("planning")
      );

      addDivider(
        `📄 Dia ${idx + 1}/${cur.length} — ${slide.icon || ""} ${slide.label}`
      );
      addMsg("assistant", strip(r));
      setStatuses((prev) => ({ ...prev, [slide.id]: "confirming" }));
    } finally {
      proposingRef.current = false;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // VAIHE 5b: Diojen sisältö — VAHVISTA
  // ══════════════════════════════════════════════════════════════════
  async function runPlanning(userText) {
    const cur = slidesRef.current;
    const idx = slideIdxRef.current;
    const slide = cur[idx];
    const isLast = idx === cur.length - 1;
    const hist = [...history(), { role: "user", content: userText }];

    const r = await callAPI(
      [
        ...hist,
        {
          role: "user",
          content:
            `[DIA ${idx + 1}/${cur.length} — ${slide.label} — VAHVISTA]\n\n` +
            getConfirm(slide, isLast),
        },
      ],
      phaseSystem("planning")
    );

    // Kerää slide data
    const extracted = extractSlideData(r);
    if (Object.keys(extracted).length) {
      const newCollected = { ...collectedRef.current, ...extracted };
      collectedRef.current = newCollected;
      setCollected(newCollected);
    }

    const clean = strip(r);
    addMsg("assistant", clean);

    // Tunnista onko dia valmis
    const tagDone = r.includes("##SLIDE_DONE##") || r.includes("##ALL_SLIDES_DONE##");
    const hasData = Object.keys(extracted).length > 0;
    const slideDone = tagDone || (hasData && isShortYes(userText));
    const allDone = r.includes("##ALL_SLIDES_DONE##") || (slideDone && isLast);

    if (slideDone) {
      setStatuses((prev) => ({ ...prev, [slide.id]: "done" }));
      const next = idx + 1;
      if (!allDone && next < cur.length) {
        setSlideIdx(next);
        slideIdxRef.current = next;
        setTimeout(() => proposeSlide(next, null, cur), 600);
      } else {
        // Validoi ennen lataamista
        const missing = cur.filter((s) => !collectedRef.current[s.id]);
        if (missing.length > 0) {
          addMsg(
            "assistant",
            `⚠️ Huomio: ${missing.length} diasta puuttuu dataa (${missing.map((s) => s.label).join(", ")}). Nämä diat saattavat olla tyhjiä. Generoidaan silti PowerPoint.`
          );
        }
        finishAndDownload(cur);
      }
    }
    // Muuten odota lisää keskustelua (käyttäjä haluaa muutoksia)
  }

  // ══════════════════════════════════════════════════════════════════
  // LATAUS
  // ══════════════════════════════════════════════════════════════════
  function finishAndDownload(slidesArr) {
    setScreen("ready");
    setMsgs((prev) => [
      ...prev,
      { type: "divider", content: "✅ Kaikki diat valmiit" },
      {
        role: "assistant",
        content:
          "Esitys on valmis! PowerPoint-lataus käynnistyy automaattisesti.\n\nJos lataus ei käynnisty, paina alla olevaa nappia:",
      },
      { type: "download" },
    ]);
    setTimeout(() => downloadPPTX(slidesArr), 800);
  }

  async function downloadPPTX(slidesArr) {
    setBuilding(true);
    try {
      const r = await fetch(API + "/api/build-pptx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": localStorage.getItem("pm_token") || "",
        },
        body: JSON.stringify({
          slideData: collectedRef.current,
          slideStructure: slidesArr || slidesRef.current,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "HTTP " + r.status);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href: url,
        download: "projektisuunnitelma.pptx",
      }).click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Virhe: " + e.message);
    }
    setBuilding(false);
  }

  // ══════════════════════════════════════════════════════════════════
  // TIEDOSTOJEN KÄSITTELY
  // ══════════════════════════════════════════════════════════════════
  async function readFile(f) {
    if (f.name.match(/\.(txt|md|csv|json)$/i)) {
      const t = await f.text().catch(() => "");
      return { name: f.name, content: "[" + f.name + "]\n" + t.substring(0, 5000) };
    }
    const mimeMap = {
      pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg",
      png: "image/png", gif: "image/gif", webp: "image/webp",
    };
    const ext = f.name.split(".").pop().toLowerCase();
    const mimeType = mimeMap[ext];
    if (mimeType) {
      try {
        const buf = await f.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        const base64 = btoa(binary);
        const r = await fetch(API + "/api/extract-file", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-token": localStorage.getItem("pm_token") || "",
          },
          body: JSON.stringify({ base64, mimeType, fileName: f.name }),
        });
        const d = await r.json();
        return {
          name: f.name,
          content:
            "[" +
            f.name +
            (d.text
              ? " — sisältö:]\n" + d.text
              : ": " + (d.error || "luku epäonnistui") + "]"),
        };
      } catch (e) {
        return { name: f.name, content: "[" + f.name + ": virhe — " + e.message + "]" };
      }
    }
    return {
      name: f.name,
      content: "[" + f.name + " — kopioi sisältö tekstinä, tiedostotyyppiä ei tueta]",
    };
  }

  async function addFiles(fileList) {
    const read = await Promise.all(Array.from(fileList).map(readFile));
    setAttachments((prev) => [...prev, ...read]);
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
          await new Promise((res) =>
            entry.createReader().readEntries(async (entries) => {
              for (const en of entries)
                if (en.isFile)
                  await new Promise((r) => en.file((f) => { files.push(f); r(); }));
              res();
            })
          );
        } else {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
    } else {
      files.push(...Array.from(e.dataTransfer.files));
    }
    if (files.length) await addFiles(files);
  }

  // ══════════════════════════════════════════════════════════════════
  // LÄHETYS — PÄÄREITITIN
  // ══════════════════════════════════════════════════════════════════
  async function doSend() {
    const text = input.trim();
    const files = attachments;
    if (!text && files.length === 0) return;
    if (busy) return;

    let display = text;
    let apiText = text;
    let newCtx = docContext;

    if (files.length > 0) {
      const names = files.map((f) => f.name).join(", ");
      const bodies = files.map((f) => f.content).join("\n\n---\n\n");
      display = (text ? text + "\n\n" : "") + "📎 " + names;
      apiText =
        (text ? text + "\n\n" : "Tässä on projektimateriaali:\n\n") + bodies;
      newCtx =
        (docContext ? docContext + "\n\n---\n\n" : "PROJEKTIN LÄHDEMATERIAALIT:\n\n") +
        bodies;
      setDocContext(newCtx);
      docContextRef.current = newCtx;
    }

    setInput("");
    setAttachments([]);
    setMsgs((prev) => [...prev, { role: "user", content: display }]);
    setBusy(true);

    try {
      const s = screenRef.current;
      if (s === "interview")       await runInterview(apiText, newCtx);
      else if (s === "focus")      await runFocusConfirm(apiText);
      else if (s === "insights")   await runInsightsConfirm(apiText);
      else if (s === "structure")  await runStructureConfirm(apiText);
      else if (s === "planning")   await runPlanning(apiText);
    } catch (e) {
      addMsg("assistant", "⚠️ Virhe: " + e.message);
    }
    setBusy(false);
  }

  // ── Login ──
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

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════
  const canSend = !busy && (input.trim().length > 0 || attachments.length > 0);
  const doneCount = Object.values(statuses).filter((s) => s === "done").length;
  const showSidebar = screen === "planning" || screen === "ready";
  const currentSlide = slides[slideIdx];

  // ── Login-näkymä ──
  if (!authed)
    return (
      <div
        style={{
          minHeight: "100vh", background: G.deepBlue,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Segoe UI',sans-serif",
        }}
      >
        <div style={{ textAlign: "center", width: 320 }}>
          <div
            style={{
              width: 60, height: 60, background: G.orange, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, color: G.white, fontWeight: 700, margin: "0 auto 20px",
            }}
          >
            G
          </div>
          <h2 style={{ color: G.white, marginBottom: 8 }}>
            Projektisuunnitelma-agentti
          </h2>
          <p style={{ color: G.grey, fontSize: 13, marginBottom: 24 }}>
            Syötä salasana jatkaaksesi
          </p>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }}
            placeholder="Salasana"
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: "1.5px solid " + (pwError ? G.orange : G.grey),
              background: "rgba(255,255,255,0.08)", color: G.white,
              fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 8,
            }}
          />
          {pwError && (
            <div style={{ color: G.orange, fontSize: 13, marginBottom: 8 }}>
              Väärä salasana
            </div>
          )}
          <button
            onClick={doLogin}
            style={{
              width: "100%", background: G.orange, color: G.white,
              border: "none", borderRadius: 10, padding: "12px 0",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}
          >
            Kirjaudu →
          </button>
        </div>
      </div>
    );

  // ── Intro-näkymä ──
  if (screen === "intro")
    return (
      <div
        style={{
          minHeight: "100vh", background: G.deepBlue,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 32, fontFamily: "'Segoe UI',sans-serif",
        }}
      >
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div
            style={{
              width: 68, height: 68, background: G.orange, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, color: G.white, fontWeight: 700, margin: "0 auto 24px",
            }}
          >
            G
          </div>
          <h1 style={{ color: G.white, fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
            Projektisuunnitelma-agentti
          </h1>
          <p
            style={{
              color: G.codeBlue, fontSize: 14, lineHeight: 1.7, margin: "0 0 32px",
            }}
          >
            Rakennetaan projektisuunnitelmasi yhdessä, dia kerrallaan.
            <br />
            Rakenne räätälöidään projektisi mukaan.
          </p>
          <div
            style={{
              background: "rgba(255,255,255,0.05)", borderRadius: 14,
              padding: 20, marginBottom: 32, textAlign: "left",
            }}
          >
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
          <button
            onClick={startInterview}
            style={{
              width: "100%", background: G.orange, color: G.white,
              border: "none", borderRadius: 12, padding: "14px 0",
              fontSize: 16, fontWeight: 700, cursor: "pointer",
            }}
          >
            Aloita haastattelu →
          </button>
          <button
            onClick={async () => {
              try {
                const testData = {
                  slideData: {
                    cover: {
                      title: "Testiprojekti", tagline: "Testi toimii!",
                      meta: "Gofore · 2025", projectLead: "Testi",
                    },
                  },
                  slideStructure: [
                    { id: "cover", label: "Kansi", icon: "🎯", layout: "title" },
                  ],
                };
                const r = await fetch(API + "/api/build-pptx", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-session-token": localStorage.getItem("pm_token") || "",
                  },
                  body: JSON.stringify(testData),
                });
                if (!r.ok) {
                  const e = await r.json().catch(() => ({}));
                  alert("Virhe: " + (e.error || r.status));
                  return;
                }
                const blob = await r.blob();
                const url = URL.createObjectURL(blob);
                Object.assign(document.createElement("a"), {
                  href: url, download: "testi.pptx",
                }).click();
                URL.revokeObjectURL(url);
              } catch (e) {
                alert("Yhteysvirhe: " + e.message);
              }
            }}
            style={{
              width: "100%", marginTop: 8, background: "transparent",
              color: G.codeBlue, border: "1px solid " + G.codeBlue,
              borderRadius: 12, padding: "10px 0", fontSize: 13, cursor: "pointer",
            }}
          >
            🧪 Testaa PPTX-lataus
          </button>
        </div>
      </div>
    );

  // ── Päänäkymä ──
  return (
    <div
      style={{
        height: "100vh", display: "flex", fontFamily: "'Segoe UI',sans-serif",
        background: G.bg, overflow: "hidden",
      }}
    >
      {/* Sivupalkki */}
      {showSidebar && (
        <div
          style={{
            width: 200, background: G.white, borderRight: "1px solid " + G.silver,
            padding: "14px 12px", display: "flex", flexDirection: "column",
            flexShrink: 0, overflowY: "auto",
          }}
        >
          <div
            style={{
              color: G.grey, fontSize: 11, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 12,
            }}
          >
            Diat {doneCount}/{slides.length}
          </div>
          {slides.map((s) => (
            <Pill key={s.id} slide={s} status={statuses[s.id] || "pending"} />
          ))}
          {(screen === "ready" ||
            (slides.length > 0 && doneCount === slides.length)) && (
            <button
              onClick={() => downloadPPTX()}
              disabled={building}
              style={{
                background: building ? G.grey : G.orange, color: G.white,
                border: "none", borderRadius: 10, padding: "12px 0",
                fontSize: 13, fontWeight: 700,
                cursor: building ? "not-allowed" : "pointer", marginTop: 16,
              }}
            >
              {building ? "⏳ Rakennetaan..." : "🚀 Lataa PPTX"}
            </button>
          )}
        </div>
      )}

      {/* Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Yläpalkki */}
        <div
          style={{
            background: G.deepBlue, padding: "8px 16px",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28, height: 28, background: G.orange, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: G.white, fontWeight: 700, fontSize: 12,
            }}
          >
            G
          </div>
          <div>
            <div style={{ color: G.white, fontWeight: 600, fontSize: 13 }}>
              Projektisuunnitelma-agentti
            </div>
            <div style={{ color: G.codeBlue, fontSize: 11 }}>
              {screen === "interview"
                ? "💬 Vaihe 1 — Haastattelu"
                : screen === "focus"
                  ? "🎯 Vaihe 2 — Esityksen fokus"
                  : screen === "insights"
                    ? "🔍 Vaihe 3 — Havainnot" + (focusType ? ": " + focusType : "")
                    : screen === "structure"
                      ? "📐 Vaihe 4 — Diarakenne"
                      : screen === "planning" && slides.length > 0
                        ? `📄 Vaihe 5 — Dia ${slideIdx + 1}/${slides.length}` +
                          (currentSlide
                            ? ` — ${currentSlide.icon || ""} ${currentSlide.label}`
                            : "")
                        : screen === "ready"
                          ? "✅ Valmis"
                          : ""}
            </div>
          </div>
        </div>

        {/* Viestit */}
        <div
          style={{ flex: 1, overflowY: "auto", padding: "20px 16px", position: "relative" }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
          }}
          onDrop={onDrop}
        >
          {dragOver && (
            <div
              style={{
                position: "absolute", inset: 0,
                background: "rgba(27,108,168,0.1)",
                border: "2px dashed " + G.digitalBlue, borderRadius: 8,
                zIndex: 10, display: "flex", alignItems: "center",
                justifyContent: "center", pointerEvents: "none",
              }}
            >
              <div
                style={{
                  background: G.white, borderRadius: 12,
                  padding: "24px 40px", textAlign: "center",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                <div style={{ color: G.digitalBlue, fontWeight: 600 }}>
                  Pudota tiedostot tähän
                </div>
                <div style={{ color: G.grey, fontSize: 12, marginTop: 4 }}>
                  pdf · kuva · txt · csv · json
                </div>
              </div>
            </div>
          )}

          {msgs.map((m, i) => {
            if (m.type === "divider")
              return <Divider key={i} text={m.content} />;
            if (m.type === "download")
              return (
                <div
                  key={i}
                  style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}
                >
                  <button
                    onClick={() => downloadPPTX()}
                    disabled={building}
                    style={{
                      background: building ? G.grey : G.orange, color: G.white,
                      border: "none", borderRadius: 12, padding: "14px 32px",
                      fontSize: 15, fontWeight: 700,
                      cursor: building ? "not-allowed" : "pointer",
                      boxShadow: "0 2px 8px rgba(232,82,26,0.3)",
                    }}
                  >
                    {building ? "⏳ Rakennetaan..." : "🚀 Lataa PowerPoint"}
                  </button>
                </div>
              );
            return <Bubble key={i} role={m.role} content={m.content} />;
          })}
          {busy && (
            <div style={{ display: "flex", gap: 10 }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: G.deepBlue, color: G.orange,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 12,
                }}
              >
                G
              </div>
              <div
                style={{
                  background: G.white,
                  borderRadius: "3px 14px 14px 14px",
                  padding: "12px 16px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                }}
              >
                <span style={{ color: G.grey, letterSpacing: 6, fontSize: 16 }}>
                  ● ● ●
                </span>
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>

        {/* Liitteet */}
        {attachments.length > 0 && (
          <div
            style={{
              background: G.white, borderTop: "1px solid " + G.silver,
              padding: "8px 16px", display: "flex", flexWrap: "wrap", gap: 6,
            }}
          >
            {attachments.map((a, i) => (
              <div
                key={i}
                style={{
                  background: G.light, border: "1px solid " + G.silver,
                  borderRadius: 6, padding: "3px 10px", fontSize: 12,
                  color: G.deepBlue, display: "flex", alignItems: "center", gap: 6,
                }}
              >
                📄 {a.name}
                <span
                  style={{ cursor: "pointer", color: G.grey, fontSize: 14 }}
                  onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                >
                  ×
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Syöttökenttä */}
        <div
          style={{
            background: G.white, borderTop: "1px solid " + G.silver,
            padding: "12px 16px", flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex", gap: 8, alignItems: "flex-end",
              maxWidth: 900, margin: "0 auto",
            }}
          >
            <button
              title="Liitä tiedosto"
              onClick={() => fileInput.current?.click()}
              style={{
                width: 36, height: 36, flexShrink: 0, alignSelf: "flex-end",
                background: "transparent", border: "1.5px dashed " + G.silver,
                borderRadius: 9, cursor: "pointer", fontSize: 16, color: G.grey,
              }}
            >
              📎
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  doSend();
                }
              }}
              placeholder={
                screen === "interview"
                  ? "Kerro projektistasi... (Enter lähettää)"
                  : screen === "focus"
                    ? "Valitse fokus (1–6) tai kuvaile omin sanoin..."
                    : screen === "insights"
                      ? "Vahvista havainnot tai muokkaa listaa..."
                      : screen === "structure"
                        ? "Hyväksy rakenne tai ehdota muutoksia..."
                        : "Kommentoi tai hyväksy ehdotus..."
              }
              style={{
                flex: 1, background: G.light, outline: "none", resize: "vertical",
                border: "1.5px solid " + (input.length > 0 ? G.digitalBlue : G.silver),
                borderRadius: 11, padding: "10px 14px", fontSize: 14,
                fontFamily: "inherit", lineHeight: 1.6, color: G.deepBlue,
                minHeight: 80, maxHeight: 220,
              }}
            />
            <button
              onClick={doSend}
              disabled={!canSend}
              style={{
                width: 38, height: 38, flexShrink: 0, alignSelf: "flex-end",
                background: canSend ? G.orange : G.silver, color: G.white,
                border: "none", borderRadius: "50%", fontSize: 18,
                cursor: canSend ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}