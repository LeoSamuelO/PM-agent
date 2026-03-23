import { useState, useRef, useEffect, useCallback, Component } from "react";

const API = import.meta.env.VITE_API_URL || "https://pm-agent-avpl.onrender.com";

// ═══ ERROR BOUNDARY ═══
class ErrorBoundary extends Component {
  constructor(props){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(error){return{hasError:true,error};}
  componentDidCatch(error,info){console.error("ErrorBoundary:",error,info);}
  render(){
    if(this.state.hasError){
      return(<div style={{minHeight:"100vh",background:"#0C2340",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif"}}>
        <div style={{textAlign:"center",color:"#fff",maxWidth:420,padding:32}}>
          <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
          <h2 style={{margin:"0 0 12px",fontSize:20}}>Jokin meni pieleen</h2>
          <p style={{color:"#8C9BAA",fontSize:14,marginBottom:20}}>{this.state.error?.message||"Tuntematon virhe"}</p>
          <button onClick={()=>{this.setState({hasError:false,error:null});window.location.reload();}}
            style={{background:"#E8521A",color:"#fff",border:"none",borderRadius:10,padding:"12px 32px",fontSize:14,fontWeight:700,cursor:"pointer"}}>
            Lataa sivu uudelleen
          </button>
        </div>
      </div>);
    }
    return this.props.children;
  }
}
const G = {
  deepBlue:"#0C2340",digitalBlue:"#1B6CA8",codeBlue:"#5BA4CF",
  orange:"#E8521A",mint:"#3BBFAD",white:"#FFFFFF",
  grey:"#8C9BAA",silver:"#D3D9DF",light:"#EEF1F3",bg:"#F4F6F9",
};

// ═══ KÄÄNNÖKSET ═══
const T = {
  fi:{
    title:"Projektisuunnitelma-agentti",subtitle:"Rakennetaan projektisuunnitelmasi yhdessä.",
    start:"Aloita haastattelu →",login:"Kirjaudu",register:"Rekisteröidy",password:"Salasana",passwordAgain:"Salasana uudelleen",
    username:"Käyttäjänimi",accessKey:"Avain",wrongPw:"Väärä käyttäjänimi tai salasana",wrongKey:"Väärä avain",
    noAccount:"Ei tiliä?",hasAccount:"Onko jo tili?",pwMismatch:"Salasanat eivät täsmää",pwTooShort:"Salasanan on oltava vähintään 6 merkkiä",
    usernameTaken:"Käyttäjänimi on jo käytössä",usernameTooShort:"Käyttäjänimi liian lyhyt",
    myProjects:"Omat projektit",newProject:"Uusi projekti",saveProject:"Tallenna",savedOk:"Tallennettu!",
    loadProject:"Avaa",deleteProject:"Poista",continueProject:"Jatka",
    agentProfiles:"Agenttiprofiilit",newProfile:"Uusi profiili",profileName:"Profiilin nimi",profileInstr:"Ohjeet agentille...",
    editProfileBtn:"Muokkaa",selectProfile:"Valitse",activeProfileLabel:"Profiili",noProfileSelected:"Ei profiilia",
    deleteConfirm:"Haluatko varmasti poistaa tämän?",noProjects:"Ei tallennettuja projekteja.",noProfiles:"Ei agenttiprofiileja.",
    profileHint:"Kirjoita ohjeet agentille, esim: 'Käytä paljon kaavioita', 'Pidä esitys tiiviinä max 6 diaa', 'Asiakas pitää visuaalisesta tyylistä'",
    logout:"Kirjaudu ulos",admin:"Hallinta",adminUsers:"Käyttäjät",resetPw:"Nollaa salasana",deleteUser:"Poista",
    newPw:"Uusi salasana",confirmDelete:"Poistetaanko käyttäjä",pwResetOk:"Salasana nollattu!",userDeleted:"Käyttäjä poistettu",
    close:"Sulje",you:"(sinä)",firstUserAdmin:"Ensimmäinen rekisteröity käyttäjä saa admin-oikeudet.",
    loggedInAs:"Kirjautuneena:",profile:"Profiili",changePassword:"Vaihda salasana",deleteAccount:"Poista tili",
    currentPw:"Nykyinen salasana",newPw2:"Uusi salasana",pwChanged:"Salasana vaihdettu!",
    wrongCurrentPw:"Väärä nykyinen salasana",confirmDeleteAccount:"Oletko varma? Kaikki projektisi ja profiilisi poistetaan pysyvästi.",
    accountDeleted:"Tili poistettu.",enterPwToDelete:"Anna salasanasi vahvistaaksesi:",projectName:"Projektin nimi",
    enterProjectName:"Anna projektille nimi",backToMain:"← Takaisin",addProfile:"Lisää agenttiprofiili",
    presentations:"Esitykset",newPresentation:"Uusi esitys",presentationName:"Esityksen nimi",
    enterPresentationName:"Anna esitykselle nimi",noPresentations:"Ei esityksiä vielä.",openProject:"Avaa",
    sharedContext:"Jaettu konteksti",interviewDone:"Haastattelu tehty",interviewNotDone:"Aloita haastattelusta",
    continuePresentation:"Jatka",deletePresentation:"Poista",
    steps:[["💬","Haastattelu","Kerro projektistasi"],["🔍","Havainnot","Tunnistan riskit ja vaihtoehdot"],["🤝","Sisältö","Ehdotan sisällön, sinä vahvistat"],["📊","Valmis","Gofore-teemainen dokumentti"]],
    phases:{interview:"💬 Vaihe 1 — Haastattelu",focus:"🎯 Vaihe 2 — Fokus",insights:"🔍 Vaihe 3 — Havainnot",structure:"📐 Vaihe 4 — Rakenne",planning:"📄 Vaihe 5 — Sisältö",deepdive:"🔍 Vaihe 5 — Tarkennukset",writing:"✍️ Vaihe 6 — Dokumentin kirjoitus",review:"👀 Loppukatsaus",ready:"✅ Valmis"},
    slides:"Osat",chapters:"Luvut",redownload:"🚀 Lataa uudelleen",
    placeholder:{review:"'valmis', 'muokkaa diaa/lukua X', 'poista X' tai 'lisää'...",interview:"Kerro projektistasi...",writing:"Kommentoi tai kirjoita 'valmis'...",default:"Kommentoi tai hyväksy..."},
    greeting:"Hei! Olen Goforen projektisuunnitelma-agentti.\n\nKerro projektistasi — mitä tehdään, milloin, kenen kanssa ja mitkä ovat tärkeimmät haasteet. Voit liittää dokumentteja 📎-napista.\n\n5 vaihetta:\n1️⃣ Projektitiedot  2️⃣ Fokus  3️⃣ Havainnot  4️⃣ Rakenne  5️⃣ Sisältö",
    materialThanks:"Kiitos materiaalista! Siirrytään valitsemaan esityksen tarkoitus.",
    structureConfirmed:"Rakenne vahvistettu! Aloitetaan sisällöntuotanto.",
    saving:"💾 Tallennetaan...",saved:"tallennettu.",updated:"päivitetty!",noChanges:"— ei muutoksia.",
    generating:"Generoidaan...",downloaded:"✅ Ladattu!",
    moveToStructure:"Hienoa! Siirrytään rakentamaan rakenne.",
    editAsk:"Mitä haluat muuttaa",editCancel:"Kirjoita muutokset tai \"en mitään\" palataksesi.",
  },
  en:{
    title:"Project Plan Agent",subtitle:"Let's build your project plan together.",
    start:"Start interview →",login:"Log in",register:"Register",password:"Password",passwordAgain:"Password again",
    username:"Username",accessKey:"Access key",wrongPw:"Wrong username or password",wrongKey:"Wrong access key",
    noAccount:"No account?",hasAccount:"Already have an account?",pwMismatch:"Passwords don't match",pwTooShort:"Password must be at least 6 characters",
    usernameTaken:"Username already taken",usernameTooShort:"Username too short",
    myProjects:"My projects",newProject:"New project",saveProject:"Save",savedOk:"Saved!",
    loadProject:"Open",deleteProject:"Delete",continueProject:"Continue",
    agentProfiles:"Agent profiles",newProfile:"New profile",profileName:"Profile name",profileInstr:"Instructions for agent...",
    editProfileBtn:"Edit",selectProfile:"Select",activeProfileLabel:"Profile",noProfileSelected:"No profile",
    deleteConfirm:"Are you sure you want to delete this?",noProjects:"No saved projects.",noProfiles:"No agent profiles.",
    profileHint:"Write instructions for the agent, e.g.: 'Use lots of charts', 'Keep presentation concise max 6 slides', 'Client prefers visual style'",
    logout:"Log out",admin:"Admin",adminUsers:"Users",resetPw:"Reset password",deleteUser:"Delete",
    newPw:"New password",confirmDelete:"Delete user",pwResetOk:"Password reset!",userDeleted:"User deleted",
    close:"Close",you:"(you)",firstUserAdmin:"First registered user gets admin rights.",
    loggedInAs:"Logged in as:",profile:"Profile",changePassword:"Change password",deleteAccount:"Delete account",
    currentPw:"Current password",newPw2:"New password",pwChanged:"Password changed!",
    wrongCurrentPw:"Wrong current password",confirmDeleteAccount:"Are you sure? All your projects and profiles will be permanently deleted.",
    accountDeleted:"Account deleted.",enterPwToDelete:"Enter your password to confirm:",projectName:"Project name",
    enterProjectName:"Give a name for the project",backToMain:"← Back",addProfile:"Add agent profile",
    presentations:"Presentations",newPresentation:"New presentation",presentationName:"Presentation name",
    enterPresentationName:"Name your presentation",noPresentations:"No presentations yet.",openProject:"Open",
    sharedContext:"Shared context",interviewDone:"Interview completed",interviewNotDone:"Start from interview",
    continuePresentation:"Continue",deletePresentation:"Delete",
    steps:[["💬","Interview","Tell about your project"],["🔍","Insights","I identify risks and alternatives"],["🤝","Content","I propose, you confirm"],["📊","Ready","Gofore-themed document"]],
    phases:{interview:"💬 Phase 1 — Interview",focus:"🎯 Phase 2 — Focus",insights:"🔍 Phase 3 — Insights",structure:"📐 Phase 4 — Structure",planning:"📄 Phase 5 — Content",deepdive:"🔍 Phase 5 — Deep dive",writing:"✍️ Phase 6 — Document writing",review:"👀 Final review",ready:"✅ Done"},
    slides:"Parts",chapters:"Chapters",redownload:"🚀 Download again",
    placeholder:{review:"'done', 'edit slide/chapter X', 'remove X' or 'add'...",interview:"Tell about your project...",writing:"Comment or type 'done'...",default:"Comment or approve..."},
    greeting:"Hi! I'm Gofore's project plan agent.\n\nTell me about your project — what, when, with whom, and key challenges. Attach documents with 📎.\n\n5 phases:\n1️⃣ Project info  2️⃣ Focus  3️⃣ Insights  4️⃣ Structure  5️⃣ Content",
    materialThanks:"Thanks for the material! Let's choose the presentation focus.",
    structureConfirmed:"Structure confirmed! Starting content creation.",
    saving:"💾 Saving...",saved:"saved.",updated:"updated!",noChanges:"— no changes.",
    generating:"Generating...",downloaded:"✅ Downloaded!",
    moveToStructure:"Great! Let's build the structure.",
    editAsk:"What do you want to change in",editCancel:"Type changes or \"nothing\" to go back.",
  }
};

function getSystem(lang) {
  const today = new Date().toLocaleDateString(lang==="fi"?"fi-FI":"en-US",{year:"numeric",month:"long",day:"numeric"});
  if (lang==="fi") return `Olet kokenut projektikonsultti Goforella. Kommunikoi AINA suomeksi.
TÄNÄÄN ON: ${today}.
ROOLISI: Olet osa sovellusta joka generoi PowerPoint- tai Word-tiedoston. Roolisi on kerätä sisältö keskustelemalla JA ANALYSOIDA materiaalia.

KRIITTINEN SÄÄNTÖ — MATERIAALIEN KÄYTTÖ:
Sinulle annetaan LÄHDEMATERIAALIT-osio joka sisältää käyttäjän lataamat tiedostot. LUE NE TARKASTI.
- Käytä VAIN lähdemateriaalien nimiä, lukuja, hintoja ja tietoja. ÄLÄ KOSKAAN korvaa niitä omilla keksityillä.
- Jos lähdemateriaalissa lukee "SensorTech Finland 195 000 €", käytä TÄSMÄLLEEN "SensorTech Finland" ja "195 000 €".
- Jos materiaali puuttuu tai on epäselvä → KYSY käyttäjältä. ÄLÄ täydennä puuttuvaa tietoa keksimällä.
- Tarkista JOKAINEN nimi, luku ja hinta lähdemateriaalista ennen kuin käytät sitä.

SÄÄNNÖT:
1. ÄLÄ keksi tietoja. Käytä VAIN annettuja materiaaleja. TARKISTA jokainen fakta materiaaleista.
2. Puuttuva tieto → KYSY.
3. Ole ytimekäs, max 2-3 kappaletta.
4. Käsittele VAIN pyydetty asia.
5. ÄLÄ ARVAA päivämääriä tai lukuja. Epävarma → käytä web-hakua.
6. Ole RATKAISUKESKEINEN: Analysoi, vertaile, tee johtopäätöksiä. Ota kantaa ja perustele.
7. LASKE AINA kun materiaalissa on lukuja: ROI, takaisinmaksu, säästöt, vertailut. Näytä laskukaava ja tulos. Esim: "Säästö: 270k/v - 42k/v lisenssit = 228k/v netto → takaisinmaksu 515k / 228k = 2,3 vuotta".
8. VALITSE SOPIVIN LAYOUT sisällön perusteella:
   - kpi: kun haluat korostaa 2-4 avainlukua isolla (€, %, vuosia) — tiivistelmä tai johtopäätös
   - bar_chart: kun vertaillaan lukuja vaihtoehtojen välillä (hinnat, kustannukset)
   - pie_chart: kun näytetään kokonaisuuden jakautuminen osiin (budjetti, osuudet)
   - line_chart: kun näytetään kehitys ajan yli (trendi, ennuste)
   - table: kun tarvitaan teksti+luku-yhdistelmiä vertailussa. Iso taulukko (8+ riviä) → harkitse jakamista
   - gantt: projektin aikataulu
   - cards: 2-4 korttia (riskit, prioriteetit, päätökset) — värikoodattu vakavuuden mukaan
   - two-col: rinnakkaisvertailu (nykytila/tavoite, pros/cons)
   - bullets: kun sisältö on puhtaasti tekstiä ilman lukuja
   Vaihtele layouteja luontevasti sisällön mukaan.
9. Tarjoa 2 vaihtoehtoa — mutta kerro kumpi on suosituksesi ja miksi.
ÄLÄ KOSKAAN tuota [SLIDE_DATA] tai [STRUCTURE_DATA] tageja.`;
  return `You are an experienced project consultant at Gofore. ALWAYS communicate in English.
TODAY IS: ${today}.
ROLE: You collect content through conversation for an automatic PowerPoint or Word document generator AND ANALYZE the material.

CRITICAL RULE — USE OF SOURCE MATERIALS:
You will receive a SOURCE MATERIALS section containing user-uploaded files. READ THEM CAREFULLY.
- Use ONLY the names, numbers, prices and data from source materials. NEVER replace them with invented ones.
- If source material says "SensorTech Finland €195,000", use EXACTLY "SensorTech Finland" and "€195,000".
- If material is missing or unclear → ASK the user. NEVER fill in missing data by inventing it.
- VERIFY EVERY name, number and price from source materials before using it.

RULES:
1. NEVER invent data. Use ONLY provided materials. VERIFY every fact from materials.
2. Missing info → ASK.
3. Be concise.
4. Handle ONLY current topic.
5. NEVER GUESS dates or numbers. Unsure → use web search.
6. Be SOLUTION-ORIENTED: Analyze, compare, draw conclusions. Take a position and justify.
7. ALWAYS CALCULATE when data has numbers: ROI, payback, savings, comparisons. Show formula and result.
8. CHOOSE THE BEST LAYOUT based on content:
   - kpi: highlight 2-4 key numbers prominently (€, %, years) — summary or conclusion
   - bar_chart: compare numbers across options (prices, costs)
   - pie_chart: show how a whole breaks into parts (budget, shares)
   - line_chart: show change over time (trend, forecast)
   - table: text+number mix in comparisons. Large table (8+ rows) → consider splitting
   - gantt: project timeline
   - cards: 2-4 cards (risks, priorities, decisions) — color-coded by severity
   - two-col: side-by-side comparison (current/target, pros/cons)
   - bullets: pure text content without numbers
   Vary layouts naturally based on content.
9. Offer 2 options — but say which you recommend and why.
NEVER produce [SLIDE_DATA] or [STRUCTURE_DATA] tags.`;
}

// Tunnista milloin haku pitäisi aktivoida automaattisesti
const SEARCH_TRIGGERS = ["hae","etsi","googla","search","tarkista","verify","selvitä","tutki"];
function shouldSearch(text) {
  const lower = text.toLowerCase();
  // Eksplisiittiset triggerit
  if (SEARCH_TRIGGERS.some(t => lower.includes(t))) return true;
  // Päivämäärät ja ajankohdat — "maanantai", "toukokuussa", "viikolla 20"
  if (/(?:maanantai|tiistai|keskiviikk|torstai|perjantai|lauantai|sunnuntai|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(text)) return true;
  if (/(?:tammi|helmi|maalis|huhti|touko|kesä|heinä|elo|syys|loka|marras|joulu)kuu/i.test(text)) return true;
  if (/(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i.test(text)) return true;
  if (/viiko(?:lla|n|sta)\s*\d/i.test(text) || /week\s*\d/i.test(text)) return true;
  // Tarkka päivämäärä kuten "5.5." tai "2026-05-04"
  if (/\d{1,2}\.\d{1,2}\.(?:\d{2,4})?/.test(text) || /\d{4}-\d{2}-\d{2}/.test(text)) return true;
  // "ensimmäinen maanantai", "first monday", "viimeinen perjantai"
  if (/(?:ensimmäinen|toinen|kolmas|viimeinen|first|second|third|last)\s+(?:ma|ti|ke|to|pe|la|su|mon|tue|wed|thu|fri|sat|sun)/i.test(text)) return true;
  // Organisaatioiden tunnistus: "Oy", "Ab", "Oyj", "Ltd", "Inc", "GmbH", "Corp"
  if (/\b\w+\s+(?:oy[j]?|ab|ltd|inc|gmbh|corp|plc|as|ag|ry|sr)\b/i.test(text)) return true;
  // Tunnetut yritysnimet / merkit (yleisimmät suomalaiset + kansainväliset)
  if (/(?:gofore|accenture|tieto|eviden|cgi|solita|vincit|reaktor|futurice|siili|microsoft|google|amazon|aws|salesforce|sap|oracle)\b/i.test(text)) return true;
  return false;
}
const LAYOUT_DESC = {title:"otsikkodia",bullets:"bullet-lista",table:"taulukko",gantt:"Gantt-kaavio",cards:"korttiruudukko","two-col":"kaksipalstainen",bar_chart:"pylväskaavio",pie_chart:"piirakkakaavio",line_chart:"viivakaavio",kpi:"avainluvut"};

// ═══ FETCH WITH TIMEOUT + RETRY ═══
async function fetchWithRetry(url, options, { timeout = 90000, retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const r = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return r;
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === "AbortError";
      const isNetwork = err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError");
      if (attempt < retries && (isTimeout || isNetwork)) {
        console.log(`⏳ Retry ${attempt + 1}/${retries} (${isTimeout ? "timeout" : "network"})...`);
        await new Promise(ok => setTimeout(ok, 1000 * (attempt + 1))); // Backoff: 1s, 2s
        continue;
      }
      if (isTimeout) throw new Error("Yhteys aikakatkaistiin — yritä uudelleen.");
      throw err;
    }
  }
}

async function callAPI(messages, systemExtra, forceSearch, lang, profileInstructions, maxTokens) {
  let system = systemExtra ? getSystem(lang||"fi")+"\n\n"+systemExtra : getSystem(lang||"fi");
  if (profileInstructions) system += "\n\n═══ AGENTTIPROFIILI (käyttäjän lisäohjeet) ═══\n" + profileInstructions;
  // Tarkista kaikkien viimeisten viestien sisältö — ei vain viimeistä käyttäjäviestiä
  const recentTexts = messages.slice(-3).map(m => m.content).join(" ");
  const useSearch = forceSearch || shouldSearch(recentTexts);
  const payload = {messages,system,useSearch};
  if(maxTokens)payload.maxTokens=maxTokens;
  const r = await fetchWithRetry(API+"/api/chat",{
    method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},
    body:JSON.stringify(payload),
  }, { timeout: useSearch ? 120000 : 90000 }); // Search-kutsut saavat enemmän aikaa
  const d = await r.json();
  if(r.status===401){
    // Yritä automaattista uudelleenkirjautumista ennen reload:ia
    const relogged = await tryAutoRelogin();
    if (relogged) {
      // Toista alkuperäinen pyyntö uudella tokenilla
      const r2 = await fetchWithRetry(API+"/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},
        body:JSON.stringify(payload),
      }, { timeout: useSearch ? 120000 : 90000 });
      const d2 = await r2.json();
      if(r2.status===401) throw new Error("Istunto vanhentunut — kirjaudu uudelleen.");
      if(d2.error)throw new Error(d2.error);
      return d2.text;
    }
    throw new Error("Istunto vanhentunut — kirjaudu uudelleen.");
  }
  if(d.error)throw new Error(d.error);
  return d.text;
}

// Automaattinen uudelleenkirjautuminen
let _lastUserCreds = null; // { username, password }
async function tryAutoRelogin() {
  if (!_lastUserCreds) return false;
  try {
    const r = await fetch(API+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(_lastUserCreds)});
    const d = await r.json();
    if (d.token) { localStorage.setItem("pm_token", d.token); return true; }
  } catch {}
  return false;
}

// ═══ LASKUJEN VERIFIOINTI ═══
async function verifyNumbers(text) {
  try {
    const r = await fetchWithRetry(API+"/api/verify-numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": localStorage.getItem("pm_token") || "" },
      body: JSON.stringify({ text }),
    }, { timeout: 5000, retries: 0 });
    return await r.json();
  } catch { return { corrections: [], verified: true }; }
}

async function convertToJSON(slideLabel, layout, proposalText, lang) {
  const schemas = {
    title:'{"title":"...","tagline":"...","meta":"...","projectLead":"..."}',
    bullets:'{"heading":"...","bullets":["kohta 1","kohta 2"],"note":""}',
    table:'{"heading":"...","columns":["S1","S2","S3"],"rows":[["a","b","c"]],"cellColors":[["neutral","positive","negative"]]}  cellColors on VALINNAINEN: sama rakenne kuin rows, arvot: "positive" (vihreä), "negative" (punainen), "warning" (keltainen), "neutral" (ei väriä). Käytä kun soluissa on arvioita/vertailuja.',
    gantt:'{"heading":"...","totalWeeks":26,"phases":[{"name":"Suunnittelu","start":1,"end":4,"critical":true},{"name":"Kehitys","start":5,"end":16,"critical":true},{"name":"Testaus","start":14,"end":20,"critical":false}]}  KRIITTISTÄ: start/end OVAT KOKONAISLUKUJA (1=projektin 1. viikko). EI "2026-W14"! critical=true/false.',
    cards:'{"heading":"...","cards":[{"icon":"⚠️","title":"...","desc":"...","level":"high"}]}  level AINA englanniksi: "high" (punainen), "medium" (keltainen), "low" (vihreä).',
    "two-col":'{"heading":"...","left":{"title":"...","items":["..."]},"right":{"title":"...","items":["..."]}}',
    bar_chart:'{"heading":"...","categories":["Q1","Q2","Q3"],"series":[{"name":"Budjetti","values":[100,200,150]},{"name":"Toteutunut","values":[90,210,140]}],"unit":"EUR","note":""}',
    pie_chart:'{"heading":"...","slices":[{"label":"Osa A","value":40},{"label":"Osa B","value":35},{"label":"Osa C","value":25}],"unit":"%","note":""}',
    line_chart:'{"heading":"...","categories":["Kk1","Kk2","Kk3"],"series":[{"name":"Trendi","values":[10,25,40]}],"unit":"","note":""}',
    kpi:'{"heading":"...","kpis":[{"value":"€420k","label":"Investointi","desc":"NordCode Shopify Plus"},{"value":"2.3v","label":"Takaisinmaksu","desc":"ROI-laskelma"}],"note":""}',
  };
  let extra = "";
  if (layout === "gantt") extra = "\n\nGANTT KRIITTISTÄ: start ja end OVAT NUMEROITA 1-52 (suhteellinen viikko projektin alusta). EI ISO-viikkoja (2026-W14), EI päivämääriä! Esim: {\"totalWeeks\":26,\"phases\":[{\"name\":\"Vaihe 1\",\"start\":1,\"end\":4,\"critical\":true}]}. totalWeeks = projektin kokonaiskesto viikkoina. Max 15 vaihetta, nimet max 35 merkkiä.";
  else if (layout === "bar_chart") extra = "\n\nPYLVÄSKAAVIO: categories = X-akselin nimet. series = yksi tai useampi datasarja. values PITÄÄ olla lukuja (ei tekstiä). unit = yksikkö (EUR, %, kpl).";
  else if (layout === "pie_chart") extra = "\n\nPIIRAKKAKAAVIO: slices = 3-8 palaa. value = numeerinen arvo. Prosentit tai absoluuttiset luvut.";
  else if (layout === "line_chart") extra = "\n\nVIIVAKAAVIO: categories = X-akseli (ajanjaksot). series = trendilinjat. values = lukuja.";
  else if (layout === "kpi") extra = "\n\nKPI-LAYOUT: 2-4 avainlukua. Jokainen: value (iso luku, esim '€420k', '2.3v', '+30%'), label (lyhyt otsikko), desc (1 lause). Luvut ovat ISOJA — tee niistä vaikuttavia.";
  const r = await callAPI([{role:"user",content:
    `Muunna dian sisältö JSON-muotoon.\nDIA: "${slideLabel}" (${layout})\nSKEEMA: ${schemas[layout]||schemas.bullets}\n\nSISÄLTÖ:\n---\n${proposalText.substring(0,6000)}\n---\n\nVastaa VAIN JSON. ÄLÄ keksi uutta. JOKAINEN kohta/rivi/vaihe sisällöstä PITÄÄ olla JSON:ssa. ÄLÄ tiivistä. Luvut AINA numeroina (ei "420k" vaan 420000).${extra}`}],
    "Olet JSON-muunnin. Vastaa VAIN validilla JSON-objektilla.", false, lang);
  try {
    const m=r.match(/\{[\s\S]*\}/);
    if(m){
      let parsed=JSON.parse(m[0]);
      // POST-PROCESSING: Korjaa gantt ISO-viikot → suhteelliset numerot
      if(layout==="gantt"&&parsed.phases?.length>0){
        const hasIsoWeeks=parsed.phases.some(p=>typeof p.start==="string"&&/\d{4}-W\d+/.test(p.start));
        const hasDateStrings=parsed.phases.some(p=>typeof p.start==="string"&&!(/^\d+$/.test(p.start)));
        if(hasIsoWeeks||hasDateStrings){
          // Muunna ISO-viikot (2026-W14) tai muut merkkijonot → absoluuttiset viikkonumerot
          // Huomioi vuosi: 2026-W50 → 2026*52+50=105362, 2027-W02 → 2027*52+2=105406
          const toAbsWeek=(str)=>{
            if(typeof str!=="string")return parseInt(str)||1;
            const isoM=str.match(/(\d{4})-?W(\d+)/);
            if(isoM)return parseInt(isoM[1])*52+parseInt(isoM[2]);
            const wm=str.match(/W(\d+)/);
            if(wm)return parseInt(wm[1]);
            return parseInt(str)||1;
          };
          let minAbs=Infinity;
          const absWeeks=parsed.phases.map(p=>{
            const s=toAbsWeek(p.start),e=toAbsWeek(p.end);
            if(s<minAbs)minAbs=s;
            return{...p,start:s,end:e};
          });
          // Normalisoi: minimi = 1 (suhteellinen projektin alusta)
          parsed.phases=absWeeks.map(p=>({...p,start:p.start-minAbs+1,end:p.end-minAbs+1,critical:p.critical||p.status==="critical"||p.status==="kriittinen"}));
          const maxEnd=Math.max(...parsed.phases.map(p=>p.end));
          parsed.totalWeeks=Math.max(parsed.totalWeeks||0,maxEnd);
        }
        // Varmista numerot ja normalisoi kenttänimet
        parsed.phases=parsed.phases.map(p=>({
          name:p.name||p.title||"",
          start:parseInt(p.start)||1,
          end:parseInt(p.end)||parseInt(p.start)||1,
          // Tuki: critical=true TAI status="critical"
          critical:!!p.critical||p.status==="critical"||p.status==="kriittinen",
        }));
      }
      return parsed;
    }
  }catch(e){console.error("JSON:",e);}
  return null;
}

function strip(text) {
  let t=text;
  t=t.replace(/\[SLIDE_DATA:[\w_-]+\][\s\S]*?\[\/SLIDE_DATA\]/g,"");
  t=t.replace(/\[STRUCTURE_DATA\][\s\S]*?\[\/STRUCTURE_DATA\]/g,"");
  t=t.replace(/^.*\[(SLIDE_DATA|STRUCTURE_DATA|FOCUS_TYPE|JÄRJESTELMÄOHJE).*$/gm,"");
  t=t.replace(/##[\w_]+##/g,"");
  t=t.replace(/\n{3,}/g,"\n\n");
  return t.trim();
}

function isShortYes(text) {
  const t=text.trim().toLowerCase(),w=t.split(/\s+/);
  if(w.length>8)return false;
  // Normalisoi pitkät vokaalit: "jooo"→"joo", "okeeei"→"okei"
  const norm=t.replace(/(.)\1{2,}/g,"$1$1");
  const nw=norm.split(/\s+/);
  const yesWords=["ok","joo","kyllä","selvä","hyvä","sopii","käy","juu","yes","jep","okei","hyväksyn","edetään","siirrytään","toimii","mennään","jatketaan","eteenpäin","seuraava","kunnossa","valmis","done","sure","good","fine","approved","next","continue","proceed","kyl","jees","toki","ehdottomasti","absolutely","yep","yeah"];
  if(yesWords.some(x=>w.includes(x)||nw.includes(x)))return true;
  return["tämä käy","joo hyvä","tämä hyvä","mennään eteenpäin","näillä mennään","hyvältä näyttää","sopii hyvin","tämä sopii","looks good","let's go","that works","sounds good","tuo käy","se sopii","tuo sopii"].some(p=>t.includes(p)||norm.includes(p));
}

// Tunnista vaihtoehdon valinta: "1", "a", "vaihtoehto 1", "option b"
function isOptionSelect(text) {
  const t=text.trim().toLowerCase();
  if(/^[1-2ab]\.?$/.test(t))return t.replace(/\./,"");
  const m=t.match(/^(?:vaihtoehto|option|versio|valitsen)?\s*([1-2ab])/i);
  if(m)return m[1];
  if(/^(?:eka|ensimmäinen|first|ykkös)/i.test(t))return "1";
  if(/^(?:toka|toinen|second|kakkos)/i.test(t))return "2";
  return null;
}

// ═══ UI ═══
function Divider({text}){return(<div style={{display:"flex",alignItems:"center",gap:12,margin:"20px 0"}}><div style={{flex:1,height:1,background:G.silver}}/><span style={{background:G.light,border:"1px solid "+G.silver,borderRadius:20,padding:"3px 14px",fontSize:12,color:G.grey,fontWeight:600,whiteSpace:"nowrap"}}>{text}</span><div style={{flex:1,height:1,background:G.silver}}/></div>);}
function Bubble({role,content}){const ai=role==="assistant";return(<div style={{display:"flex",flexDirection:ai?"row":"row-reverse",gap:10,marginBottom:16,alignItems:"flex-start"}}><div style={{width:32,height:32,borderRadius:"50%",background:ai?G.deepBlue:G.orange,color:ai?G.orange:G.white,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,flexShrink:0,marginTop:2}}>{ai?"G":"P"}</div><div style={{maxWidth:"76%",background:ai?G.white:G.deepBlue,color:ai?G.deepBlue:G.white,borderRadius:ai?"3px 14px 14px 14px":"14px 3px 14px 14px",padding:"12px 16px",fontSize:14,lineHeight:1.65,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{content}</div></div>);}
function Pill({slide,status}){const cfg={pending:{bg:G.light,border:G.silver,color:G.grey,sub:""},proposing:{bg:"#FFF3EE",border:G.orange,color:G.orange,sub:"Ehdotettu"},confirming:{bg:"#E8F4FB",border:G.digitalBlue,color:G.digitalBlue,sub:"Odottaa"},done:{bg:"#E8FAF7",border:G.mint,color:G.mint,sub:"✓ Sovittu"}}[status]||{bg:G.light,border:G.silver,color:G.grey,sub:""};return(<div style={{background:cfg.bg,border:"1.5px solid "+cfg.border,borderRadius:10,padding:"8px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:15}}>{slide.icon||"📄"}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:cfg.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{slide.label}</div>{cfg.sub&&<div style={{fontSize:10,color:cfg.color,opacity:0.8}}>{cfg.sub}</div>}</div><div style={{width:7,height:7,borderRadius:"50%",background:cfg.border,flexShrink:0}}/></div>);}

// ═══ PÄÄKOMPONENTTI ═══
export default function AppWithErrorBoundary(){return <ErrorBoundary><App/></ErrorBoundary>;}
function App() {
  const [screen,setScreen]=useState("intro");
  const [lang,setLangState]=useState(localStorage.getItem("pm_lang")||"fi");
  const setLang=(l)=>{setLangState(l);localStorage.setItem("pm_lang",l);langRef.current=l;};
  const t=T[lang];
  const [authed,setAuthed]=useState(!!localStorage.getItem("pm_token"));
  const [currentUser,setCurrentUser]=useState(null);
  // Auth flow: "login" tai "register"
  const [authStep,setAuthStep]=useState("login");
  const [pwInput,setPwInput]=useState(""); const [pwError,setPwError]=useState(false);
  const [authUser,setAuthUser]=useState(""); const [authPw,setAuthPw]=useState(""); const [authPw2,setAuthPw2]=useState(""); const [authKey,setAuthKey]=useState("");
  const [authError,setAuthError]=useState("");
  const [msgs,setMsgs]=useState([]); const [input,setInput]=useState(""); const [busy,setBusy]=useState(false);
  const [slides,setSlides]=useState([]); const [slideIdx,setSlideIdx]=useState(0); const [statuses,setStatuses]=useState({});
  const [building,setBuilding]=useState(false);
  const [attachments,setAttachments]=useState([]); const [docContext,setDocContext]=useState("");
  const [focusType,setFocusType]=useState(""); const [dragOver,setDragOver]=useState(false);
  const [editingSlide,setEditingSlide]=useState(null);
  // Projektit & profiilit
  const [myProjects,setMyProjects]=useState([]);
  const [myProfiles,setMyProfiles]=useState([]);
  const [activeProfile,setActiveProfile]=useState(null);
  const activeProfileRef=useRef(null);
  const [currentProjectId,setCurrentProjectId]=useState(null);
  const [showProfileEditor,setShowProfileEditor]=useState(false);
  const [editProfile,setEditProfile]=useState({id:null,name:"",instructions:""});
  const [savingProject,setSavingProject]=useState(false);
  // User profile / settings
  const [showUserSettings,setShowUserSettings]=useState(false);
  const [changePwCurrent,setChangePwCurrent]=useState("");
  const [changePwNew,setChangePwNew]=useState("");
  const [changePwMsg,setChangePwMsg]=useState("");
  const [deleteAccountPw,setDeleteAccountPw]=useState("");
  const [deleteAccountStep,setDeleteAccountStep]=useState(false);
  // Project detail view
  const [showNewProjectModal,setShowNewProjectModal]=useState(false);
  const [newProjectName,setNewProjectName]=useState("");
  const currentProjectNameRef=useRef("");
  const [currentPresentationId,setCurrentPresentationId]=useState(null);
  const [projectPresentations,setProjectPresentations]=useState([]);
  const [projectContext,setProjectContext]=useState({});
  const projectContextRef=useRef({});
  // New presentation modal
  const [showNewPresModal,setShowNewPresModal]=useState(false);
  const [newPresName,setNewPresName]=useState("");
  const currentPresNameRef=useRef("");
  // Output type: "pptx" or "docx"
  const [outputType,setOutputType]=useState("pptx");
  const outputTypeRef=useRef("pptx");
  const [editingProjectName,setEditingProjectName]=useState(false);
  const [editProjNameVal,setEditProjNameVal]=useState("");
  const [newPresType,setNewPresType]=useState("pptx");

  const bottom=useRef();const fileInput=useRef();
  const collectedRef=useRef({});const proposingRef=useRef(false);
  const screenRef=useRef("intro");const slideIdxRef=useRef(0);
  const slidesRef=useRef([]);const focusTypeRef=useRef("");
  const pendingStructRef=useRef(null);const docContextRef=useRef("");
  const langRef=useRef(localStorage.getItem("pm_lang")||"fi");
  const lastProposalRef=useRef({});const summaryRef=useRef("");
  const decisionsRef=useRef([]);  // Isot päätökset: toimittajavalinnat, budjetti, aikataulu jne.

  useEffect(()=>{document.title="PM-Agent | Gofore";},[]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth"});},[msgs,busy]);

  // ═══ KEEPALIVE: Pidä backend hereillä + tarkista session ═══
  useEffect(()=>{
    if(!authed)return;
    let alive=true;
    const ping=async()=>{
      if(!alive)return;
      try{
        const r=await fetch(API+"/health",{signal:AbortSignal.timeout(5000)});
        if(!r.ok)console.warn("Health check failed:",r.status);
      }catch(e){console.warn("Keepalive ping failed:",e.message);}
      // Tarkista token voimassaolo — yritä auto-relogin ensin
      try{
        const r2=await fetch(API+"/api/auth/me",{
          headers:{"x-session-token":localStorage.getItem("pm_token")||""},signal:AbortSignal.timeout(5000)});
        if(r2.status===401){
          const ok=await tryAutoRelogin();
          if(!ok){localStorage.removeItem("pm_token");setAuthed(false);}
          else console.log("🔄 Token refreshed automatically");
        }
      }catch{}
    };
    // Ping heti ja sitten joka 4 min (token 8h, Render idle 15min)
    ping();
    const iv=setInterval(ping,4*60*1000);
    return()=>{alive=false;clearInterval(iv);};
  },[authed]);
  function setScreenSync(v){setScreen(v);screenRef.current=v;}
  function setSlideIdxSync(v){setSlideIdx(v);slideIdxRef.current=v;}
  const addMsg=useCallback((role,content)=>setMsgs(p=>[...p,{role,content}]),[]);
  const addDivider=useCallback((text)=>setMsgs(p=>[...p,{type:"divider",content:text}]),[]);
  const api=useCallback((msgs,extra,search,lang,maxTokens)=>callAPI(msgs,extra,search,lang||langRef.current,activeProfileRef.current?.instructions||"",maxTokens),[]);

  // ═══ SESSION RECOVERY: Tallenna tila localStorageen ═══
  function saveSession(){
    try{
      const state={
        screen:screenRef.current,
        slides:slidesRef.current,
        slideIdx:slideIdxRef.current,
        collected:collectedRef.current,
        statuses:Object.fromEntries(slidesRef.current.map(s=>[s.id,statuses[s.id]||"pending"])),
        summary:summaryRef.current,
        decisions:decisionsRef.current,
        docContext:docContextRef.current?.substring(0,12000),
        focus:focusTypeRef.current,
        proposals:lastProposalRef.current,
        ts:Date.now(),
      };
      localStorage.setItem("pm_session",JSON.stringify(state));
    }catch(e){console.warn("Session save failed:",e);}
  }
  function loadSession(){
    try{
      const raw=localStorage.getItem("pm_session");
      if(!raw)return null;
      const s=JSON.parse(raw);
      // Hylkää yli 24h vanhat sessiot
      if(Date.now()-s.ts>24*3600000){localStorage.removeItem("pm_session");return null;}
      return s;
    }catch{return null;}
  }
  function clearSession(){localStorage.removeItem("pm_session");}

  // Tarkista onko keskeneräinen sessio palautettavissa
  const [showRecover,setShowRecover]=useState(false);
  const savedSessionRef=useRef(null);
  useEffect(()=>{
    if(authed&&screen==="intro"){
      const saved=loadSession();
      if(saved&&saved.slides?.length>0&&["planning","review","structure","insights"].includes(saved.screen)){
        savedSessionRef.current=saved;
        setShowRecover(true);
      }
    }
  },[authed,screen]);
  function recoverSession(){
    const s=savedSessionRef.current;
    if(!s)return;
    slidesRef.current=s.slides;setSlides(s.slides);
    collectedRef.current=s.collected||{};
    summaryRef.current=s.summary||"";
    decisionsRef.current=s.decisions||[];
    docContextRef.current=s.docContext||"";
    focusTypeRef.current=s.focus||"";setFocusType(s.focus||"");
    lastProposalRef.current=s.proposals||{};
    setStatuses(s.statuses||{});
    setSlideIdxSync(s.slideIdx||0);
    // Palauta review-tilaan (turvallisin palautuspiste)
    setShowRecover(false);
    const fi=langRef.current==="fi";
    const list=s.slides.map((sl,i)=>`${i+1}. ${sl.icon||"📄"} ${sl.label}`).join("\n");
    const doneCount=Object.values(s.statuses||{}).filter(v=>v==="done").length;
    setMsgs([
      {type:"divider",content:fi?"🔄 Sessio palautettu":"🔄 Session recovered"},
      {role:"assistant",content:(fi?`Palautin edellisen session (${doneCount}/${s.slides.length} osaa valmiina):\n\n${list}\n\n`:`Recovered previous session (${doneCount}/${s.slides.length} parts done):\n\n${list}\n\n`)
        +(doneCount<s.slides.length?(fi?"Jatketaan siitä mihin jäätiin. Kirjoita 'valmis' ladataksesi.":"Let's continue where we left off. Type 'done' to download.")
        :(fi?"Kaikki valmiina! Kirjoita 'valmis' ladataksesi.":"All done! Type 'done' to download."))},
    ]);
    setScreenSync("review");
  }

  function buildContext(){
    let c="";
    if(summaryRef.current)c+=summaryRef.current+"\n\n";
    if(decisionsRef.current.length>0)c+="═══ TEHDYT PÄÄTÖKSET (EHDOTTOMAT — ÄLÄ MUUTA) ═══\n"+decisionsRef.current.map((d,i)=>(i+1)+". "+d).join("\n")+"\n═══════════════════════════════════\n\n";
    if(docContextRef.current)c+="LÄHDEMATERIAALIT:\n"+docContextRef.current.substring(0,12000)+"\n\n";
    if(focusTypeRef.current)c+="FOKUS: "+focusTypeRef.current+"\n\n";
    return c;
  }
  function recentMessages(n){const all=msgs.filter(m=>m.role==="user"||m.role==="assistant");return all.slice(-(n*2)).map(m=>({role:m.role,content:m.content}));}
  function updateSummary(note){
    summaryRef.current=(summaryRef.current?summaryRef.current+"\n":"")+note;
    // Rajoita kontekstin kasvua: jos yli 5000 merkkiä, tiivistä alku
    if(summaryRef.current.length>5000){
      const lines=summaryRef.current.split("\n");
      // Pidä viimeiset 2/3 ja tiivistä alku
      const keep=Math.max(Math.floor(lines.length*0.66),3);
      summaryRef.current="[Aiempi konteksti tiivistetty]\n"+lines.slice(-keep).join("\n");
    }
  }
  function addDecision(decision){if(!decisionsRef.current.includes(decision))decisionsRef.current=[...decisionsRef.current,decision];}

  // ═══ VAIHE 1 ═══
  function startInterview(projectName){if(projectName)currentProjectNameRef.current=projectName;setScreenSync("interview");setMsgs([{type:"divider",content:T[langRef.current].phases.interview},{role:"assistant",content:T[langRef.current].greeting}]);}

  async function runInterview(userText,ctx){
    const extra=ctx||docContextRef.current;
    if(extra&&extra.length>100){addMsg("assistant",T[langRef.current].materialThanks);updateSummary("HAASTATTELU: materiaali annettu");await runFocusAsk();return;}
    const r=await api([...recentMessages(3),{role:"user",content:userText},{role:"user",content:"[JÄRJESTELMÄOHJE] Riittävätkö tiedot? KYLLÄ→tiivistä+##READY_TO_PLAN##. EI→kysy YKSI kysymys."}],"VAIHE: Haastattelu.\n"+buildContext());
    addMsg("assistant",strip(r));
    if(r.includes("##READY_TO_PLAN##")){updateSummary("HAASTATTELU: "+strip(r).substring(0,300));await runFocusAsk();}
  }

  // ═══ VAIHE 2 ═══
  async function runFocusAsk(){
    setScreenSync("focus");addDivider("🎯 "+T[langRef.current].phases.focus);
    const fi=langRef.current==="fi";
    const focusPrompt=fi
      ?"Kerro 1 lauseella projektista ja kysy fokus:\n1. 📋 Yleinen projektisuunnitelma\n2. ⚠️ Riskianalyysi\n3. 📅 Aikataulukatsaus\n4. 🚀 Kickoff\n5. 👥 Sidosryhmäraportti\n6. 🔍 Muu"
      :"Describe the project in 1 sentence and ask which type of presentation to create:\n1. 📋 General project plan\n2. ⚠️ Risk analysis\n3. 📅 Timeline overview\n4. 🚀 Kickoff\n5. 👥 Stakeholder report\n6. 🔍 Other";
    const r=await api([{role:"user",content:focusPrompt}],(fi?"VAIHE: Fokus.":"PHASE: Focus.")+"\n"+buildContext());
    addMsg("assistant",strip(r));
  }

  async function runFocusConfirm(userText){
    const fi=langRef.current==="fi";
    // Eristä fokusvalinta tiedostosisällöstä: ota vain ensimmäinen rivi
    const firstLine=userText.trim().split("\n")[0].trim();
    const lower=firstLine.toLowerCase();
    // Tarkista onko tämä oikeasti fokusvalinta vai jotain muuta
    const isFocusChoice=/^[1-6]\.?$/.test(lower) ||
      ["projektisuunnitelma","riskianalyysi","aikataulu","kickoff","sidosryhmä","muu",
       "project plan","risk analysis","timeline","stakeholder","other"].some(w=>lower.includes(w));

    if(!isFocusChoice){
      // Ei ole fokusvalinta — voi olla kielitoive, kysymys tms. Lähetä takaisin AI:lle
      const r=await api([...recentMessages(2),{role:"user",content:userText}],
        (fi?"VAIHE: Fokus. Käyttäjä ei valinnut fokusta. Vastaa hänen viestiinsä ja kysy fokus uudelleen."
          :"PHASE: Focus. User did not choose a focus. Respond to their message and ask for focus again.")+"\n"+buildContext());
      addMsg("assistant",strip(r));
      return;  // Jää focus-vaiheeseen
    }

    const focusLabel=firstLine.substring(0,100);setFocusType(focusLabel);focusTypeRef.current=focusLabel;
    updateSummary("FOKUS: "+userText.trim());
    setScreenSync("insights");addDivider("🔍 "+(fi?"Vaihe 3":"Phase 3"));
    const insightPrompt=fi
      ?`Fokus: "${userText.trim()}"\n\nAnalysoi materiaali ja listaa 4-6 HAVAINTOA:\n- Jokaisessa havainnossa: FAKTA + JOHTOPÄÄTÖS + SUOSITUS/KYSYMYS\n- Jos materiaalissa on valintoja tai vaihtoehtoja → ota kantaa, kerro suosituksesi\n- Jos löydät ristiriitoja tai puutteita → nosta ne esiin\n- Jos datassa on lukuja → laske: ROI, takaisinmaksu, vertailut\n- ÄLÄ vain toista mitä materiaalissa lukee — ANALYSOI\n\nÄLÄ ehdota diarakennetta. Kysy: "Hyväksytkö nämä havainnot?"`
      :`Focus: "${userText.trim()}"\n\nAnalyze material and list 4-6 INSIGHTS:\n- Each: FACT + CONCLUSION + RECOMMENDATION/QUESTION\n- If choices/alternatives → take a position, give recommendation\n- If contradictions or gaps → raise them\n- If numbers → calculate: ROI, payback, comparisons\n- Don't just restate the material — ANALYZE\n\nDon't suggest slide structure. Ask: "Do you approve these insights?"`;
    const r=await api([{role:"user",content:insightPrompt}],"VAIHE: Havainnot.\n"+buildContext());
    const insightText=strip(r);
    addMsg("assistant",insightText);
    // Tarkista AI:n laskelmat oikealla matematiikalla
    const numCheck=await verifyNumbers(insightText);
    if(!numCheck.verified&&numCheck.corrections?.length>0){
      const fi=langRef.current==="fi";
      const fixes=numCheck.corrections.map(c=>
        `• ${c.expression} → oikea tulos: ${c.actual} (AI sanoi: ${c.claimed})`).join("\n");
      addMsg("assistant",(fi?"⚠️ Laskuvirheitä havaittu:\n":"⚠️ Calculation errors found:\n")+fixes+
        (fi?"\n\nKorjaan nämä automaattisesti lopullisiin dioihin.":"\n\nThese will be auto-corrected in final slides."));
    }
  }

  // ═══ VAIHE 3 ═══
  async function runInsightsConfirm(userText){
    if(isShortYes(userText)){
      addMsg("assistant",T[langRef.current].moveToStructure);
      const lastAi=msgs.filter(m=>m.role==="assistant").slice(-2).map(m=>m.content).join("\n");
      updateSummary("HAVAINNOT:\n"+lastAi.substring(0,500));
      // Etsi päätökset havainnoista
      try{
        const dr=await api([{role:"user",content:
          `Alla on projektin havainnot. Listaa VAIN konkreettiset päätökset/valinnat/suositukset jotka on tehty (esim. valittu toimittaja, budjettiraja, teknologia, deadline). Yksi per rivi. Jos päätöksiä ei ole, vastaa "EI PÄÄTÖKSIÄ".\n\n${lastAi.substring(0,1500)}`}],
          "Vastaa vain lista päätöksistä, ei mitään muuta.",false,langRef.current);
        if(dr&&!dr.includes("EI PÄÄTÖKSIÄ")){dr.split("\n").filter(l=>l.trim().length>5&&!l.startsWith("EI")).forEach(d=>addDecision(d.replace(/^[-•*\d.)\s]+/,"")));}
      }catch(e){console.log("Decision extract:",e);}
      await runStructureAsk();return;
    }
    const fi=langRef.current==="fi";
    const r=await api([...recentMessages(3),{role:"user",content:userText},{role:"user",content:
      fi?"[JÄRJESTELMÄOHJE] Päivitä havainnot. ÄLÄ ehdota diarakennetta. Jos et ymmärrä käyttäjän pyyntöä, KYSY mitä hän haluaa."
        :"[SYSTEM] Update insights. Do NOT suggest slide structure. If unclear, ASK what the user wants."}],
      "VAIHE: Havainnot.\n"+buildContext());
    addMsg("assistant",strip(r));
  }

  // ═══ VAIHE 4 ═══
  async function runStructureAsk(){
    const isDocx=outputTypeRef.current==="docx";
    setScreenSync("structure");addDivider(isDocx?"📐 Vaihe 4 — Dokumentin rakenne":"📐 Vaihe 4 — Diarakenne");
    const fi=langRef.current==="fi";
    let structPrompt;
    if(isDocx){
      // Word-dokumentin lukurakenne
      structPrompt=fi
        ?`Ehdota KAKSI lukurakennevaihtoehtoa Word-dokumentille fokuksella "${focusTypeRef.current}":\n**A: Tiivis (4-7 lukua)** — tiivistelmä, johdon lukuun\n**B: Kattava (8-12 lukua)** — yksityiskohtainen dokumentti\n\nMitoita materiaalin laajuuden mukaan. Max 12 lukua.\n\n1. luku AINA: 1. 🎯 Kansilehti - title\nJokainen rivi: numero + emoji + otsikko - tyyppi\n\nLUKUTYYPIT:\n- title: kansilehti (dokumentin nimi, tekijä, pvm)\n- text: tekstikappaleita — yksityiskohtainen sisältö, analyysit, kuvaukset\n- table: taulukko — vertailut, matriisit, kustannuslaskelmat\n- list: numeroidut/bulletoidut listat — toimenpiteet, vaatimukset, suositukset\n- summary: tiivistelmä — avainluvut ja johtopäätökset\n\nWord-dokumentissa PAINOPISTE on TEKSTISSÄ. Jokainen luku sisältää yksityiskohtaisia kappaleita, ei pelkkiä bullet-pointteja.\n\nKysy: "Kumpi sopii, vai haluatko tietyn määrän lukuja?"`
        :`Propose TWO chapter structure options for Word document with focus "${focusTypeRef.current}":\n**A: Compact (4-7 chapters)** — executive summary\n**B: Comprehensive (8-12 chapters)** — detailed document\n\nScale to material. Max 12 chapters.\n\nChapter 1 ALWAYS: 1. 🎯 Cover page - title\nEach row: number + emoji + heading - type\n\nCHAPTER TYPES:\n- title: cover page (doc name, author, date)\n- text: paragraphs — detailed content, analysis, descriptions\n- table: tables — comparisons, matrices, cost calculations\n- list: numbered/bullet lists — actions, requirements, recommendations\n- summary: summary — key figures and conclusions\n\nWord document FOCUSES on TEXT. Each chapter has detailed paragraphs, not just bullet points.\n\nAsk: "Which one, or specific number of chapters?"`;
    }else{
      structPrompt=fi
        ?`Ehdota KAKSI diarakennevaihtoehtoa fokukselle "${focusTypeRef.current}":\n**A: Tiivis (4-7 diaa)** — johtoryhmälle, tiivistelmä\n**B: Kattava (8-15 diaa)** — yksityiskohtainen suunnitelma\n\nMitoita materiaalin laajuuden mukaan. Max 15 diaa.\n\n1. dia AINA: 1. 🎯 Kansi - title\nJokainen rivi: numero + emoji + nimi - layout\n\nLAYOUT-OPAS — valitse sisällön perusteella:\n- kpi: korostaa 2-4 avainlukua isolla (€420k, +30%, 2.3v) — toimii tiivistelmänä tai johtopäätöksenä\n- bar_chart: vertailee lukuja vaihtoehtojen välillä (hinnat, kustannukset, resurssit)\n- pie_chart: näyttää miten kokonaisuus jakautuu osiin (budjettierittely, osuudet)\n- line_chart: näyttää kehityksen ajan yli (kustannustrendi, ennuste)\n- table: teksti+luku-yhdistelmä vertailussa (ominaisuusmatriisi, arviointiruudukko). Iso taulukko (8+ riviä) → harkitse jakamista kahdelle dialle\n- gantt: projektin aikataulu ja vaiheet\n- cards: 2-4 korttia joissa otsikko+kuvaus+vakavuus (riskit, haasteet, mahdollisuudet)\n- two-col: rinnakkaisvertailu (nykytila vs. tavoite, pros/cons, vaihtoehto A/B)\n- bullets: puhdas teksti ilman lukuja (toimenpiteet, yhteenveto, seuraavat askeleet)\n\nISO AIHE voi tarvita useamman dian, esim:\n- Toimittajavertailu: hintavertailu (bar_chart) + ominaisuudet (table) + suositus (two-col)\n- Riskianalyysi: yleiskuva (cards) + yksityiskohtainen taulukko (table)\n- Budjetti: kokonaiskuva (kpi) + erittely (bar_chart tai pie_chart)\n- ROI: avainluvut (kpi) + kehitys vuosittain (line_chart)\n\nVaihtele layouteja luontevasti — älä toista samaa turhaan, mutta älä myöskään pakota vaihtelua jos sama layout sopii parhaiten.\n\nKysy: "Kumpi sopii, vai haluatko tietyn määrän dioja?"`
        :`Propose TWO slide structure options for "${focusTypeRef.current}":\n**A: Compact (4-7 slides)** — executive summary\n**B: Comprehensive (8-15 slides)** — detailed plan\n\nScale to material scope. Max 15 slides.\n\nSlide 1 ALWAYS: 1. 🎯 Cover - title\nEach row: number + emoji + name - layout\n\nLAYOUT GUIDE — choose based on content:\n- kpi: highlight 2-4 key numbers prominently (€420k, +30%, 2.3y) — works as summary or conclusion\n- bar_chart: compare numbers across options (prices, costs, resources)\n- pie_chart: show how a whole breaks into parts (budget breakdown, market shares)\n- line_chart: show change over time (cost trend, forecast)\n- table: text+number mix in comparison (feature matrix, evaluation grid). Large table (8+ rows) → consider splitting across slides\n- gantt: project timeline and phases\n- cards: 2-4 cards with title+description+severity (risks, challenges, opportunities)\n- two-col: side-by-side comparison (current vs. target, pros/cons, option A/B)\n- bullets: pure text without numbers (actions, summary, next steps)\n\nBIG TOPICS may need multiple slides, e.g.:\n- Vendor comparison: price comparison (bar_chart) + features (table) + recommendation (two-col)\n- Risk analysis: overview (cards) + detailed analysis (table)\n- Budget: overview (kpi) + breakdown (bar_chart or pie_chart)\n- ROI: key numbers (kpi) + trend over years (line_chart)\n\nVary layouts naturally — don't repeat unnecessarily, but don't force variety if the same layout genuinely fits best.\n\nAsk: "Which one, or do you want a specific number of slides?"`;
    }

    const r=await api([{role:"user",content:structPrompt}],(isDocx?"VAIHE: Dokumentin rakenne.\n":"VAIHE: Diarakenne.\n")+buildContext());
    const s=tryParseStructure(strip(r)); if(s)pendingStructRef.current=s;
    addMsg("assistant",strip(r));
  }

  function tryParseStructure(text){
    const clean=text.replace(/\*{1,2}/g,"");
    const allLines=clean.split("\n").filter(l=>/^\s*\d+[\.\)]\s/.test(l));
    if(!allLines.length)return null;
    const lines=[];let seen=false;
    for(const line of allLines){const n=parseInt(line.trim());if(n===1&&seen)break;seen=true;lines.push(line);}
    const kw={kansi:"title",aikataulu:"gantt",gantt:"gantt",taulukko:"table",table:"table",riski:"cards",cards:"cards","two-col":"two-col",pylväs:"bar_chart",bar_chart:"bar_chart",piirakka:"pie_chart",pie_chart:"pie_chart",viiva:"line_chart",line_chart:"line_chart",budjetti:"bar_chart",kustannus:"bar_chart",jakauma:"pie_chart",trendi:"line_chart",kpi:"kpi",avainluku:"kpi",tunnusluku:"kpi",roi:"kpi",metric:"kpi"};
    return lines.map((line,i)=>{
      const iconM=line.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
      const stripped=line.replace(/^\s*\d+[\.\)]\s*/,"").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,"").trim();
      const parts=stripped.split(/\s*[-–—]\s*/);const label=parts[0]?.trim()||"Dia "+(i+1);
      const id=label.toLowerCase().replace(/[^a-zäöå0-9]/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"")||"dia_"+(i+1);
      const layoutM=line.match(/[-–—]\s*(title|bullets|table|gantt|cards|two-col|bar_chart|pie_chart|line_chart|kpi)/i)||line.match(/\((title|bullets|table|gantt|cards|two-col|bar_chart|pie_chart|line_chart|kpi)\)/i);
      let layout=layoutM?layoutM[1].toLowerCase():"bullets";
      if(!layoutM){for(const[k,v]of Object.entries(kw)){if(line.toLowerCase().includes(k)){layout=v;break;}}}
      if(i===0&&/kansi|cover/i.test(line))layout="title";
      const layoutIcons={title:"🎯",bullets:"📋",table:"📊",gantt:"📅",cards:"⚠️","two-col":"📑",bar_chart:"📊",pie_chart:"🥧",line_chart:"📈",kpi:"🔢"};
      return{id,label,icon:iconM?iconM[1]:(layoutIcons[layout]||"📄"),layout};
    });
  }

  const MAX_SLIDES=15;
  function ensureKansi(s){
    if(!s?.length)return[{id:"kansi",label:"Kansi",icon:"🎯",layout:"title"}];
    let r=s[0].layout==="title"?s:[{id:"kansi",label:"Kansi",icon:"🎯",layout:"title"},...s];
    if(r.length>MAX_SLIDES){console.warn("Slide limit:",r.length,"→",MAX_SLIDES);r=r.slice(0,MAX_SLIDES);}
    return r;
  }

  async function runStructureConfirm(userText){
    const has=pendingStructRef.current?.length>0;
    const optChoice=isOptionSelect(userText);
    const fi=langRef.current==="fi";

    // Suora hyväksyntä ("ok", "joo") — käytä tallennettua, MUTTA näytä mitä rakennetaan
    if(isShortYes(userText)&&has){
      const confirmed=ensureKansi(pendingStructRef.current);
      const list=confirmed.map((s,i)=>`${i+1}. ${s.icon} ${s.label} (${s.layout})`).join("\n");
      addMsg("assistant",(fi?"Rakennetaan tämä:\n":"Building this:\n")+list);
      addMsg("assistant",T[langRef.current].structureConfirmed);
      updateSummary("RAKENNE: "+confirmed.map(s=>s.label+"("+s.layout+")").join(", "));
      startPlanning(confirmed);return;
    }

    // Mikä tahansa muu — vaihtoehdon valinta, vapaa muutos, "kattavampi", "B", jne.
    const isDocx=outputTypeRef.current==="docx";
    const modifyPrompt=fi
      ?(isDocx
        ?`Käyttäjän valinta/muutos: "${userText}"\n\nNäytä LOPULLINEN lukurakenne yhtenä numeroiduna listana. VAIN YKSI lista. Kansilehti AINA 1. Jokainen rivi: numero + emoji + nimi - tyyppi\n\nTyypit: title, text, table, list, summary\nKäyttäjä voi pyytää tiettyä lukumäärää.`
        :`Käyttäjän valinta/muutos: "${userText}"\n\nNäytä LOPULLINEN diarakenne yhtenä numeroiduna listana. VAIN YKSI lista. Kansi AINA 1. Jokainen rivi: numero + emoji + nimi - layout\n\nLayoutit: title, bullets, table, gantt, cards, two-col, bar_chart, pie_chart, line_chart, kpi\nKäytä monipuolisesti. Iso aihe → jaa 2-3 diaan.`)
      :(isDocx
        ?`User choice/modification: "${userText}"\n\nShow FINAL chapter structure as ONE numbered list. Cover always 1. Each row: number + emoji + name - type\n\nTypes: title, text, table, list, summary`
        :`User choice/modification: "${userText}"\n\nShow FINAL slide structure as ONE numbered list. Cover always 1. Each row: number + emoji + name - layout\n\nLayouts: title, bullets, table, gantt, cards, two-col, bar_chart, pie_chart, line_chart, kpi\nUse variety. Big topics → split into 2-3 slides.`);
    const r=await api([...recentMessages(3),{role:"user",content:modifyPrompt}],(isDocx?"VAIHE: Dokumentin rakenne.\n":"VAIHE: Diarakenne.\n")+buildContext());
    const parsed=tryParseStructure(strip(r));
    if(parsed&&parsed.length>0){
      pendingStructRef.current=parsed;
      addMsg("assistant",strip(r));
      addMsg("assistant",fi?"Hyväksytkö tämän rakenteen? (kyllä/muokkaa lisää)":"Approve this structure? (yes/modify more)");
    }else{
      // Parsinta epäonnistui — pyydä uudelleen selkeämmässä muodossa
      addMsg("assistant",strip(r));
      addMsg("assistant",fi?"En saanut rakennetta selville. Voitko valita uudelleen?":"Couldn't parse the structure. Can you choose again?");
    }
  }

  // ═══ VAIHE 5 ═══
  function startPlanning(confirmed){
    setSlides(confirmed);slidesRef.current=confirmed;
    setStatuses(Object.fromEntries(confirmed.map(s=>[s.id,"pending"])));
    const isDocx=outputTypeRef.current==="docx";
    if(isDocx){
      // Word: siirry syvennysvaiheeseen — ei luku kerrallaan
      startDeepDive(confirmed);
    }else{
      // PPTX: dia kerrallaan kuten ennenkin
      setScreenSync("planning");setSlideIdxSync(0);
      addDivider("📄 Vaihe 5 — Sisällöntuotanto");
      setTimeout(saveSession,50);
      setTimeout(()=>proposeSlide(0,confirmed),100);
    }
  }

  // ═══ WORD: SYVENNYSVAIHE ═══
  async function startDeepDive(confirmed){
    const fi=langRef.current==="fi";
    setScreenSync("deepdive");
    addDivider(fi?"🔍 Vaihe 5 — Tarkennukset":"🔍 Phase 5 — Deep dive");
    const chapterList=confirmed.map((ch,i)=>`${i+1}. ${ch.icon} ${ch.label} (${ch.layout})`).join("\n");
    const prompt=fi
      ?`Dokumentin rakenne on:\n${chapterList}\n\nEnnen kirjoittamista, kysy 3 KOHDENNETTUA tarkentavaa kysymystä joiden avulla voit kirjoittaa paremman dokumentin. Kysymysten pitää liittyä sisältöön — esim.:\n- Mitä lukuja/datapisteitä korostetaan?\n- Kuka on pääasiallinen lukija?\n- Onko tiettyjä päätöksiä tai suosituksia joita pitää tuoda esiin?\n- Dokumentin sävy: johtotaso-tiivistelmä vai yksityiskohtainen?\n\nKysy kaikki 3 kerralla numeroidusti.`
      :`Document structure:\n${chapterList}\n\nBefore writing, ask 3 TARGETED clarifying questions to write a better document. Questions should be about content — e.g.:\n- What data points/metrics to emphasize?\n- Who is the primary reader?\n- Any specific decisions or recommendations to highlight?\n- Tone: executive summary or detailed analysis?\n\nAsk all 3 at once, numbered.`;
    const r=await api([{role:"user",content:prompt}],"VAIHE: Tarkennukset ennen kirjoitusta.\n"+buildContext());
    addMsg("assistant",strip(r));
    setTimeout(saveSession,50);
  }

  // Käsittele syvennysvaiheen vastaus → kirjoita koko dokumentti
  async function runDeepDiveConfirm(userText){
    const fi=langRef.current==="fi";
    // Tallenna vastaukset kontekstiin
    updateSummary("TARKENNUKSET: "+userText);
    addMsg("assistant",fi?"Kiitos! Kirjoitan nyt koko dokumentin...":"Thanks! Now writing the full document...");
    await runDocumentWrite();
  }

  // ═══ WORD: KOKO DOKUMENTIN KIRJOITUS ═══
  async function runDocumentWrite(){
    const fi=langRef.current==="fi";
    setScreenSync("writing");
    addDivider(fi?"✍️ Vaihe 6 — Dokumentin kirjoitus":"✍️ Phase 6 — Document writing");
    const chapterList=slidesRef.current.map((ch,i)=>`${i+1}. ${ch.label} (${ch.layout})`).join("\n");
    const prompt=fi
      ?`Kirjoita KOKO dokumentti yhtenä koherenttina tekstinä.\n\nLukurakenne:\n${chapterList}\n\nSÄÄNNÖT:\n- Käytä # -otsikkoja luvuille\n- Jokainen luku: 2-5 yksityiskohtaista kappaletta\n- Analysoi, perustele, tee johtopäätöksiä — älä vain listaa\n- Jos lukuja → laske ja näytä kaavat\n- Ammattimainen, asiantunteva sävy\n- Loogiset siirtymät lukujen välillä\n- Taulukot markdown-muodossa (| sarake1 | sarake2 |)\n- Tämän pitää olla VALMIS, julkaisuvalmis teksti\n\nKirjoita kaikki luvut kerralla. Aloita suoraan sisällöstä.`
      :`Write the ENTIRE document as one coherent text.\n\nChapter structure:\n${chapterList}\n\nRULES:\n- Use # headers for chapters\n- Each chapter: 2-5 detailed paragraphs\n- Analyze, justify, draw conclusions — don't just list\n- If numbers → calculate and show formulas\n- Professional, expert tone\n- Logical transitions between chapters\n- Tables in markdown (| col1 | col2 |)\n- Must be COMPLETE, publication-ready text\n\nWrite all chapters at once. Start directly with content.`;
    const r=await api([{role:"user",content:prompt}],"VAIHE: Dokumentin kirjoitus. Kirjoita KOKO dokumentti.\n"+buildContext(),false,null,8000);
    const docText=strip(r);
    lastProposalRef.current["full_document"]=docText;
    // Merkitse kaikki luvut tehdyiksi
    setStatuses(prev=>{const n={...prev};slidesRef.current.forEach(s=>{n[s.id]="done";});return n;});
    addMsg("assistant",docText);
    addMsg("assistant",fi
      ?"Dokumentti on valmis! Voit:\n• Kommentoida muutoksia → kirjoitan uudelleen\n• Kirjoittaa **\"valmis\"** → lataan Word-tiedostona"
      :"Document is ready! You can:\n• Comment changes → I'll rewrite\n• Type **\"done\"** → download as Word file");
    setTimeout(saveSession,100);
  }

  // Käsittele dokumentin muokkaus writing-vaiheessa
  async function runDocumentEdit(userText){
    const fi=langRef.current==="fi";
    const currentDoc=lastProposalRef.current["full_document"]||"";
    if(["valmis","generoi","lataa","done","generate","download","finish"].some(w=>userText.trim().toLowerCase().includes(w))){
      doDownload();return;
    }
    addMsg("assistant",fi?"Muokataan dokumenttia...":"Editing document...");
    const prompt=fi
      ?`Dokumentin nykyinen versio:\n---\n${currentDoc}\n---\n\nKäyttäjän muutospyyntö: "${userText}"\n\nTee pyydetyt muutokset ja näytä KOKO päivitetty dokumentti. Säilytä # -otsikot ja markdown-muotoilu.`
      :`Current document:\n---\n${currentDoc}\n---\n\nUser's change request: "${userText}"\n\nMake the requested changes and show the FULL updated document. Keep # headers and markdown formatting.`;
    const r=await api([{role:"user",content:prompt}],"VAIHE: Dokumentin muokkaus.\n"+buildContext(),false,null,8000);
    const updated=strip(r);
    lastProposalRef.current["full_document"]=updated;
    addMsg("assistant",updated);
    addMsg("assistant",fi?"Muutokset tehty. Kommentoi lisää tai kirjoita \"valmis\" ladataksesi.":"Changes made. Comment more or type \"done\" to download.");
    setTimeout(saveSession,100);
  }

  async function proposeSlide(idx,slidesArr){
    if(proposingRef.current)return;proposingRef.current=true;
    try{
      const cur=slidesArr||slidesRef.current;setSlideIdxSync(idx);
      setStatuses(prev=>{const n={...prev};cur.forEach((s,i)=>{if(i===idx)n[s.id]="proposing";else if(n[s.id]!=="done")n[s.id]="pending";});return n;});
      const slide=cur[idx];const fi=langRef.current==="fi";
      // Layout-kohtaiset ohjeet
      const layoutPrompts={
        title:fi?"Ehdota kansidian sisältö:\n- Otsikko (lyhyt, vaikuttava)\n- Tagline (1 lause joka tiivistää projektin arvon)\n- Meta (pvm | org)\n- Projektipäällikkö"
          :"Propose title slide:\n- Title (short, impactful)\n- Tagline (1 sentence summarizing project value)\n- Meta (date | org)\n- Project lead",
        table:fi?`Ehdota TAULUKKO dialle "${slide.label}".\n\nSÄÄNNÖT:\n- MAX 7 riviä! Jos enemmän dataa → tiivistä olennaisimpaan tai ehdota jakoa 2 diaan\n- Sarakkeet vertailua varten, konkreettisia lukuja\n- Jos vertaillaan VAIN lukuja (€, %, kpl) → EHDOTA bar_chart sen sijaan!\n- Lisää cellColors: merkitse hyvät "positive" (vihreä), huonot "negative" (punainen), keskitaso "warning" (keltainen)\n- Johtopäätös/suositus dian lopussa`
          :`Propose TABLE for "${slide.label}".\n\nRULES:\n- MAX 7 rows! If more data → condense to essentials or suggest splitting\n- If comparing ONLY numbers (€, %, count) → SUGGEST bar_chart instead!\n- Add cellColors: mark good as "positive" (green), bad as "negative" (red), mid as "warning" (yellow)\n- Conclusion/recommendation at end`,
        gantt:fi?`Ehdota Gantt-kaavio dialle "${slide.label}".\nKAIKKI vaiheet (start/end viikkoina), kriittinen polku, riippuvuudet.`
          :`Propose Gantt chart for "${slide.label}".\nALL phases (start/end in weeks), critical path, dependencies.`,
        cards:fi?`Ehdota kortit dialle "${slide.label}".\nIkoni, otsikko, kuvaus, vakavuus. ANALYSOI ja priorisoi. Mitigaatio jokaiselle.`
          :`Propose cards for "${slide.label}".\nIcon, title, description, severity. ANALYZE and prioritize. Mitigation for each.`,
        "two-col":fi?`Ehdota kaksipalstainen dia "${slide.label}".\nVertailu: pros/cons, nykytila/tavoite, vaihtoehto A/B.`
          :`Propose two-column slide "${slide.label}".\nComparison: pros/cons, current/target, option A/B.`,
        bar_chart:fi?`Ehdota PYLVÄSKAAVIO dialle "${slide.label}".\n\nPYLVÄSKAAVION PITÄÄ sisältää:\n- Kategoriat (X-akseli): esim. toimittajat, kvartaalit, kustannuserät\n- 1-3 datasarjaa: esim. "Budjetti" ja "Toteutunut"\n- Luvut EUROINA tai prosentteina — EI tekstiä\n- Kerro mitä kaavio osoittaa: johtopäätös 1 lauseessa\n\nNäytä data selkeästi: "Kategoria: arvo1 / arvo2"`
          :`Propose BAR CHART for "${slide.label}".\n\nMUST include:\n- Categories (X-axis): e.g. vendors, quarters, cost items\n- 1-3 data series: e.g. "Budget" and "Actual"\n- Numbers in EUR or percentages — NOT text\n- State what the chart shows: conclusion in 1 sentence`,
        pie_chart:fi?`Ehdota PIIRAKKAKAAVIO dialle "${slide.label}".\n\n3-8 osaa, jokainen: nimi ja arvo (EUR tai %). Kerro mitä kaavio osoittaa.`
          :`Propose PIE CHART for "${slide.label}".\n\n3-8 slices, each: label and value (EUR or %). State what the chart shows.`,
        line_chart:fi?`Ehdota VIIVAKAAVIO dialle "${slide.label}".\n\nX-akseli: ajanjaksot. 1-3 trendiviivaa. Luvut numeerisina. Kerro trendi.`
          :`Propose LINE CHART for "${slide.label}".\n\nX-axis: time periods. 1-3 trend lines. Numbers. State the trend.`,
        kpi:fi?`Ehdota AVAINLUVUT dialle "${slide.label}".\n\n2-4 KPI-mittaria. Jokainen:\n- value: ISO luku (esim. "€420k", "+30%", "2.3v", "<2s")\n- label: lyhyt otsikko (esim. "Investointi", "Takaisinmaksu")\n- desc: 1 lause kontekstia\n\nValitse VAIKUTTAVIMMAT luvut materiaalista.`
          :`Propose KEY METRICS for "${slide.label}".\n\n2-4 KPIs. Each:\n- value: BIG number (e.g. "€420k", "+30%", "2.3y", "<2s")\n- label: short title\n- desc: 1 sentence context\n\nPick the most IMPACTFUL numbers from the material.`,
        bullets:fi?`Ehdota sisältö dialle "${slide.label}".\n\nJos datassa lukuja → EHDOTA taulukkoa, pylväskaaviota tai piirakkakaaviota. Bullet-lista vain kun ei lukuja.\nJokainen bullet = insight, ei pelkkä fakta. LASKE jos lukuja on.`
          :`Propose content for "${slide.label}".\n\nIf data has numbers → SUGGEST table, bar chart or pie chart. Bullets only without numbers.\nEach bullet = insight, not just fact. CALCULATE if numbers exist.`,
      };
      // Word-dokumentin sisältöpromptit
      const isDocx=outputTypeRef.current==="docx";
      const docxPrompts={
        title:fi?"Ehdota kansilehden sisältö:\n- Dokumentin otsikko\n- Alaotsikko (1 lause)\n- Tekijä / organisaatio\n- Päivämäärä\n- Versio"
          :"Propose cover page:\n- Document title\n- Subtitle (1 sentence)\n- Author / organization\n- Date\n- Version",
        text:fi?`Kirjoita luku "${slide.label}" Word-dokumenttiin.\n\nSÄÄNNÖT:\n- Kirjoita 2-4 yksityiskohtaista kappaletta (ei bullet-listoja)\n- Analysoi ja perustele — älä vain listaa faktoja\n- Jos lukuja → laske ja näytä kaavat\n- Ammattimainen, asiantunteva sävy\n- Ota kantaa ja tee suosituksia\n- Tarjoa 2 vaihtoehtoa. Kerro suosituksesi.`
          :`Write chapter "${slide.label}" for Word document.\n\nRULES:\n- Write 2-4 detailed paragraphs (NOT bullet lists)\n- Analyze and justify — don't just list facts\n- If numbers → calculate and show formulas\n- Professional, expert tone\n- Take positions and make recommendations\n- Offer 2 options. State your recommendation.`,
        table:fi?`Kirjoita luku "${slide.label}" joka sisältää taulukon.\n\nTaulukko markdown-muodossa (| sarake1 | sarake2 |). Lisää taulukon ylä- ja alapuolelle selittävät kappaleet.`
          :`Write chapter "${slide.label}" with a table.\n\nTable in markdown format (| col1 | col2 |). Add explanatory paragraphs above and below the table.`,
        list:fi?`Kirjoita luku "${slide.label}" joka sisältää listan.\n\nAloita johdantokappaleella. Lista numeroidusti tai bulletoituna. Jokainen kohta 1-2 lausetta. Lopeta yhteenvedolla.`
          :`Write chapter "${slide.label}" with a list.\n\nStart with intro paragraph. List with numbers or bullets. Each item 1-2 sentences. End with summary.`,
        summary:fi?`Kirjoita yhteenveto/tiivistelmä-luku "${slide.label}".\n\nAvainluvut, johtopäätökset ja suositukset. Kirjoita kappaleina, käytä lukuja korostaen.`
          :`Write summary chapter "${slide.label}".\n\nKey figures, conclusions and recommendations. Write in paragraphs, emphasize numbers.`,
      };
      let prompt,layoutNote,fullPrompt;
      if(isDocx){
        prompt=docxPrompts[slide.layout]||docxPrompts.text;
        fullPrompt=`[LUKU ${idx+1}/${cur.length} — ${slide.label} (${slide.layout})]\n${prompt}`;
      }else{
        prompt=layoutPrompts[slide.layout]||layoutPrompts.bullets;
        layoutNote=langRef.current==="fi"
          ?`\n\nJos taulukko (| sarake1 | sarake2 |) olisi selkeämpi kuin nykyinen layout (${slide.layout}), käytä markdown-taulukkoa — järjestelmä tunnistaa sen automaattisesti. Tarjoa 2 vaihtoehtoa. Kerro kumpi on suosituksesi.`
          :`\n\nIf a table (| col1 | col2 |) would be clearer than current layout (${slide.layout}), use markdown table — the system detects it automatically. Offer 2 options, state your recommendation.`;
        fullPrompt=`[DIA ${idx+1}/${cur.length} — ${slide.label} (${slide.layout})]\n${prompt}${layoutNote}`;
      }
      const r=await api([{role:"user",content:fullPrompt}],(isDocx?"VAIHE: Dokumentin sisältö.\n":"VAIHE: Diojen sisältö.\n")+buildContext());
      const cleanText=strip(r);lastProposalRef.current[slide.id]=cleanText;
      addDivider((isDocx?"📄 Luku ":"📄 Dia ")+(idx+1)+"/"+cur.length+" — "+(slide.icon||"")+" "+slide.label);
      addMsg("assistant",cleanText);
      setStatuses(prev=>({...prev,[slide.id]:"confirming"}));
    }finally{proposingRef.current=false;}
  }

  async function runPlanning(userText){
    // Race condition -suoja: älä käsittele viestiä jos AI vielä generoi ehdotusta
    if(proposingRef.current){addMsg("assistant",langRef.current==="fi"?"⏳ Odota, ehdotus generoituu...":"⏳ Wait, proposal is being generated...");return;}
    const cur=slidesRef.current;const idx=slideIdxRef.current;const slide=cur[idx];
    const cancelWords=["en mitään","ei muutoksia","peruuta","nothing","no changes","cancel","nevermind"];
    const isCancel=editingSlide!==null&&cancelWords.some(w=>userText.trim().toLowerCase().includes(w));
    const fi=langRef.current==="fi";

    if(isShortYes(userText)||isCancel){
      addMsg("assistant",T[langRef.current].saving);
      const proposalText=lastProposalRef.current[slide.id]||"";

      // ═══ AUTO-LAYOUT: tunnista sisällöstä parempi layout ═══
      let effectiveLayout=slide.layout;
      // Jos AI ehdotti markdown-taulukkoa mutta layout ei ole table → vaihda
      const hasMarkdownTable=(proposalText.match(/\|.*\|.*\|/g)||[]).length>=3;
      if(hasMarkdownTable&&!["table","gantt"].includes(effectiveLayout)){
        effectiveLayout="table";
        // Päivitä myös rakenne
        const si=cur.findIndex(s=>s.id===slide.id);
        if(si>=0){cur[si]={...cur[si],layout:"table",icon:"📊"};setSlides([...cur]);slidesRef.current=cur;}
      }
      // Jos sisältö viittaa pylväskaavioon/piirakkaan mutta layout on bullets
      if(effectiveLayout==="bullets"){
        const chartHints=proposalText.match(/pylväs|bar.chart|kaavio.*luku|chart.*number/gi);
        const pieHints=proposalText.match(/piirakka|pie.chart|jakauma|osuus.*%/gi);
        // Ei automaattisesti vaihda — AI:n pitää ehdottaa se rakenteessa
      }

      // Tarkista ja korjaa laskuvirheet ennen JSON-muunnosta
      let verifiedText=proposalText;
      const numCheck=await verifyNumbers(proposalText);
      if(!numCheck.verified&&numCheck.corrections?.length>0){
        for(const c of numCheck.corrections){
          // Korvaa väärä tulos oikealla tekstissä
          if(c.claimed&&c.actual){verifiedText=verifiedText.replace(c.claimed,c.actual);}
        }
        lastProposalRef.current[slide.id]=verifiedText;
      }
      const slideData=await convertToJSON(slide.label,effectiveLayout,verifiedText,langRef.current);
      // Validoi: onko diassa oikeaa sisältöä?
      if(!slideData){
        addMsg("assistant",fi?"⚠️ Sisältöä ei voitu muuntaa. Yritä muokata tai hyväksy uudelleen."
          :"⚠️ Could not convert content. Try editing or approving again.");
        return;
      }
      const isEmpty=(d,layout)=>{
        if(layout==="bullets")return!d.bullets||d.bullets.length===0||d.bullets.every(b=>!b||b==="—"||b.trim()==="");
        if(layout==="table")return!d.rows||d.rows.length===0;
        if(layout==="gantt")return!d.phases||d.phases.length===0;
        if(layout==="cards")return!d.cards||d.cards.length===0;
        if(layout==="kpi")return!d.kpis||d.kpis.length===0;
        if(layout==="two-col")return(!d.left?.items?.length)&&(!d.right?.items?.length);
        if(layout==="bar_chart"||layout==="pie_chart"||layout==="line_chart")return!d.categories?.length&&!d.slices?.length;
        return false;
      };
      if(isEmpty(slideData,effectiveLayout)){
        addMsg("assistant",fi?"⚠️ Sisältö vaikuttaa tyhjältä. Voisitko kuvailla mitä haluat?"
          :"⚠️ Content appears empty. Could you describe what you want?");
        return;
      }
      collectedRef.current={...collectedRef.current,[slide.id]:slideData};
      setStatuses(prev=>{const n={...prev,[slide.id]:"done"};setTimeout(saveSession,100);return n;});
      // Tarkista sisältääkö dia päätöksiä — tallenna ne
      const decisionKeywords=/suosit|valitaan|päätös|valinta|ehdot|recomm|select|decision|chosen|budjetti.*hyväk/i;
      if(decisionKeywords.test(proposalText)){
        try{
          const dr=await api([{role:"user",content:
            `Tässä dian "${slide.label}" hyväksytty sisältö. Listaa VAIN konkreettiset päätökset (valittu toimittaja/teknologia/budjetti/aikataulu). Yksi per rivi. Jos ei päätöksiä, vastaa "EI".\n\n${proposalText.substring(0,1500)}`}],
            "Vastaa vain lista päätöksistä.",false,langRef.current);
          if(dr&&!dr.match(/^EI$/im)){dr.split("\n").filter(l=>l.trim().length>5&&!l.match(/^EI$/i)).forEach(d=>addDecision(d.replace(/^[-•*\d.)\s]+/,"")));}
        }catch(e){console.log("Slide decision:",e);}
      }
      if(editingSlide!==null){setEditingSlide(null);addMsg("assistant","✓ "+slide.label+" "+(isCancel?T[langRef.current].noChanges:T[langRef.current].updated));showReview(cur);return;}
      const next=idx+1;
      if(next<cur.length){setSlideIdxSync(next);addMsg("assistant","✓ "+slide.label+" "+T[langRef.current].saved);setTimeout(()=>proposeSlide(next,cur),300);}
      else{addMsg("assistant","✓ "+slide.label+" "+T[langRef.current].saved);await runConsistencyCheck(cur);}
      return;
    }

    // Vaihtoehdon valinta: "1", "a", "vaihtoehto 1"
    const optChoice=isOptionSelect(userText);
    if(optChoice){
      const r=await api([{role:"user",content:
        fi?`Valitsin vaihtoehdon ${optChoice}. Näytä VAIN valittu vaihtoehto lopullisessa muodossa. Kysy hyväksyntä.`
          :`I chose option ${optChoice}. Show ONLY the selected option in final form. Ask for confirmation.`}],
        "VAIHE: Diojen sisältö.\n"+buildContext()+"\nAIEMPI EHDOTUS:\n"+(lastProposalRef.current[slide.id]||""));
      const cleanText=strip(r);lastProposalRef.current[slide.id]=cleanText;addMsg("assistant",cleanText);
      return;
    }

    // Muutospyyntö — kerro AI:lle myös kysymään jos ei ymmärrä
    const r=await api([{role:"user",content:
      `Dian "${slide.label}" aiempi ehdotus:\n---\n${lastProposalRef.current[slide.id]||""}\n---\nKäyttäjän viesti: "${userText}"\n\n${fi
        ?"Tee pyydetyt muutokset ja näytä uusi versio. Jos et ymmärrä mitä käyttäjä haluaa, KYSY selventävä kysymys äläkä toista samaa sisältöä."
        :"Make requested changes and show new version. If you don't understand what the user wants, ASK a clarifying question instead of repeating the same content."}`}],
      "VAIHE: Diojen sisältö.\n"+buildContext());
    const cleanText=strip(r);lastProposalRef.current[slide.id]=cleanText;addMsg("assistant",cleanText);
  }

  // ═══ JOHDONMUKAISUUSTARKISTUS ═══
  async function runConsistencyCheck(slidesArr){
    const cur=slidesArr||slidesRef.current;const fi=langRef.current==="fi";
    addDivider(fi?"🔍 Tarkistus":"🔍 Review");
    addMsg("assistant",fi?"Tarkistan johdonmukaisuuden...":"Checking consistency...");
    try{
      const isDocx=outputTypeRef.current==="docx";
      const itemName=fi?(isDocx?"luku":"dia"):(isDocx?"chapter":"slide");
      const slidesSummary=cur.map((s,i)=>{
        const proposal=(lastProposalRef.current[s.id]||"").substring(0,1500);
        return `${itemName.toUpperCase()} ${i+1}/${cur.length}: "${s.label}" (${s.layout})\n${proposal}`;
      }).join("\n\n---\n\n");

      const checkPrompt=fi
        ?`Alla on kaikkien ${cur.length} ${itemName}n sisällöt.\n\nTarkista VAIN nämä:\n1. LUKURISTIRIIDAT: Esiintyykö SAMA tieto eri luvuilla? Listaa VAIN varmat ristiriidat.\n2. SUOSITUSRISTIRIIDAT: Suositellaanko eri kohdissa eri vaihtoehtoa?\n\nTÄRKEÄÄ:\n- ÄLÄ väitä osien puuttuvan — kaikki ${cur.length} ovat olemassa\n- ÄLÄ ehdota uusia osia\n- ÄLÄ keksi ongelmia\n- Jos ei ristiriitoja: "Tarkistus OK — ei ristiriitoja havaittu."\n- Max 3-5 riviä\n\nSISÄLLÖT:\n${slidesSummary.substring(0,8000)}`
        :`Below are all ${cur.length} ${itemName} contents.\n\nCheck ONLY:\n1. NUMBER CONTRADICTIONS: Same fact with different numbers?\n2. RECOMMENDATION CONTRADICTIONS: Different sections recommend different options?\n\nIMPORTANT:\n- Do NOT claim parts are missing — all ${cur.length} exist\n- Do NOT suggest new parts\n- Do NOT invent problems\n- If no contradictions: "Check OK — no contradictions found."\n- Max 3-5 lines\n\nCONTENTS:\n${slidesSummary.substring(0,8000)}`;

      const r=await api([{role:"user",content:checkPrompt}],"VAIHE: Laaduntarkistus. ÄLÄ keksi ongelmia.",false,langRef.current);
      addMsg("assistant",strip(r));
    }catch(e){console.log("Consistency check:",e);}
    showReview(cur);
  }

  // ═══ REVIEW ═══
  function showReview(slidesArr){
    setScreenSync("review");setEditingSlide(null);
    const cur=slidesArr||slidesRef.current;const fi=langRef.current==="fi";
    const isDocx=outputTypeRef.current==="docx";
    const itemWord=fi?(isDocx?"lukua":"diaa"):(isDocx?"chapters":"slides");
    const itemSingular=fi?(isDocx?"luku":"dia"):(isDocx?"chapter":"slide");
    const list=cur.map((s,i)=>`${i+1}. ${s.icon||"📄"} ${s.label}`).join("\n");
    const instructions=fi
      ?`${cur.length} ${itemWord} käyty läpi!\n\n${list}\n\nToiminnot:\n• "muokkaa ${itemSingular} 2" — muokkaa sisältöä\n• "poista ${itemSingular} 3" — poistaa\n• "lisää ${itemSingular}" — lisää uusi\n• "korjaa ehdotukset" — tee tarkistuksen ehdottamat muutokset\n• "valmis" — generoi ${isDocx?"Word":"PowerPoint"}`
      :`${cur.length} ${itemWord} completed!\n\n${list}\n\nActions:\n• "edit ${itemSingular} 2" — edit content\n• "remove ${itemSingular} 3" — remove\n• "add ${itemSingular}" — add new\n• "fix suggestions" — apply review suggestions\n• "done" — generate ${isDocx?"Word":"PowerPoint"}`;
    setMsgs(p=>[...p,
      {type:"divider",content:T[langRef.current].phases.review},
      {role:"assistant",content:instructions},
    ]);
  }

  async function runReview(userText){
    const lower=userText.trim().toLowerCase();const fi=langRef.current==="fi";
    const isDocx=outputTypeRef.current==="docx";
    // EDIT — tunnistaa "dia", "luku", "slide", "chapter" + numero
    const editM=lower.match(/(?:muokkaa|muuta|korjaa|edit|change|fix)\s*(?:dia(?:a|n)?|luku(?:a|n)?|slide|chapter)?\s*(\d+)/);
    if(editM){const num=parseInt(editM[1])-1;if(num>=0&&num<slidesRef.current.length){
      const slide=slidesRef.current[num];setEditingSlide(num);setScreenSync("planning");setSlideIdxSync(num);
      setStatuses(prev=>({...prev,[slide.id]:"confirming"}));
      addDivider("✏️ "+(fi?"Muokataan":"Editing")+": "+(num+1)+" — "+slide.label);
      addMsg("assistant",T[langRef.current].editAsk+" \""+slide.label+"\"?\n"+T[langRef.current].editCancel);return;}}
    // DELETE — tunnistaa "dia", "luku", "slide", "chapter"
    const delM=lower.match(/(?:poista|remove|delete)\s*(?:dia(?:a|n)?|luku(?:a|n)?|slide|chapter)?\s*(\d+)/);
    if(delM){const num=parseInt(delM[1])-1;if(num>=0&&num<slidesRef.current.length){
      const slide=slidesRef.current[num];
      if(slide.layout==="title"){addMsg("assistant",fi?(isDocx?"Kansilehteä ei voi poistaa.":"Kansidiaa ei voi poistaa."):"Cannot remove title/cover.");return;}
      const newSlides=slidesRef.current.filter((_,i)=>i!==num);
      setSlides(newSlides);slidesRef.current=newSlides;
      const nc={...collectedRef.current};delete nc[slide.id];collectedRef.current=nc;
      setStatuses(prev=>{const ns={...prev};delete ns[slide.id];return ns;});
      addMsg("assistant","✓ \""+slide.label+"\" "+(fi?"poistettu.":"removed."));
      showReview(newSlides);return;}}
    // ADD
    const addWords=isDocx?["lisää luku","lisää uusi","add chapter","add new","new chapter"]:["lisää dia","lisää uusi","add slide","add new","new slide"];
    if(addWords.some(w=>lower.includes(w))||lower.match(/^lisää\s/)){
      const itemName=fi?(isDocx?"Uusi luku":"Uusi dia"):(isDocx?"New chapter":"New slide");
      addDivider("➕ "+itemName);
      const cur=slidesRef.current;const list=cur.map((s,i)=>`${i+1}. ${s.label}`).join(", ");
      const layouts=isDocx?"text, table, list, summary":"bullets, table, gantt, cards, two-col";
      addMsg("assistant",fi
        ?`Nykyinen järjestys: ${list}\n\nKerro:\n1. Aihe (esim. "Riskirekisteri")\n2. Monenneksi? (numero)\n3. Tyyppi: ${layouts}\n\nEsim: "Riskirekisteri, 3, table"`
        :`Current order: ${list}\n\nTell me:\n1. Topic (e.g. "Risk register")\n2. Position? (number)\n3. Type: ${layouts}\n\nE.g.: "Risk register, position 3, table"`);
      setEditingSlide("adding");return;}
    // HANDLE ADD response
    if(editingSlide==="adding"){
      const layoutM=isDocx?lower.match(/(text|table|list|summary)/i):lower.match(/(bullets|table|gantt|cards|two-col)/i);
      const layout=layoutM?layoutM[1].toLowerCase():(isDocx?"text":"bullets");
      const posM=lower.match(/(\d+)\.?\s*(?:dia|luku|slide|chapter|position|paikka|diaksi|luvuksi)/i)||lower.match(/(?:dia|luku|slide|chapter|position|paikka)\s*(\d+)/i)||lower.match(/\b(\d+)\b/);
      const pos=posM?Math.max(1,Math.min(parseInt(posM[1]),slidesRef.current.length+1)):slidesRef.current.length+1;
      const name=userText.trim().replace(/\s*[-–—,]\s*(bullets|table|gantt|cards|two-col|text|list|summary|\d+\.?\s*(?:dia|luku).*)/gi,"").replace(/\d+\.?\s*(?:diaksi|luvuksi)/gi,"").trim().substring(0,50)||(isDocx?"Uusi luku":"Uusi dia");
      const newId="item_"+Date.now();const newSlide={id:newId,label:name,icon:"📌",layout};
      const newSlides=[...slidesRef.current];newSlides.splice(pos-1,0,newSlide);
      setSlides(newSlides);slidesRef.current=newSlides;
      setStatuses(prev=>({...prev,[newId]:"pending"}));
      setEditingSlide(newSlides.indexOf(newSlide));
      setScreenSync("planning");setSlideIdxSync(newSlides.indexOf(newSlide));
      setTimeout(()=>proposeSlide(newSlides.indexOf(newSlide),newSlides),100);return;}
    // FIX SUGGESTIONS — tee tarkistuksen ehdottamat muutokset automaattisesti
    if(["korjaa ehdot","korjaa muutok","fix suggest","tee muutokset","apply fix","tee korjauk"].some(w=>lower.includes(w))){
      addMsg("assistant",fi?"Toteutan tarkistuksen ehdotukset...":"Applying review suggestions...");
      // Etsi viimeisin tarkistusviesti
      const reviewMsg=msgs.filter(m=>m.role==="assistant").reverse().find(m=>
        m.content&&(m.content.includes("RISTIRIID")||m.content.includes("PUUTTE")||m.content.includes("CONTRADICT")||m.content.includes("SUGGEST")||m.content.includes("PARANNUSEHDOT")));
      if(reviewMsg){
        // Käy läpi jokainen dia ja pyydä AI:ta tekemään korjaukset
        for(let si=0;si<slidesRef.current.length;si++){
          const sl=slidesRef.current[si];if(sl.layout==="title")continue;
          const proposal=lastProposalRef.current[sl.id]||"";if(!proposal)continue;
          const fixR=await api([{role:"user",content:
            fi?`Tarkistuksen palaute:\n${reviewMsg.content.substring(0,800)}\n\nDian "${sl.label}" nykyinen sisältö:\n${proposal.substring(0,1000)}\n\nTee VAIN tarkistuksen ehdottamat muutokset tähän diaan. Jos diaa ei tarvitse muuttaa, vastaa "EI MUUTOKSIA". Näytä muutettu versio kokonaan.`
              :`Review feedback:\n${reviewMsg.content.substring(0,800)}\n\nSlide "${sl.label}" current content:\n${proposal.substring(0,1000)}\n\nApply ONLY the review suggestions to this slide. If no changes needed, reply "NO CHANGES". Show full updated version.`}],
            "VAIHE: Korjaukset.\n"+buildContext());
          if(fixR&&!fixR.match(/EI MUUTOKSIA|NO CHANGES/i)){
            const cleaned=strip(fixR);
            lastProposalRef.current[sl.id]=cleaned;
            const slideData=await convertToJSON(sl.label,sl.layout,cleaned,langRef.current);
            if(slideData){collectedRef.current={...collectedRef.current,[sl.id]:slideData};}
            addMsg("assistant","✓ "+sl.label+" "+(fi?"päivitetty":"updated"));
          }
        }
        addMsg("assistant",fi?"Korjaukset tehty!":"Fixes applied!");
      }else{
        addMsg("assistant",fi?"Tarkistusta ei löytynyt. Aja ensin \"valmis\"-tarkistus.":"No review found.");
      }
      showReview(slidesRef.current);return;}
    // DONE
    if(["valmis","generoi","lataa","done","generate","download","finish"].some(w=>lower.includes(w))){doDownload();return;}
    const itemW=fi?(isDocx?"luku":"dia"):(isDocx?"chapter":"slide");
    addMsg("assistant",fi?`Komennot: "muokkaa ${itemW} X", "poista ${itemW} X", "lisää ${itemW}", "korjaa ehdotukset" tai "valmis".`:`Commands: "edit ${itemW} X", "remove ${itemW} X", "add ${itemW}", "fix suggestions" or "done".`);
  }

  async function doDownload(){
    const isDocx=outputTypeRef.current==="docx";
    const ext=isDocx?"docx":"pptx";
    setScreenSync("ready");addDivider(isDocx?"✅ Word":"✅ PowerPoint");addMsg("assistant",T[langRef.current].generating);setBuilding(true);
    try{
      const endpoint=isDocx?"/api/build-docx":"/api/build-pptx";
      const payload=isDocx
        ?{documentText:lastProposalRef.current["full_document"]||"",chapters:slidesRef.current,lang:langRef.current}
        :{slideData:collectedRef.current,slideStructure:slidesRef.current,lang:langRef.current};
      const r=await fetch(API+endpoint,{method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},body:JSON.stringify(payload)});
      if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"HTTP "+r.status);
      const blob=await r.blob();const url=URL.createObjectURL(blob);
      const fileName=(currentPresNameRef.current||"dokumentti").replace(/[^a-zäöåA-ZÄÖÅ0-9\s-]/g,"").trim().replace(/\s+/g,"_")+"."+ext;
      Object.assign(document.createElement("a"),{href:url,download:fileName}).click();URL.revokeObjectURL(url);
      addMsg("assistant",T[langRef.current].downloaded);
      // Automaattinen tallennus latauksen jälkeen
      setTimeout(()=>saveProject(),200);
      clearSession(); // Esitys ladattu — tyhjennä tallennettu sessio
    }catch(e){
      const fi=langRef.current==="fi";
      const msg=e.message||"";
      if(msg.includes("401")||msg.includes("vanhentunut")){
        const ok=await tryAutoRelogin();
        addMsg("assistant",ok?(fi?"🔄 Sessio uusittu — yritä ladata uudelleen.":"🔄 Session refreshed — try downloading again.")
          :(fi?"⚠️ Istunto vanhentunut. Kirjaudu uudelleen.":"⚠️ Session expired. Please log in again."));
      }else if(msg.includes("500")||msg.includes("exit")){
        addMsg("assistant",fi?"⚠️ PowerPointin generointi epäonnistui. Kokeile uudelleen — jos ongelma toistuu, yritä vähemmillä dioilla."
          :"⚠️ PowerPoint generation failed. Try again — if the issue persists, try with fewer slides.");
      }else if(msg.includes("Failed to fetch")||msg.includes("NetworkError")){
        addMsg("assistant",fi?"⚠️ Yhteys palvelimeen katkesi. Tarkista nettiyhteys ja yritä uudelleen.":"⚠️ Connection to server lost. Check your internet and try again.");
      }else{
        addMsg("assistant","⚠️ "+(fi?"Virhe generoinnissa: ":"Error generating: ")+msg);
      }
    }
    setBuilding(false);
  }

  // ═══ TIEDOSTOT ═══
  const MAX_FILE_MB=10;
  async function readFile(f){
    const ext=f.name.split(".").pop().toLowerCase();
    const fi=langRef.current==="fi";
    const sizeMB=f.size/(1024*1024);
    // Kokorajoitus
    if(sizeMB>MAX_FILE_MB){return{name:f.name,content:"",error:fi?`⚠️ ${f.name} on liian suuri (${sizeMB.toFixed(1)} MB). Maksimikoko on ${MAX_FILE_MB} MB.`:`⚠️ ${f.name} is too large (${sizeMB.toFixed(1)} MB). Maximum size is ${MAX_FILE_MB} MB.`};}
    // Tekstitiedostot
    if(["txt","md","csv","json","tsv"].includes(ext)){const t=await f.text().catch(()=>"");return{name:f.name,content:"["+f.name+"]\n"+t.substring(0,12000),sizeMB};}
    // Excel → backend-parsinta
    if(["xlsx","xls"].includes(ext)){
      try{const buf=await f.arrayBuffer();const bytes=new Uint8Array(buf);let bin="";for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
        const r=await fetch(API+"/api/extract-excel",{method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},body:JSON.stringify({base64:btoa(bin),fileName:f.name})});
        const d=await r.json();if(!r.ok)return{name:f.name,content:"",error:"⚠️ "+f.name+": "+(d.error||"virhe")};
        return{name:f.name,content:"["+f.name+"]\n"+(d.text||""),sizeMB};}catch(e){return{name:f.name,content:"",error:"⚠️ "+f.name+": "+(e.message||"virhe")};}}
    // PDF ja kuvat → Anthropic API
    const mm={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",gif:"image/gif",webp:"image/webp"};const mt=mm[ext];
    if(mt){try{const buf=await f.arrayBuffer();const bytes=new Uint8Array(buf);let bin="";for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
      const r=await fetch(API+"/api/extract-file",{method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},body:JSON.stringify({base64:btoa(bin),mimeType:mt,fileName:f.name})});
      const d=await r.json();if(!r.ok)return{name:f.name,content:"",error:"⚠️ "+f.name+": "+(d.error||"virhe")};
      const warning=(sizeMB>2&&ext==="pdf")?(fi?`\n\n⚠️ Huom: Tiedosto on iso (${sizeMB.toFixed(1)} MB). Jos jotain puuttuu, yritä jakaa pienempiin osiin.`:`\n\nNote: Large file (${sizeMB.toFixed(1)} MB). If something is missing, try splitting into smaller parts.`):"";
      return{name:f.name,content:"["+f.name+"]\n"+(d.text||"")+warning,sizeMB};}catch(e){return{name:f.name,content:"",error:"⚠️ "+f.name+": "+(e.message||"virhe")};}}
    return{name:f.name,content:"",error:(fi?`⚠️ ${f.name} — tiedostotyyppi (.${ext}) ei tuettu. Tuetut: PDF, kuvat (JPG/PNG), Excel (XLSX), tekstitiedostot (TXT/CSV/MD).`:`⚠️ ${f.name} — file type (.${ext}) not supported. Supported: PDF, images (JPG/PNG), Excel (XLSX), text files (TXT/CSV/MD).`)};
  }
  async function addFiles(fl){
    const results=await Promise.all(Array.from(fl).map(readFile));
    const ok=results.filter(r=>!r.error);
    const errors=results.filter(r=>r.error);
    if(ok.length>0)setAttachments(p=>[...p,...ok]);
    if(errors.length>0){errors.forEach(e=>addMsg("assistant",e.error));}
  }

  // ═══ LÄHETYS ═══
  async function doSend(){
    const text=input.trim();const files=attachments;if(!text&&!files.length)return;if(busy)return;
    let display=text,apiText=text,newCtx=docContext;
    if(files.length>0){const names=files.map(f=>f.name).join(", ");const bodies=files.map(f=>f.content).join("\n\n---\n\n");
      display=(text?text+"\n\n":"")+"📎 "+names;apiText=(text?text+"\n\n":"")+bodies;
      newCtx=(docContext?docContext+"\n\n---\n\n":"")+bodies;setDocContext(newCtx);docContextRef.current=newCtx;}
    setInput("");setAttachments([]);setMsgs(p=>[...p,{role:"user",content:display}]);setBusy(true);
    try{const s=screenRef.current;
      if(s==="interview")await runInterview(apiText,newCtx);
      else if(s==="focus")await runFocusConfirm(apiText);
      else if(s==="insights")await runInsightsConfirm(apiText);
      else if(s==="structure")await runStructureConfirm(apiText);
      else if(s==="deepdive")await runDeepDiveConfirm(apiText);
      else if(s==="writing")await runDocumentEdit(apiText);
      else if(s==="planning")await runPlanning(apiText);
      else if(s==="review")await runReview(apiText);
    }catch(e){
      const fi=langRef.current==="fi";
      const isTimeout=e.message?.includes("aikakatk")||e.message?.includes("AbortError");
      const isNetwork=e.message?.includes("Failed to fetch")||e.message?.includes("NetworkError");
      if(isTimeout)addMsg("assistant",fi?"⚠️ Vastaus kesti liian kauan. Yritä uudelleen — lähetä sama viesti.":"⚠️ Response timed out. Try again — resend the same message.");
      else if(isNetwork)addMsg("assistant",fi?"⚠️ Yhteys katkesi. Tarkista nettiyhteys ja yritä uudelleen.":"⚠️ Connection lost. Check your internet and try again.");
      else addMsg("assistant","⚠️ "+e.message);
    }setBusy(false);
  }

  // Kirjautuminen
  async function doUserLogin(){
    if(!authUser||!authPw)return;setAuthError("");
    try{
      const r=await fetch(API+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:authUser.trim(),password:authPw})});
      const d=await r.json();
      if(d.token){
        localStorage.setItem("pm_token",d.token);
        _lastUserCreds={username:authUser.trim(),password:authPw};
        setCurrentUser(d.user);setAuthed(true);
      }else setAuthError(d.error||t.wrongPw);
    }catch{setAuthError("Yhteysvirhe");}
  }
  // Rekisteröinti
  async function doRegister(){
    if(!authUser||!authPw||!authKey)return;setAuthError("");
    if(authPw.length<6){setAuthError(t.pwTooShort);return;}
    if(authPw!==authPw2){setAuthError(t.pwMismatch);return;}
    try{
      const r=await fetch(API+"/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:authUser.trim(),password:authPw,accessKey:authKey})});
      const d=await r.json();
      if(d.token){
        localStorage.setItem("pm_token",d.token);
        _lastUserCreds={username:authUser.trim(),password:authPw};
        setCurrentUser(d.user);setAuthed(true);
      }else setAuthError(d.error||"Rekisteröinti epäonnistui");
    }catch{setAuthError("Yhteysvirhe");}
  }
  // Uloskirjautuminen
  function doLogout(){
    localStorage.removeItem("pm_token");setAuthed(false);setCurrentUser(null);
    setAuthStep("login");setAuthUser("");setAuthPw("");setAuthPw2("");setAuthKey("");setAuthError("");
    setScreen("intro");setMsgs([]);setSlides([]);setStatuses({});
  }
  // ═══ ADMIN-PANEELI ═══
  const [showAdmin,setShowAdmin]=useState(false);
  const [adminUsers,setAdminUsers]=useState([]);
  const [resetPwId,setResetPwId]=useState(null);
  const [resetPwVal,setResetPwVal]=useState("");
  const [adminMsg,setAdminMsg]=useState("");
  async function loadAdminUsers(){
    try{
      const r=await fetch(API+"/api/admin/users",{headers:{"x-session-token":localStorage.getItem("pm_token")||""}});
      if(r.ok){const d=await r.json();setAdminUsers(d.users||[]);}
    }catch{}
  }
  async function adminResetPw(userId){
    if(!resetPwVal||resetPwVal.length<6){setAdminMsg(t.pwTooShort);return;}
    try{
      const r=await fetch(API+"/api/admin/users/"+userId+"/reset-password",{method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},body:JSON.stringify({newPassword:resetPwVal})});
      const d=await r.json();
      setAdminMsg(d.message||d.error);setResetPwId(null);setResetPwVal("");
    }catch{setAdminMsg("Virhe");}
  }
  async function adminDeleteUser(userId,username){
    if(!confirm(t.confirmDelete+" '"+username+"'?"))return;
    try{
      const r=await fetch(API+"/api/admin/users/"+userId,{method:"DELETE",headers:{"x-session-token":localStorage.getItem("pm_token")||""}});
      const d=await r.json();
      setAdminMsg(d.message||d.error);loadAdminUsers();
    }catch{setAdminMsg("Virhe");}
  }

  // Hae käyttäjätiedot + projektit + profiilit sivun latautuessa
  useEffect(()=>{
    if(authed&&!currentUser){
      const h={"x-session-token":localStorage.getItem("pm_token")||""};
      fetch(API+"/api/auth/me",{headers:h}).then(r=>r.ok?r.json():Promise.reject()).then(d=>setCurrentUser(d.user)).catch(()=>{localStorage.removeItem("pm_token");setAuthed(false);});
      loadProjects();loadProfiles();
    }
  },[authed]);
  const authHeaders=()=>({"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""});

  // ═══ PROJEKTIEN HALLINTA ═══
  async function loadProjects(){
    try{const r=await fetch(API+"/api/projects",{headers:authHeaders()});if(r.ok){const d=await r.json();setMyProjects(d.projects||[]);}}catch{}
  }
  // Tallenna esityksen tila (presentation-tasolle)
  async function saveProject(){
    setSavingProject(true);
    const state={
      screen:screenRef.current,slides:slidesRef.current,slideIdx:slideIdxRef.current,
      collected:collectedRef.current,statuses:Object.fromEntries(slidesRef.current.map(s=>[s.id,statuses[s.id]||"pending"])),
      summary:summaryRef.current,decisions:decisionsRef.current,
      docContext:docContextRef.current?.substring(0,12000),focus:focusTypeRef.current,
      proposals:lastProposalRef.current,msgs:msgs.slice(-50),profileId:activeProfileRef.current?.id||null,
      outputType:outputTypeRef.current||"pptx",
    };
    // Tallenna jaettu konteksti projektille
    const ctx={summary:summaryRef.current||"",docContext:docContextRef.current?.substring(0,12000)||"",decisions:decisionsRef.current||[]};
    try{
      // Päivitä projektin jaettu konteksti
      if(currentProjectId){
        await fetch(API+"/api/projects/"+currentProjectId,{method:"PUT",headers:authHeaders(),
          body:JSON.stringify({contextJson:ctx})});
      }
      // Tallenna/päivitä esitys — käytä käyttäjän antamaa nimeä
      const presName=currentPresNameRef.current||focusTypeRef.current||"Esitys";
      if(currentPresentationId){
        await fetch(API+"/api/presentations/"+currentPresentationId,{method:"PUT",headers:authHeaders(),
          body:JSON.stringify({name:presName,focusType:focusTypeRef.current,stateJson:state})});
      }else if(currentProjectId){
        const r=await fetch(API+"/api/projects/"+currentProjectId+"/presentations",{method:"POST",headers:authHeaders(),
          body:JSON.stringify({name:presName,focusType:focusTypeRef.current,stateJson:state})});
        const d=await r.json();if(d.id)setCurrentPresentationId(d.id);
      }
      loadProjects();
    }catch{}
    setSavingProject(false);
  }
  // Avaa projektin sivu (esitykset + konteksti)
  async function openProject(id){
    try{
      const r=await fetch(API+"/api/projects/"+id,{headers:authHeaders()});
      if(!r.ok)return;const d=await r.json();
      setCurrentProjectId(id);
      currentProjectNameRef.current=d.project.name;
      setProjectPresentations(d.presentations||[]);
      setProjectContext(d.project.context_json||{});
      projectContextRef.current=d.project.context_json||{};
      setScreenSync("project");
    }catch(e){console.error("Open project failed:",e);}
  }
  // Lataa yksittäinen esitys
  async function loadPresentation(id){
    try{
      const r=await fetch(API+"/api/presentations/"+id,{headers:authHeaders()});
      if(!r.ok)return;const d=await r.json();const s=d.presentation.state_json;
      setCurrentPresentationId(id);
      currentProjectNameRef.current=d.projectName||"";
      currentPresNameRef.current=d.presentation.name||"";
      if(s.outputType){setOutputType(s.outputType);outputTypeRef.current=s.outputType;}
      slidesRef.current=s.slides||[];setSlides(s.slides||[]);
      collectedRef.current=s.collected||{};
      summaryRef.current=s.summary||"";decisionsRef.current=s.decisions||[];
      docContextRef.current=s.docContext||"";
      focusTypeRef.current=s.focus||"";setFocusType(s.focus||"");
      lastProposalRef.current=s.proposals||{};
      setStatuses(s.statuses||{});setSlideIdxSync(s.slideIdx||0);
      // Palauta profiili jos oli valittuna
      if(s.profileId){const p=myProfiles.find(pr=>pr.id===s.profileId);if(p){setActiveProfile(p);activeProfileRef.current=p;}}
      // Palauta viestit JA näyttö oikeaan tilaan
      if(s.msgs?.length>0){
        setMsgs(s.msgs);
        // Palautetaan TÄSMÄLLEEN samaan vaiheeseen — ei kysytä uudelleen
        setScreenSync(s.screen==="ready"?"review":(s.screen||"review"));
      }else{
        const fi=langRef.current==="fi";
        const list=(s.slides||[]).map((sl,i)=>`${i+1}. ${sl.icon||"📄"} ${sl.label}`).join("\n");
        const doneCount=Object.values(s.statuses||{}).filter(v=>v==="done").length;
        setMsgs([{type:"divider",content:fi?"📂 Esitys ladattu":"📂 Presentation loaded"},
          {role:"assistant",content:(fi?`Ladattu: ${d.presentation.name}\n${doneCount}/${(s.slides||[]).length} osaa valmiina.\n\n${list}`:`Loaded: ${d.presentation.name}\n${doneCount}/${(s.slides||[]).length} parts done.\n\n${list}`)}]);
        setScreenSync(s.screen==="ready"?"review":(s.screen||"review"));
      }
    }catch(e){console.error("Load presentation failed:",e);}
  }
  async function deleteProject(id){
    try{await fetch(API+"/api/projects/"+id,{method:"DELETE",headers:authHeaders()});loadProjects();if(currentProjectId===id){setCurrentProjectId(null);setScreenSync("intro");}}catch{}
  }
  async function deletePresentation(id){
    try{await fetch(API+"/api/presentations/"+id,{method:"DELETE",headers:authHeaders()});
      if(currentProjectId)openProject(currentProjectId);
      if(currentPresentationId===id)setCurrentPresentationId(null);
    }catch{}
  }
  // Luo uusi projekti ja avaa sen sivu
  async function createAndOpenProject(name){
    setShowNewProjectModal(false);
    try{
      const r=await fetch(API+"/api/projects",{method:"POST",headers:authHeaders(),body:JSON.stringify({name:name.trim()})});
      const d=await r.json();
      if(d.id){
        setCurrentProjectId(d.id);
        currentProjectNameRef.current=name.trim();
        setProjectPresentations([]);
        setProjectContext({});
        projectContextRef.current={};
        loadProjects();
        setScreenSync("project");
      }
    }catch(e){console.error("Create project failed:",e);}
  }
  // Aloita uusi esitys projektin kontekstilla
  function startNewPresentation(presName,type){
    setCurrentPresentationId(null);
    currentPresNameRef.current=presName||"";
    if(type){setOutputType(type);outputTypeRef.current=type;}
    // Lataa projektin jaettu konteksti
    const ctx=projectContextRef.current||{};
    if(ctx.summary){summaryRef.current=ctx.summary;}
    if(ctx.docContext){docContextRef.current=ctx.docContext;setDocContext(ctx.docContext);}
    if(ctx.decisions?.length){decisionsRef.current=ctx.decisions;}
    // Jos konteksti on olemassa, ohita haastattelu → mene fokukseen
    if(ctx.summary||ctx.docContext){
      setScreenSync("focus");
      const fi=langRef.current==="fi";
      setMsgs([
        {type:"divider",content:fi?"📂 "+currentProjectNameRef.current:"📂 "+currentProjectNameRef.current},
        {role:"assistant",content:fi
          ?"Projektin materiaalit ladattu! Valitse tämän esityksen fokus:\n1. 📋 Yleinen projektisuunnitelma\n2. ⚠️ Riskianalyysi\n3. 📅 Aikataulukatsaus\n4. 🚀 Kickoff\n5. 👥 Sidosryhmäraportti\n6. 🔍 Muu"
          :"Project materials loaded! Choose this presentation's focus:\n1. 📋 General project plan\n2. ⚠️ Risk analysis\n3. 📅 Timeline overview\n4. 🚀 Kickoff\n5. 👥 Stakeholder report\n6. 🔍 Other"}
      ]);
    }else{
      // Ei kontekstia — aloita normaalisti haastattelusta
      startInterview(presName);
    }
  }

  // ═══ PROFIILIEN HALLINTA ═══
  async function loadProfiles(){
    try{const r=await fetch(API+"/api/profiles",{headers:authHeaders()});if(r.ok){const d=await r.json();setMyProfiles(d.profiles||[]);}}catch{}
  }
  async function saveProfile(){
    if(!editProfile.name)return;
    try{
      if(editProfile.id){
        await fetch(API+"/api/profiles/"+editProfile.id,{method:"PUT",headers:authHeaders(),body:JSON.stringify({name:editProfile.name,instructions:editProfile.instructions})});
      }else{
        await fetch(API+"/api/profiles",{method:"POST",headers:authHeaders(),body:JSON.stringify({name:editProfile.name,instructions:editProfile.instructions})});
      }
      loadProfiles();setShowProfileEditor(false);setEditProfile({id:null,name:"",instructions:""});
    }catch{}
  }
  async function deleteProfile(id){
    try{await fetch(API+"/api/profiles/"+id,{method:"DELETE",headers:authHeaders()});loadProfiles();
      if(activeProfile?.id===id){setActiveProfile(null);activeProfileRef.current=null;}
    }catch{}
  }
  function selectProfile(p){setActiveProfile(p);activeProfileRef.current=p;}

  // ═══ KÄYTTÄJÄPROFIILI: salasanan vaihto & tilin poisto ═══
  async function changePassword(){
    if(!changePwCurrent||!changePwNew){setChangePwMsg(t.pwTooShort);return;}
    if(changePwNew.length<6){setChangePwMsg(t.pwTooShort);return;}
    try{
      const r=await fetch(API+"/api/auth/password",{method:"PUT",headers:authHeaders(),body:JSON.stringify({currentPassword:changePwCurrent,newPassword:changePwNew})});
      const d=await r.json();
      if(r.ok){setChangePwMsg(t.pwChanged);setChangePwCurrent("");setChangePwNew("");}
      else setChangePwMsg(d.error||"Virhe");
    }catch{setChangePwMsg("Yhteysvirhe");}
  }
  async function deleteOwnAccount(){
    if(!deleteAccountPw){return;}
    if(!confirm(t.confirmDeleteAccount))return;
    try{
      const r=await fetch(API+"/api/auth/me",{method:"DELETE",headers:authHeaders(),body:JSON.stringify({password:deleteAccountPw})});
      if(r.ok){doLogout();}
      else{const d=await r.json();setChangePwMsg(d.error||"Virhe");}
    }catch{setChangePwMsg("Yhteysvirhe");}
  }
  function goBackToIntro(){
    // Jos ollaan esityksessä ja projektissa, palaa projekti-sivulle
    if(currentProjectId&&currentPresentationId){
      openProject(currentProjectId);
      return;
    }
    setScreenSync("intro");
  }

  // ═══ RENDER ═══
  const canSend=!busy&&(input.trim().length>0||attachments.length>0);
  const doneCount=slides.filter(s=>statuses[s.id]==="done").length;
  const showSidebar=slides.length>0&&["planning","review","ready"].includes(screen);

  const LangToggle=()=>(<div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:20}}>
    {[["fi","🇫🇮 Suomi"],["en","🇬🇧 English"]].map(([c,l])=>(<button key={c} onClick={()=>setLang(c)} style={{padding:"6px 16px",borderRadius:8,border:lang===c?"2px solid "+G.orange:"1px solid "+G.grey,background:lang===c?G.orange:"transparent",color:lang===c?G.white:G.grey,fontSize:13,fontWeight:600,cursor:"pointer"}}>{l}</button>))}
  </div>);

  if(!authed){
    const inputStyle={width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid "+G.grey,background:"rgba(255,255,255,0.08)",color:G.white,fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:8};
    const btnStyle={width:"100%",background:G.orange,color:G.white,border:"none",borderRadius:10,padding:"12px 0",fontSize:15,fontWeight:700,cursor:"pointer",marginTop:4};
    const linkStyle={color:G.codeBlue,fontSize:13,cursor:"pointer",textDecoration:"underline",marginTop:14,display:"inline-block"};
    const tabActive={flex:1,padding:"10px 0",border:"none",borderBottom:"2px solid "+G.orange,background:"transparent",color:G.white,fontSize:14,fontWeight:700,cursor:"pointer"};
    const tabInactive={flex:1,padding:"10px 0",border:"none",borderBottom:"2px solid transparent",background:"transparent",color:G.grey,fontSize:14,fontWeight:500,cursor:"pointer"};
    return(<div style={{minHeight:"100vh",background:G.deepBlue,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif"}}><div style={{textAlign:"center",width:340}}>
      <div style={{width:60,height:60,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:G.white,fontWeight:700,margin:"0 auto 20px"}}>G</div>
      <h2 style={{color:G.white,marginBottom:6}}>{t.title}</h2>
      <p style={{color:G.grey,fontSize:13,marginBottom:16}}>{t.subtitle}</p>
      <LangToggle/>
      <div style={{display:"flex",marginBottom:20}}>
        <button onClick={()=>{setAuthStep("login");setAuthError("");}} style={authStep==="login"?tabActive:tabInactive}>{t.login}</button>
        <button onClick={()=>{setAuthStep("register");setAuthError("");}} style={authStep==="register"?tabActive:tabInactive}>{t.register}</button>
      </div>
      {authStep==="login"&&<>
        <input type="text" value={authUser} onChange={e=>setAuthUser(e.target.value)} placeholder={t.username} style={inputStyle} autoComplete="username"/>
        <input type="password" value={authPw} onChange={e=>setAuthPw(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")doUserLogin();}} placeholder={t.password} style={inputStyle} autoComplete="current-password"/>
        {authError&&<div style={{color:G.orange,fontSize:13,marginBottom:8}}>{authError}</div>}
        <button onClick={doUserLogin} style={btnStyle}>{t.login} →</button>
      </>}
      {authStep==="register"&&<>
        <input type="text" value={authUser} onChange={e=>setAuthUser(e.target.value)} placeholder={t.username} style={inputStyle} autoComplete="username"/>
        <input type="password" value={authPw} onChange={e=>setAuthPw(e.target.value)} placeholder={t.password} style={inputStyle} autoComplete="new-password"/>
        <input type="password" value={authPw2} onChange={e=>setAuthPw2(e.target.value)} placeholder={t.passwordAgain} style={inputStyle} autoComplete="new-password"/>
        <input type="text" value={authKey} onChange={e=>setAuthKey(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")doRegister();}} placeholder={t.accessKey} style={inputStyle}/>
        {authError&&<div style={{color:G.orange,fontSize:13,marginBottom:8}}>{authError}</div>}
        <button onClick={doRegister} style={btnStyle}>{t.register} →</button>
      </>}
    </div></div>);
  }

  if(screen==="intro"){
    const cardStyle={background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:16,marginBottom:8,textAlign:"left"};
    const sectionTitle={color:G.white,fontSize:14,fontWeight:700,marginBottom:10};
    const smallBtn=(bg,clr)=>({background:bg||"transparent",border:"1px solid "+(clr||G.grey),borderRadius:6,padding:"4px 10px",color:clr||G.grey,fontSize:11,cursor:"pointer",fontWeight:600});
    return(<div style={{minHeight:"100vh",background:G.deepBlue,display:"flex",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'Segoe UI',sans-serif"}}><div style={{maxWidth:520,width:"100%",textAlign:"center"}}>

    {/* ── Käyttäjäpalkki ylhäällä ── */}
    {currentUser&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"10px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:30,height:30,borderRadius:"50%",background:G.orange,color:G.white,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12}}>{currentUser.username?.charAt(0).toUpperCase()}</div>
        <div style={{textAlign:"left"}}>
          <div style={{color:G.white,fontSize:13,fontWeight:600}}>{currentUser.username}</div>
          <div style={{color:G.grey,fontSize:10}}>{t.loggedInAs}</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <button onClick={()=>{setShowUserSettings(true);setChangePwMsg("");setChangePwCurrent("");setChangePwNew("");setDeleteAccountStep(false);setDeleteAccountPw("");}} style={smallBtn("",G.codeBlue)}>{t.profile}</button>
        {currentUser.is_admin===1&&<button onClick={()=>{setShowAdmin(true);loadAdminUsers();setAdminMsg("");}} style={smallBtn("",G.mint)}>{t.admin}</button>}
        <button onClick={doLogout} style={smallBtn("",G.orange)}>{t.logout}</button>
      </div>
    </div>}

    <div style={{width:68,height:68,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,color:G.white,fontWeight:700,margin:"0 auto 24px"}}>G</div>
    <h1 style={{color:G.white,fontSize:24,fontWeight:700,margin:"0 0 8px"}}>{t.title}</h1>
    <p style={{color:G.codeBlue,fontSize:14,lineHeight:1.7,margin:"0 0 16px"}}>{t.subtitle}</p><LangToggle/>

    {/* ── Uusi projekti (avaa nimimodaalin) ── */}
    <button onClick={()=>{setNewProjectName("");setShowNewProjectModal(true);}} style={{width:"100%",background:G.orange,color:G.white,border:"none",borderRadius:12,padding:"14px 0",fontSize:16,fontWeight:700,cursor:"pointer",marginBottom:20}}>
      {t.newProject} →
    </button>

    {showRecover&&<button onClick={recoverSession} style={{width:"100%",background:G.mint,color:G.white,border:"none",borderRadius:12,padding:"12px 0",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:16}}>
      {langRef.current==="fi"?"🔄 Palauta keskeneräinen sessio":"🔄 Recover previous session"}
    </button>}

    {/* ── Omat projektit ── */}
    {myProjects.length>0&&<div style={{marginBottom:20}}>
      <div style={sectionTitle}>{t.myProjects}</div>
      {myProjects.map(p=><div key={p.id} style={{...cardStyle,display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:G.white,fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
          <div style={{color:G.grey,fontSize:11}}>{new Date(p.updated_at+"Z").toLocaleDateString()}</div>
        </div>
        <button onClick={()=>openProject(p.id)} style={smallBtn(G.digitalBlue,G.white)}>{t.openProject}</button>
        <button onClick={()=>{if(confirm(t.deleteConfirm))deleteProject(p.id);}} style={smallBtn("",G.orange)}>{t.deleteProject}</button>
      </div>)}
    </div>}

    {/* ── Agenttiprofiilit alhaalla: klikkaa valitaksesi + lisää-nappi ── */}
    <div style={{marginBottom:20}}>
      <div style={sectionTitle}>{t.agentProfiles}</div>
      {myProfiles.length===0&&<div style={{color:G.grey,fontSize:12,fontStyle:"italic",marginBottom:10}}>{t.noProfiles}</div>}
      {myProfiles.map(p=><div key={p.id} onClick={()=>selectProfile(activeProfile?.id===p.id?null:p)}
        style={{...cardStyle,display:"flex",alignItems:"center",gap:10,cursor:"pointer",
          border:activeProfile?.id===p.id?"2px solid "+G.orange:"1px solid rgba(255,255,255,0.1)",
          background:activeProfile?.id===p.id?"rgba(232,82,26,0.12)":"rgba(255,255,255,0.06)"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:activeProfile?.id===p.id?G.orange:G.white,fontSize:13,fontWeight:600}}>{p.name}{activeProfile?.id===p.id&&" ✓"}</div>
          <div style={{color:G.grey,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.instructions.substring(0,80)}{p.instructions.length>80?"...":""}</div>
        </div>
        <button onClick={e=>{e.stopPropagation();setEditProfile({id:p.id,name:p.name,instructions:p.instructions});setShowProfileEditor(true);}} style={smallBtn("",G.codeBlue)}>{t.editProfileBtn}</button>
        <button onClick={e=>{e.stopPropagation();if(confirm(t.deleteConfirm))deleteProfile(p.id);}} style={smallBtn("",G.orange)}>{t.deleteProject}</button>
      </div>)}
      <button onClick={()=>{setEditProfile({id:null,name:"",instructions:""});setShowProfileEditor(true);}} style={{width:"100%",background:"transparent",border:"1px dashed rgba(255,255,255,0.2)",borderRadius:12,padding:"10px 0",fontSize:13,fontWeight:600,color:G.mint,cursor:"pointer",marginTop:4}}>+ {t.addProfile}</button>
    </div>

    {/* ── Projektin nimi -modaali ── */}
    {showNewProjectModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowNewProjectModal(false);}}>
      <div style={{background:G.white,borderRadius:16,padding:28,width:400,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
        <h3 style={{margin:"0 0 16px",color:G.deepBlue}}>{t.enterProjectName}</h3>
        <input type="text" value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} placeholder={t.projectName}
          onKeyDown={e=>{if(e.key==="Enter"&&newProjectName.trim())createAndOpenProject(newProjectName.trim());}}
          style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid "+G.silver,fontSize:14,marginBottom:14,boxSizing:"border-box",outline:"none"}} autoFocus/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{if(newProjectName.trim())createAndOpenProject(newProjectName.trim());}}
            disabled={!newProjectName.trim()}
            style={{flex:1,background:newProjectName.trim()?G.orange:G.silver,color:G.white,border:"none",borderRadius:8,padding:"10px 0",fontWeight:700,cursor:newProjectName.trim()?"pointer":"not-allowed"}}>{t.start}</button>
          <button onClick={()=>setShowNewProjectModal(false)} style={{flex:1,background:G.light,color:G.deepBlue,border:"none",borderRadius:8,padding:"10px 0",fontWeight:600,cursor:"pointer"}}>{t.close}</button>
        </div>
      </div>
    </div>}

    {/* ── Käyttäjäasetukset -modaali ── */}
    {showUserSettings&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowUserSettings(false);}}>
      <div style={{background:G.white,borderRadius:16,padding:28,width:420,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{margin:0,color:G.deepBlue}}>{t.profile}: {currentUser?.username}</h3>
          <button onClick={()=>setShowUserSettings(false)} style={{background:"transparent",border:"none",fontSize:20,cursor:"pointer",color:G.grey}}>×</button>
        </div>
        {changePwMsg&&<div style={{background:G.light,border:"1px solid "+G.silver,borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:13,color:G.deepBlue}}>{changePwMsg}</div>}
        {/* Salasanan vaihto */}
        <div style={{marginBottom:20}}>
          <div style={{fontWeight:600,color:G.deepBlue,fontSize:14,marginBottom:10}}>{t.changePassword}</div>
          <input type="password" value={changePwCurrent} onChange={e=>setChangePwCurrent(e.target.value)} placeholder={t.currentPw}
            style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid "+G.silver,fontSize:13,marginBottom:8,boxSizing:"border-box",outline:"none"}}/>
          <input type="password" value={changePwNew} onChange={e=>setChangePwNew(e.target.value)} placeholder={t.newPw2}
            onKeyDown={e=>{if(e.key==="Enter")changePassword();}}
            style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid "+G.silver,fontSize:13,marginBottom:10,boxSizing:"border-box",outline:"none"}}/>
          <button onClick={changePassword} style={{background:G.digitalBlue,color:G.white,border:"none",borderRadius:8,padding:"8px 16px",fontWeight:600,cursor:"pointer",fontSize:13}}>{t.changePassword}</button>
        </div>
        {/* Tilin poisto */}
        <div style={{borderTop:"1px solid "+G.silver,paddingTop:16}}>
          <div style={{fontWeight:600,color:G.orange,fontSize:14,marginBottom:10}}>{t.deleteAccount}</div>
          {!deleteAccountStep?
            <button onClick={()=>setDeleteAccountStep(true)} style={{background:"transparent",border:"1px solid "+G.orange,borderRadius:8,padding:"8px 16px",color:G.orange,fontWeight:600,cursor:"pointer",fontSize:13}}>{t.deleteAccount}</button>
          :<div>
            <div style={{color:G.grey,fontSize:12,marginBottom:8}}>{t.enterPwToDelete}</div>
            <input type="password" value={deleteAccountPw} onChange={e=>setDeleteAccountPw(e.target.value)} placeholder={t.password}
              onKeyDown={e=>{if(e.key==="Enter")deleteOwnAccount();}}
              style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid "+G.orange,fontSize:13,marginBottom:8,boxSizing:"border-box",outline:"none"}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={deleteOwnAccount} style={{background:G.orange,color:G.white,border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>{t.deleteAccount}</button>
              <button onClick={()=>{setDeleteAccountStep(false);setDeleteAccountPw("");}} style={{background:G.light,color:G.deepBlue,border:"none",borderRadius:8,padding:"8px 16px",fontWeight:600,cursor:"pointer",fontSize:13}}>{t.close}</button>
            </div>
          </div>}
        </div>
      </div>
    </div>}

    {/* ── Profiilieditori modaali ── */}
    {showProfileEditor&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowProfileEditor(false);}}>
      <div style={{background:G.white,borderRadius:16,padding:28,width:440,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
        <h3 style={{margin:"0 0 16px",color:G.deepBlue}}>{editProfile.id?t.editProfileBtn:t.newProfile}</h3>
        <input type="text" value={editProfile.name} onChange={e=>setEditProfile(p=>({...p,name:e.target.value}))} placeholder={t.profileName}
          style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid "+G.silver,fontSize:14,marginBottom:10,boxSizing:"border-box",outline:"none"}}/>
        <textarea value={editProfile.instructions} onChange={e=>setEditProfile(p=>({...p,instructions:e.target.value}))} placeholder={t.profileInstr}
          style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid "+G.silver,fontSize:13,marginBottom:6,boxSizing:"border-box",outline:"none",minHeight:120,resize:"vertical",fontFamily:"inherit"}}/>
        <div style={{color:G.grey,fontSize:11,marginBottom:14}}>{t.profileHint}</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveProfile} style={{flex:1,background:G.orange,color:G.white,border:"none",borderRadius:8,padding:"10px 0",fontWeight:700,cursor:"pointer"}}>{t.saveProject}</button>
          <button onClick={()=>setShowProfileEditor(false)} style={{flex:1,background:G.light,color:G.deepBlue,border:"none",borderRadius:8,padding:"10px 0",fontWeight:600,cursor:"pointer"}}>{t.close}</button>
        </div>
      </div>
    </div>}

    {/* ── Admin-paneeli modaali (myös introsta käyttöön) ── */}
    {showAdmin&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowAdmin(false);}}>
      <div style={{background:G.white,borderRadius:16,padding:28,width:500,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{margin:0,color:G.deepBlue,fontSize:18}}>{t.adminUsers}</h2>
          <button onClick={()=>setShowAdmin(false)} style={{background:"transparent",border:"none",fontSize:20,cursor:"pointer",color:G.grey}}>×</button>
        </div>
        {adminMsg&&<div style={{background:G.light,border:"1px solid "+G.silver,borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:13,color:G.deepBlue}}>{adminMsg}</div>}
        {adminUsers.map(u=><div key={u.id} style={{border:"1px solid "+G.silver,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <span style={{fontWeight:600,color:G.deepBlue,fontSize:14}}>{u.username}</span>
              {u.id===currentUser?.id&&<span style={{color:G.mint,fontSize:12,marginLeft:6}}>{t.you}</span>}
              {u.is_admin===1&&<span style={{background:G.orange,color:G.white,fontSize:10,padding:"2px 6px",borderRadius:4,marginLeft:6}}>admin</span>}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>{setResetPwId(resetPwId===u.id?null:u.id);setResetPwVal("");}} style={{background:"transparent",border:"1px solid "+G.digitalBlue,borderRadius:6,padding:"3px 8px",color:G.digitalBlue,fontSize:11,cursor:"pointer"}}>{t.resetPw}</button>
              {u.id!==currentUser?.id&&<button onClick={()=>adminDeleteUser(u.id,u.username)} style={{background:"transparent",border:"1px solid "+G.orange,borderRadius:6,padding:"3px 8px",color:G.orange,fontSize:11,cursor:"pointer"}}>{t.deleteUser}</button>}
            </div>
          </div>
          <div style={{color:G.grey,fontSize:11,marginTop:4}}>
            {u.created_at&&<span>Luotu: {new Date(u.created_at+"Z").toLocaleDateString()}</span>}
            {u.last_login&&<span style={{marginLeft:12}}>Viimeksi: {new Date(u.last_login+"Z").toLocaleDateString()}</span>}
          </div>
          {resetPwId===u.id&&<div style={{display:"flex",gap:6,marginTop:8}}>
            <input type="text" value={resetPwVal} onChange={e=>setResetPwVal(e.target.value)} placeholder={t.newPw} style={{flex:1,padding:"6px 10px",borderRadius:6,border:"1px solid "+G.silver,fontSize:13,outline:"none"}}/>
            <button onClick={()=>adminResetPw(u.id)} style={{background:G.digitalBlue,color:G.white,border:"none",borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer"}}>OK</button>
          </div>}
        </div>)}
      </div>
    </div>}
  </div></div>);
  }

  // ═══ PROJEKTI-SIVU ═══
  async function renameProject(newName){
    if(!newName.trim()||!currentProjectId)return;
    try{await fetch(API+"/api/projects/"+currentProjectId,{method:"PUT",headers:authHeaders(),body:JSON.stringify({name:newName.trim()})});
      currentProjectNameRef.current=newName.trim();setEditingProjectName(false);loadProjects();
    }catch{}
  }

  if(screen==="project"){
    const cardStyle={background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:16,marginBottom:8,textAlign:"left"};
    const sectionTitle={color:G.white,fontSize:14,fontWeight:700,marginBottom:10};
    const smallBtn=(bg,clr)=>({background:bg||"transparent",border:"1px solid "+(clr||G.grey),borderRadius:6,padding:"4px 10px",color:clr||G.grey,fontSize:11,cursor:"pointer",fontWeight:600});
    const hasContext=!!(projectContext.summary||projectContext.docContext);
    return(<div style={{minHeight:"100vh",background:G.deepBlue,display:"flex",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'Segoe UI',sans-serif"}}><div style={{maxWidth:560,width:"100%",textAlign:"center"}}>
      <button onClick={()=>{setScreenSync("intro");loadProjects();}} style={{...smallBtn("",G.codeBlue),marginBottom:20,fontSize:12}}>{t.backToMain}</button>
      <div style={{width:56,height:56,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:G.white,fontWeight:700,margin:"0 auto 16px"}}>G</div>

      {/* Projektin nimi — klikkaa muokataksesi */}
      {editingProjectName?
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:6}}>
          <input type="text" value={editProjNameVal} onChange={e=>setEditProjNameVal(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")renameProject(editProjNameVal);if(e.key==="Escape")setEditingProjectName(false);}}
            style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid "+G.silver,fontSize:18,fontWeight:700,textAlign:"center",outline:"none",minWidth:200}} autoFocus/>
          <button onClick={()=>renameProject(editProjNameVal)} style={smallBtn(G.mint,G.white)}>OK</button>
        </div>
      :<h2 onClick={()=>{setEditProjNameVal(currentProjectNameRef.current);setEditingProjectName(true);}}
        style={{color:G.white,fontSize:22,fontWeight:700,margin:"0 0 6px",cursor:"pointer",borderBottom:"1px dashed rgba(255,255,255,0.2)"}}
        title={langRef.current==="fi"?"Klikkaa muokataksesi nimeä":"Click to edit name"}>{currentProjectNameRef.current}</h2>}
      <div style={{color:hasContext?G.mint:G.grey,fontSize:12,marginBottom:20}}>{hasContext?("✓ "+t.interviewDone):t.interviewNotDone}</div>

      {/* Uusi esitys */}
      <button onClick={()=>{setNewPresName("");setNewPresType("pptx");setShowNewPresModal(true);}} style={{width:"100%",background:G.orange,color:G.white,border:"none",borderRadius:12,padding:"12px 0",fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:20}}>
        + {t.newPresentation}
      </button>

      {/* Esityslista */}
      {projectPresentations.length>0?<div style={{marginBottom:20}}>
        <div style={sectionTitle}>{t.presentations}</div>
        {projectPresentations.map(p=><div key={p.id} style={{...cardStyle,display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:G.white,fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
            <div style={{color:G.grey,fontSize:11}}>{p.focus_type&&<span>{p.focus_type} · </span>}{new Date(p.updated_at+"Z").toLocaleDateString()}</div>
          </div>
          <button onClick={()=>loadPresentation(p.id)} style={smallBtn(G.digitalBlue,G.white)}>{t.continuePresentation}</button>
          <button onClick={()=>{if(confirm(t.deleteConfirm))deletePresentation(p.id);}} style={smallBtn("",G.orange)}>{t.deletePresentation}</button>
        </div>)}
      </div>
      :<div style={{color:G.grey,fontSize:13,fontStyle:"italic",marginBottom:20}}>{t.noPresentations}</div>}

      {/* Uusi esitys -modaali: nimi + tyyppi (PPTX/DOCX) */}
      {showNewPresModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowNewPresModal(false);}}>
        <div style={{background:G.white,borderRadius:16,padding:28,width:420,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
          <h3 style={{margin:"0 0 16px",color:G.deepBlue}}>{t.enterPresentationName}</h3>
          <input type="text" value={newPresName} onChange={e=>setNewPresName(e.target.value)} placeholder={t.presentationName}
            style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid "+G.silver,fontSize:14,marginBottom:14,boxSizing:"border-box",outline:"none"}} autoFocus/>
          {/* Tyyppi-valinta */}
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <button onClick={()=>setNewPresType("pptx")}
              style={{flex:1,padding:"12px 0",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",
                background:newPresType==="pptx"?G.orange:"transparent",color:newPresType==="pptx"?G.white:G.deepBlue,
                border:newPresType==="pptx"?"2px solid "+G.orange:"2px solid "+G.silver}}>
              📊 PowerPoint
            </button>
            <button onClick={()=>setNewPresType("docx")}
              style={{flex:1,padding:"12px 0",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",
                background:newPresType==="docx"?G.digitalBlue:"transparent",color:newPresType==="docx"?G.white:G.deepBlue,
                border:newPresType==="docx"?"2px solid "+G.digitalBlue:"2px solid "+G.silver}}>
              📄 Word
            </button>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{if(newPresName.trim()){setShowNewPresModal(false);startNewPresentation(newPresName.trim(),newPresType);}}}
              disabled={!newPresName.trim()}
              style={{flex:1,background:newPresName.trim()?G.orange:G.silver,color:G.white,border:"none",borderRadius:8,padding:"10px 0",fontWeight:700,cursor:newPresName.trim()?"pointer":"not-allowed"}}>{t.start}</button>
            <button onClick={()=>setShowNewPresModal(false)} style={{flex:1,background:G.light,color:G.deepBlue,border:"none",borderRadius:8,padding:"10px 0",fontWeight:600,cursor:"pointer"}}>{t.close}</button>
          </div>
        </div>
      </div>}
    </div></div>);
  }

  const phaseText=(()=>{if(screen==="planning"&&slides.length>0)return t.phases.planning+" "+(slideIdx+1)+"/"+slides.length+(slides[slideIdx]?" — "+slides[slideIdx].label:"");if(screen==="insights"&&focusType)return t.phases.insights+": "+focusType;return t.phases[screen]||"";})();

  return(<div style={{height:"100vh",display:"flex",fontFamily:"'Segoe UI',sans-serif",background:G.bg,overflow:"hidden"}}>
    {showSidebar&&<div style={{width:200,background:G.white,borderRight:"1px solid "+G.silver,padding:"14px 12px",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
      <div style={{color:G.grey,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>{outputType==="docx"?t.chapters:t.slides} {doneCount}/{slides.length}</div>
      {slides.map(s=><Pill key={s.id} slide={s} status={statuses[s.id]||"pending"}/>)}
      {screen==="ready"&&<button onClick={doDownload} disabled={building} style={{background:building?G.grey:G.orange,color:G.white,border:"none",borderRadius:10,padding:"12px 0",fontSize:13,fontWeight:700,cursor:building?"not-allowed":"pointer",marginTop:16}}>{building?"⏳...":t.redownload}</button>}
    </div>}
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:G.deepBlue,padding:"8px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <button onClick={goBackToIntro} style={{background:"transparent",border:"1px solid "+G.grey,borderRadius:6,padding:"4px 10px",color:G.codeBlue,fontSize:11,cursor:"pointer",fontWeight:600,flexShrink:0}}>{t.backToMain}</button>
        <div style={{width:28,height:28,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:G.white,fontWeight:700,fontSize:12}}>G</div>
        <div style={{flex:1,minWidth:0,overflow:"hidden"}}><div style={{color:G.white,fontWeight:600,fontSize:13}}>{t.title}</div><div style={{color:G.codeBlue,fontSize:11,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{phaseText}</div></div>
        {currentUser&&<div style={{display:"flex",alignItems:"center",gap:8}}>
          {activeProfile&&<span style={{background:G.orange,color:G.white,fontSize:10,padding:"2px 8px",borderRadius:4}}>{activeProfile.name}</span>}
          <button onClick={()=>saveProject()} disabled={savingProject} style={{background:"transparent",border:"1px solid "+G.mint,borderRadius:6,padding:"4px 10px",color:G.mint,fontSize:11,cursor:savingProject?"not-allowed":"pointer",fontWeight:600}}>{savingProject?"...":t.saveProject}</button>
          <span style={{color:G.grey,fontSize:12}}>{currentUser.username}</span>
        </div>}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 16px",position:"relative"}}
        onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOver(false);}} onDrop={e=>{e.preventDefault();setDragOver(false);const fl=[];if(e.dataTransfer.items){for(const it of Array.from(e.dataTransfer.items)){if(it.kind==="file"){const f=it.getAsFile();if(f)fl.push(f);}}}else fl.push(...Array.from(e.dataTransfer.files));if(fl.length)addFiles(fl);}}>
        {dragOver&&<div style={{position:"absolute",inset:0,background:"rgba(27,108,168,0.1)",border:"2px dashed "+G.digitalBlue,borderRadius:8,zIndex:10,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}><div style={{background:G.white,borderRadius:12,padding:"24px 40px",textAlign:"center"}}><div style={{fontSize:36,marginBottom:8}}>📂</div></div></div>}
        {msgs.map((m,i)=>{
          if(m.type==="divider") return <Divider key={i} text={m.content}/>;
          return <Bubble key={i} role={m.role} content={m.content}/>;
        })}
        {busy&&<div style={{display:"flex",gap:10}}><div style={{width:32,height:32,borderRadius:"50%",background:G.deepBlue,color:G.orange,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12}}>G</div><div style={{background:G.white,borderRadius:"3px 14px 14px 14px",padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}><span style={{color:G.grey,letterSpacing:6,fontSize:16}}>● ● ●</span></div></div>}
        <div ref={bottom}/>
        {showAdmin&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowAdmin(false);}}>
          <div style={{background:G.white,borderRadius:16,padding:28,width:500,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{margin:0,color:G.deepBlue,fontSize:18}}>{t.adminUsers}</h2>
              <button onClick={()=>setShowAdmin(false)} style={{background:"transparent",border:"none",fontSize:20,cursor:"pointer",color:G.grey}}>×</button>
            </div>
            {adminMsg&&<div style={{background:G.light,border:"1px solid "+G.silver,borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:13,color:G.deepBlue}}>{adminMsg}</div>}
            {adminUsers.map(u=><div key={u.id} style={{border:"1px solid "+G.silver,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <span style={{fontWeight:600,color:G.deepBlue,fontSize:14}}>{u.username}</span>
                  {u.id===currentUser?.id&&<span style={{color:G.mint,fontSize:12,marginLeft:6}}>{t.you}</span>}
                  {u.is_admin===1&&<span style={{background:G.orange,color:G.white,fontSize:10,padding:"2px 6px",borderRadius:4,marginLeft:6}}>admin</span>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>{setResetPwId(resetPwId===u.id?null:u.id);setResetPwVal("");}} style={{background:"transparent",border:"1px solid "+G.digitalBlue,borderRadius:6,padding:"3px 8px",color:G.digitalBlue,fontSize:11,cursor:"pointer"}}>{t.resetPw}</button>
                  {u.id!==currentUser?.id&&<button onClick={()=>adminDeleteUser(u.id,u.username)} style={{background:"transparent",border:"1px solid "+G.orange,borderRadius:6,padding:"3px 8px",color:G.orange,fontSize:11,cursor:"pointer"}}>{t.deleteUser}</button>}
                </div>
              </div>
              <div style={{color:G.grey,fontSize:11,marginTop:4}}>
                {u.created_at&&<span>Luotu: {new Date(u.created_at+"Z").toLocaleDateString()}</span>}
                {u.last_login&&<span style={{marginLeft:12}}>Viimeksi: {new Date(u.last_login+"Z").toLocaleDateString()}</span>}
              </div>
              {resetPwId===u.id&&<div style={{display:"flex",gap:6,marginTop:8}}>
                <input type="text" value={resetPwVal} onChange={e=>setResetPwVal(e.target.value)} placeholder={t.newPw} style={{flex:1,padding:"6px 10px",borderRadius:6,border:"1px solid "+G.silver,fontSize:13,outline:"none"}}/>
                <button onClick={()=>adminResetPw(u.id)} style={{background:G.digitalBlue,color:G.white,border:"none",borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer"}}>OK</button>
              </div>}
            </div>)}
          </div>
        </div>}
      </div>
      {attachments.length>0&&<div style={{background:G.white,borderTop:"1px solid "+G.silver,padding:"8px 16px",display:"flex",flexWrap:"wrap",gap:6}}>
        {attachments.map((a,i)=><div key={i} style={{background:G.light,border:"1px solid "+G.silver,borderRadius:6,padding:"3px 10px",fontSize:12,color:G.deepBlue,display:"flex",alignItems:"center",gap:6}}>📄 {a.name}<span style={{cursor:"pointer",color:G.grey}} onClick={()=>setAttachments(p=>p.filter((_,j)=>j!==i))}>×</span></div>)}
      </div>}
      <div style={{background:G.white,borderTop:"1px solid "+G.silver,padding:"12px 16px",flexShrink:0}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-end",maxWidth:900,margin:"0 auto"}}>
          <button onClick={()=>fileInput.current?.click()} style={{width:36,height:36,flexShrink:0,background:"transparent",border:"1.5px dashed "+G.silver,borderRadius:9,cursor:"pointer",fontSize:16,color:G.grey}}>📎</button>
          <input ref={fileInput} type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.gif,.webp" style={{display:"none"}} onChange={e=>{if(e.target.files?.length)addFiles(e.target.files);e.target.value="";}}/>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();doSend();}}}
            placeholder={t.placeholder[screen]||t.placeholder.default}
            style={{flex:1,background:G.light,outline:"none",resize:"vertical",border:"1.5px solid "+(input.length>0?G.digitalBlue:G.silver),borderRadius:11,padding:"10px 14px",fontSize:14,fontFamily:"inherit",lineHeight:1.6,color:G.deepBlue,minHeight:80,maxHeight:220}}/>
          <button onClick={doSend} disabled={!canSend} style={{width:38,height:38,flexShrink:0,background:canSend?G.orange:G.silver,color:G.white,border:"none",borderRadius:"50%",fontSize:18,cursor:canSend?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button>
        </div>
      </div>
    </div>
  </div>);
}