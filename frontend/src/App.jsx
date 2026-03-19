import { useState, useRef, useEffect, useCallback } from "react";

const API = "https://pm-agent-avpl.onrender.com";
const G = {
  deepBlue:"#0C2340",digitalBlue:"#1B6CA8",codeBlue:"#5BA4CF",
  orange:"#E8521A",mint:"#3BBFAD",white:"#FFFFFF",
  grey:"#8C9BAA",silver:"#D3D9DF",light:"#EEF1F3",bg:"#F4F6F9",
};

// ═══ KÄÄNNÖKSET ═══
const T = {
  fi:{
    title:"Projektisuunnitelma-agentti",subtitle:"Rakennetaan projektisuunnitelmasi yhdessä, dia kerrallaan.",
    start:"Aloita haastattelu →",login:"Kirjaudu →",password:"Salasana",wrongPw:"Väärä salasana",
    steps:[["💬","Haastattelu","Kerro projektistasi"],["🔍","Havainnot","Tunnistan riskit ja vaihtoehdot"],["🤝","Dia kerrallaan","Ehdotan sisällön, sinä vahvistat"],["📊","Valmis PPTX","Gofore-teemainen esitys"]],
    phases:{interview:"💬 Vaihe 1 — Haastattelu",focus:"🎯 Vaihe 2 — Fokus",insights:"🔍 Vaihe 3 — Havainnot",structure:"📐 Vaihe 4 — Diarakenne",planning:"📄 Vaihe 5 — Dia",review:"👀 Loppukatsaus",ready:"✅ Valmis"},
    slides:"Diat",redownload:"🚀 Lataa uudelleen",
    placeholder:{review:"'valmis', 'muokkaa dia X', 'poista dia X' tai 'lisää dia'...",interview:"Kerro projektistasi...",default:"Kommentoi tai hyväksy..."},
    greeting:"Hei! Olen Goforen projektisuunnitelma-agentti.\n\nKerro projektistasi — mitä tehdään, milloin, kenen kanssa ja mitkä ovat tärkeimmät haasteet. Voit liittää dokumentteja 📎-napista.\n\n5 vaihetta:\n1️⃣ Projektitiedot  2️⃣ Fokus  3️⃣ Havainnot  4️⃣ Rakenne  5️⃣ Diat",
    materialThanks:"Kiitos materiaalista! Siirrytään valitsemaan esityksen tarkoitus.",
    structureConfirmed:"Rakenne vahvistettu! Aloitetaan diojen sisällöntuotanto.",
    saving:"💾 Tallennetaan...",saved:"tallennettu.",updated:"päivitetty!",noChanges:"— ei muutoksia.",
    generating:"Generoidaan PowerPoint...",downloaded:"✅ PowerPoint ladattu!",
    moveToStructure:"Hienoa! Siirrytään rakentamaan diarakenne.",
    editAsk:"Mitä haluat muuttaa diassa",editCancel:"Kirjoita muutokset tai \"en mitään\" palataksesi.",
  },
  en:{
    title:"Project Plan Agent",subtitle:"Let's build your project presentation together, slide by slide.",
    start:"Start interview →",login:"Log in →",password:"Password",wrongPw:"Wrong password",
    steps:[["💬","Interview","Tell about your project"],["🔍","Insights","I identify risks and alternatives"],["🤝","Slide by slide","I propose, you confirm"],["📊","Ready PPTX","Gofore-themed presentation"]],
    phases:{interview:"💬 Phase 1 — Interview",focus:"🎯 Phase 2 — Focus",insights:"🔍 Phase 3 — Insights",structure:"📐 Phase 4 — Structure",planning:"📄 Phase 5 — Slide",review:"👀 Final review",ready:"✅ Done"},
    slides:"Slides",redownload:"🚀 Download again",
    placeholder:{review:"'done', 'edit slide X', 'remove slide X' or 'add slide'...",interview:"Tell about your project...",default:"Comment or approve..."},
    greeting:"Hi! I'm Gofore's project plan agent.\n\nTell me about your project — what, when, with whom, and key challenges. Attach documents with 📎.\n\n5 phases:\n1️⃣ Project info  2️⃣ Focus  3️⃣ Insights  4️⃣ Structure  5️⃣ Slides",
    materialThanks:"Thanks for the material! Let's choose the presentation focus.",
    structureConfirmed:"Structure confirmed! Starting slide content.",
    saving:"💾 Saving...",saved:"saved.",updated:"updated!",noChanges:"— no changes.",
    generating:"Generating PowerPoint...",downloaded:"✅ PowerPoint downloaded!",
    moveToStructure:"Great! Let's build the slide structure.",
    editAsk:"What do you want to change in slide",editCancel:"Type changes or \"nothing\" to go back.",
  }
};

function getSystem(lang) {
  const today = new Date().toLocaleDateString(lang==="fi"?"fi-FI":"en-US",{year:"numeric",month:"long",day:"numeric"});
  if (lang==="fi") return `Olet kokenut projektikonsultti Goforella. Kommunikoi AINA suomeksi.
TÄNÄÄN ON: ${today}.
ROOLISI: Olet osa sovellusta joka generoi PowerPoint-tiedoston. Roolisi on kerätä sisältö keskustelemalla JA ANALYSOIDA materiaalia.
SÄÄNNÖT:
1. ÄLÄ keksi tietoja. Käytä VAIN annettuja materiaaleja.
2. Puuttuva tieto → KYSY.
3. Ole ytimekäs, max 2-3 kappaletta.
4. Käsittele VAIN pyydetty asia.
5. ÄLÄ ARVAA päivämääriä tai lukuja. Epävarma → käytä web-hakua.
6. Ole RATKAISUKESKEINEN: Analysoi, vertaile, tee johtopäätöksiä. Ota kantaa ja perustele.
7. LASKE AINA kun materiaalissa on lukuja: ROI, takaisinmaksu, säästöt, vertailut. Näytä laskukaava ja tulos. Esim: "Säästö: 270k/v - 42k/v lisenssit = 228k/v netto → takaisinmaksu 515k / 228k = 2,3 vuotta".
8. KÄYTÄ KUVAAJIA: Käytettävissä olevat layoutit:
   - table: taulukko (vertailut, luvut, budjetit)
   - gantt: aikataulu
   - cards: riskit, prioriteetit (2-4 korttia)
   - two-col: vertailu (nykytila/tavoite, pros/cons)
   - bar_chart: pylväskaavio (budjetti, kustannukset, vertailu)
   - pie_chart: piirakkakaavio (jakaumat, osuudet)
   - line_chart: viivakaavio (trendit, ennusteet)
   - bullets: VAIN kun ei lukuja eikä vertailuja
   Ehdota AINA sopivinta kuvaajaa. Älä laita lukuja bullet-listaan.
9. Tarjoa 2 vaihtoehtoa — mutta kerro kumpi on suosituksesi ja miksi.
ÄLÄ KOSKAAN tuota [SLIDE_DATA] tai [STRUCTURE_DATA] tageja.`;
  return `You are an experienced project consultant at Gofore. ALWAYS communicate in English.
TODAY IS: ${today}.
ROLE: You collect content through conversation for an automatic PowerPoint generator AND ANALYZE the material.
RULES:
1. NEVER invent data.
2. Missing info → ASK.
3. Be concise.
4. Handle ONLY current topic.
5. NEVER GUESS dates or numbers. Unsure → use web search.
6. Be SOLUTION-ORIENTED: Analyze, compare, draw conclusions. Take a position and justify.
7. ALWAYS CALCULATE when data has numbers: ROI, payback, savings, comparisons. Show formula and result.
8. USE CHARTS: Available layouts:
   - table: comparisons, numbers, budgets
   - gantt: timeline
   - cards: risks, priorities (2-4 cards)
   - two-col: comparison (current/target, pros/cons)
   - bar_chart: bar chart (budget, costs, comparison)
   - pie_chart: pie chart (distributions, shares)
   - line_chart: line chart (trends, forecasts)
   - bullets: ONLY when no numbers or comparisons
   Always suggest the best chart type. Don't put numbers in bullet lists.
9. Offer 2 options — but say which you recommend and why.
NEVER produce [SLIDE_DATA] or [STRUCTURE_DATA] tags.`;
}

// Tunnista milloin haku pitäisi aktivoida automaattisesti
const SEARCH_TRIGGERS = ["hae","etsi","googla","search","tarkista","verify"];
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
  return false;
}
const LAYOUT_DESC = {title:"otsikkodia",bullets:"bullet-lista",table:"taulukko",gantt:"Gantt-kaavio",cards:"korttiruudukko","two-col":"kaksipalstainen",bar_chart:"pylväskaavio",pie_chart:"piirakkakaavio",line_chart:"viivakaavio"};

async function callAPI(messages, systemExtra, forceSearch, lang) {
  const system = systemExtra ? getSystem(lang||"fi")+"\n\n"+systemExtra : getSystem(lang||"fi");
  // Tarkista kaikkien viimeisten viestien sisältö — ei vain viimeistä käyttäjäviestiä
  const recentTexts = messages.slice(-3).map(m => m.content).join(" ");
  const useSearch = forceSearch || shouldSearch(recentTexts);
  const r = await fetch(API+"/api/chat",{
    method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},
    body:JSON.stringify({messages,system,useSearch}),
  });
  const d = await r.json();
  if(r.status===401){localStorage.removeItem("pm_token");window.location.reload();}
  if(d.error)throw new Error(d.error);
  return d.text;
}

async function convertToJSON(slideLabel, layout, proposalText, lang) {
  const schemas = {
    title:'{"title":"...","tagline":"...","meta":"...","projectLead":"..."}',
    bullets:'{"heading":"...","bullets":["kohta 1","kohta 2"],"note":""}',
    table:'{"heading":"...","columns":["S1","S2","S3"],"rows":[["a","b","c"]]}',
    gantt:'{"heading":"...","totalWeeks":8,"frozenWeek":null,"phases":[{"name":"Vaihe 1","start":1,"end":2,"critical":false}]}',
    cards:'{"heading":"...","cards":[{"icon":"⚠️","title":"...","desc":"...","level":"high"}]}',
    "two-col":'{"heading":"...","left":{"title":"...","items":["..."]},"right":{"title":"...","items":["..."]}}',
    bar_chart:'{"heading":"...","categories":["Q1","Q2","Q3"],"series":[{"name":"Budjetti","values":[100,200,150]},{"name":"Toteutunut","values":[90,210,140]}],"unit":"EUR","note":""}',
    pie_chart:'{"heading":"...","slices":[{"label":"Osa A","value":40},{"label":"Osa B","value":35},{"label":"Osa C","value":25}],"unit":"%","note":""}',
    line_chart:'{"heading":"...","categories":["Kk1","Kk2","Kk3"],"series":[{"name":"Trendi","values":[10,25,40]}],"unit":"","note":""}',
  };
  let extra = "";
  if (layout === "gantt") extra = "\n\nGANTT: Jokainen vaihe = OMA rivi (MAX 15). start/end = viikkonumeroita. totalWeeks: 3kk=13, 6kk=26. Nimet max 35 merkkiä.";
  else if (layout === "bar_chart") extra = "\n\nPYLVÄSKAAVIO: categories = X-akselin nimet. series = yksi tai useampi datasarja. values PITÄÄ olla lukuja (ei tekstiä). unit = yksikkö (EUR, %, kpl).";
  else if (layout === "pie_chart") extra = "\n\nPIIRAKKAKAAVIO: slices = 3-8 palaa. value = numeerinen arvo. Prosentit tai absoluuttiset luvut.";
  else if (layout === "line_chart") extra = "\n\nVIIVAKAAVIO: categories = X-akseli (ajanjaksot). series = trendilinjat. values = lukuja.";
  const r = await callAPI([{role:"user",content:
    `Muunna dian sisältö JSON-muotoon.\nDIA: "${slideLabel}" (${layout})\nSKEEMA: ${schemas[layout]||schemas.bullets}\n\nSISÄLTÖ:\n---\n${proposalText.substring(0,3000)}\n---\n\nVastaa VAIN JSON. ÄLÄ keksi uutta. JOKAINEN kohta/rivi/vaihe sisällöstä PITÄÄ olla JSON:ssa. ÄLÄ tiivistä. Luvut AINA numeroina (ei "420k" vaan 420000).${extra}`}],
    "Olet JSON-muunnin. Vastaa VAIN validilla JSON-objektilla.", false, lang);
  try { const m=r.match(/\{[\s\S]*\}/); if(m)return JSON.parse(m[0]); }catch(e){console.error("JSON:",e);}
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
export default function App() {
  const [screen,setScreen]=useState("intro");
  const [lang,setLangState]=useState(localStorage.getItem("pm_lang")||"fi");
  const setLang=(l)=>{setLangState(l);localStorage.setItem("pm_lang",l);langRef.current=l;};
  const t=T[lang];
  const [authed,setAuthed]=useState(!!localStorage.getItem("pm_token"));
  const [pwInput,setPwInput]=useState(""); const [pwError,setPwError]=useState(false);
  const [msgs,setMsgs]=useState([]); const [input,setInput]=useState(""); const [busy,setBusy]=useState(false);
  const [slides,setSlides]=useState([]); const [slideIdx,setSlideIdx]=useState(0); const [statuses,setStatuses]=useState({});
  const [building,setBuilding]=useState(false);
  const [attachments,setAttachments]=useState([]); const [docContext,setDocContext]=useState("");
  const [focusType,setFocusType]=useState(""); const [dragOver,setDragOver]=useState(false);
  const [editingSlide,setEditingSlide]=useState(null);

  const bottom=useRef();const fileInput=useRef();
  const collectedRef=useRef({});const proposingRef=useRef(false);
  const screenRef=useRef("intro");const slideIdxRef=useRef(0);
  const slidesRef=useRef([]);const focusTypeRef=useRef("");
  const pendingStructRef=useRef(null);const docContextRef=useRef("");
  const langRef=useRef(localStorage.getItem("pm_lang")||"fi");
  const lastProposalRef=useRef({});const summaryRef=useRef("");
  const decisionsRef=useRef([]);  // Isot päätökset: toimittajavalinnat, budjetti, aikataulu jne.

  useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth"});},[msgs,busy]);
  function setScreenSync(v){setScreen(v);screenRef.current=v;}
  function setSlideIdxSync(v){setSlideIdx(v);slideIdxRef.current=v;}
  const addMsg=useCallback((role,content)=>setMsgs(p=>[...p,{role,content}]),[]);
  const addDivider=useCallback((text)=>setMsgs(p=>[...p,{type:"divider",content:text}]),[]);
  const api=useCallback((msgs,extra,search)=>callAPI(msgs,extra,search,langRef.current),[]);

  function buildContext(){
    let c="";
    if(summaryRef.current)c+=summaryRef.current+"\n\n";
    if(decisionsRef.current.length>0)c+="═══ TEHDYT PÄÄTÖKSET (EHDOTTOMAT — ÄLÄ MUUTA) ═══\n"+decisionsRef.current.map((d,i)=>(i+1)+". "+d).join("\n")+"\n═══════════════════════════════════\n\n";
    if(docContextRef.current)c+="LÄHDEMATERIAALIT:\n"+docContextRef.current.substring(0,3000)+"\n\n";
    if(focusTypeRef.current)c+="FOKUS: "+focusTypeRef.current+"\n\n";
    return c;
  }
  function recentMessages(n){const all=msgs.filter(m=>m.role==="user"||m.role==="assistant");return all.slice(-(n*2)).map(m=>({role:m.role,content:m.content}));}
  function updateSummary(note){summaryRef.current=(summaryRef.current?summaryRef.current+"\n":"")+note;}
  function addDecision(decision){if(!decisionsRef.current.includes(decision))decisionsRef.current=[...decisionsRef.current,decision];}

  // ═══ VAIHE 1 ═══
  function startInterview(){setScreenSync("interview");setMsgs([{type:"divider",content:T[langRef.current].phases.interview},{role:"assistant",content:T[langRef.current].greeting}]);}

  async function runInterview(userText,ctx){
    const extra=ctx||docContextRef.current;
    if(extra&&extra.length>100){addMsg("assistant",T[langRef.current].materialThanks);updateSummary("HAASTATTELU: materiaali annettu");await runFocusAsk();return;}
    const r=await api([...recentMessages(3),{role:"user",content:userText},{role:"user",content:"[JÄRJESTELMÄOHJE] Riittävätkö tiedot? KYLLÄ→tiivistä+##READY_TO_PLAN##. EI→kysy YKSI kysymys."}],"VAIHE: Haastattelu.\n"+buildContext());
    addMsg("assistant",strip(r));
    if(r.includes("##READY_TO_PLAN##")){updateSummary("HAASTATTELU: "+strip(r).substring(0,300));await runFocusAsk();}
  }

  // ═══ VAIHE 2 ═══
  async function runFocusAsk(){
    setScreenSync("focus");addDivider("🎯 Vaihe 2 — "+T[langRef.current].phases.focus.split("—")[1]);
    const r=await api([{role:"user",content:"Kerro 1 lauseella projektista ja kysy fokus:\n1. 📋 Yleinen projektisuunnitelma\n2. ⚠️ Riskianalyysi\n3. 📅 Aikataulukatsaus\n4. 🚀 Kickoff\n5. 👥 Sidosryhmäraportti\n6. 🔍 Muu"}],"VAIHE: Fokus.\n"+buildContext());
    addMsg("assistant",strip(r));
  }

  async function runFocusConfirm(userText){
    setFocusType(userText.trim());focusTypeRef.current=userText.trim();
    updateSummary("FOKUS: "+userText.trim());
    setScreenSync("insights");addDivider("🔍 Vaihe 3");
    const fi=langRef.current==="fi";
    const insightPrompt=fi
      ?`Fokus: "${userText.trim()}"\n\nAnalysoi materiaali ja listaa 4-6 HAVAINTOA:\n- Jokaisessa havainnossa: FAKTA + JOHTOPÄÄTÖS + SUOSITUS/KYSYMYS\n- Jos materiaalissa on valintoja tai vaihtoehtoja → ota kantaa, kerro suosituksesi\n- Jos löydät ristiriitoja tai puutteita → nosta ne esiin\n- Jos datassa on lukuja → laske: ROI, takaisinmaksu, vertailut\n- ÄLÄ vain toista mitä materiaalissa lukee — ANALYSOI\n\nÄLÄ ehdota diarakennetta. Kysy: "Hyväksytkö nämä havainnot?"`
      :`Focus: "${userText.trim()}"\n\nAnalyze material and list 4-6 INSIGHTS:\n- Each: FACT + CONCLUSION + RECOMMENDATION/QUESTION\n- If choices/alternatives → take a position, give recommendation\n- If contradictions or gaps → raise them\n- If numbers → calculate: ROI, payback, comparisons\n- Don't just restate the material — ANALYZE\n\nDon't suggest slide structure. Ask: "Do you approve these insights?"`;
    const r=await api([{role:"user",content:insightPrompt}],"VAIHE: Havainnot.\n"+buildContext());
    addMsg("assistant",strip(r));
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
    setScreenSync("structure");addDivider("📐 Vaihe 4 — Diarakenne");
    const fi=langRef.current==="fi";
    const structPrompt=fi
      ?`Ehdota KAKSI diarakennevaihtoehtoa fokukselle "${focusTypeRef.current}":\n**A: Tiivis (5-7 diaa)**\n**B: Kattava (8-12 diaa)**\n\n1. dia AINA: 1. 🎯 Kansi - title\nJokainen rivi: numero + emoji + nimi - layout\n\nLAYOUT-VALINTA (käytä monipuolisesti!):\n- Vertailutaulukko (toimittajat, vaihtoehdot) → table\n- Budjetit, kustannukset numeerisesti → bar_chart\n- Jakaumat, osuudet → pie_chart\n- Trendit, ennusteet → line_chart\n- Riskit, haasteet → cards\n- Aikataulu → gantt\n- Nykytila/tavoite, pros/cons → two-col\n- Teksti ilman lukuja → bullets\n\nTÄRKEÄÄ: Jos aiheessa on paljon sisältöä (esim. talousanalyysi, riskit), JAA se 2-3 diaan! Esim:\n- "Budjettivertailu - bar_chart" + "Kustannusjakauma - pie_chart" + "ROI-laskelma - table"\n\nKysy: "Kumpi sopii?"`
      :`Propose TWO slide structure options for "${focusTypeRef.current}":\n**A: Compact (5-7 slides)**\n**B: Comprehensive (8-12 slides)**\n\nSlide 1 ALWAYS: 1. 🎯 Cover - title\nEach row: number + emoji + name - layout\n\nLAYOUT SELECTION (use variety!):\n- Comparison table → table\n- Budgets, costs numerically → bar_chart\n- Distributions, shares → pie_chart\n- Trends, forecasts → line_chart\n- Risks, challenges → cards\n- Timeline → gantt\n- Current/target, pros/cons → two-col\n- Text without numbers → bullets\n\nIMPORTANT: If topic has lots of content (e.g. financial analysis), SPLIT into 2-3 slides!\n\nAsk: "Which one?"`;
    const r=await api([{role:"user",content:structPrompt}],"VAIHE: Diarakenne.\n"+buildContext());
    const s=tryParseStructure(strip(r)); if(s)pendingStructRef.current=s;
    addMsg("assistant",strip(r));
  }

  function tryParseStructure(text){
    const clean=text.replace(/\*{1,2}/g,"");
    const allLines=clean.split("\n").filter(l=>/^\s*\d+[\.\)]\s/.test(l));
    if(!allLines.length)return null;
    const lines=[];let seen=false;
    for(const line of allLines){const n=parseInt(line.trim());if(n===1&&seen)break;seen=true;lines.push(line);}
    const kw={kansi:"title",aikataulu:"gantt",gantt:"gantt",taulukko:"table",table:"table",riski:"cards",cards:"cards","two-col":"two-col",pylväs:"bar_chart",bar_chart:"bar_chart",piirakka:"pie_chart",pie_chart:"pie_chart",viiva:"line_chart",line_chart:"line_chart",budjetti:"bar_chart",kustannus:"bar_chart",jakauma:"pie_chart",trendi:"line_chart"};
    return lines.map((line,i)=>{
      const iconM=line.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
      const stripped=line.replace(/^\s*\d+[\.\)]\s*/,"").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,"").trim();
      const parts=stripped.split(/\s*[-–—]\s*/);const label=parts[0]?.trim()||"Dia "+(i+1);
      const id=label.toLowerCase().replace(/[^a-zäöå0-9]/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"")||"dia_"+(i+1);
      const layoutM=line.match(/[-–—]\s*(title|bullets|table|gantt|cards|two-col|bar_chart|pie_chart|line_chart)/i)||line.match(/\((title|bullets|table|gantt|cards|two-col|bar_chart|pie_chart|line_chart)\)/i);
      let layout=layoutM?layoutM[1].toLowerCase():"bullets";
      if(!layoutM){for(const[k,v]of Object.entries(kw)){if(line.toLowerCase().includes(k)){layout=v;break;}}}
      if(i===0&&/kansi|cover/i.test(line))layout="title";
      const layoutIcons={title:"🎯",bullets:"📋",table:"📊",gantt:"📅",cards:"⚠️","two-col":"📑",bar_chart:"📊",pie_chart:"🥧",line_chart:"📈"};
      return{id,label,icon:iconM?iconM[1]:(layoutIcons[layout]||"📄"),layout};
    });
  }

  function ensureKansi(s){if(!s?.length)return[{id:"kansi",label:"Kansi",icon:"🎯",layout:"title"}];return s[0].layout==="title"?s:[{id:"kansi",label:"Kansi",icon:"🎯",layout:"title"},...s];}

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
    // → Pyydä AI näyttämään LOPULLINEN rakenne puhtaana listana
    const modifyPrompt=fi
      ?`Käyttäjän valinta/muutos: "${userText}"\n\nNäytä LOPULLINEN diarakenne yhtenä numeroiduna listana. VAIN YKSI lista. Kansi AINA 1. Jokainen rivi: numero + emoji + nimi - layout\n\nLayoutit: title, bullets, table, gantt, cards, two-col, bar_chart, pie_chart, line_chart\nKäytä monipuolisesti: TABLE vertailuille, BAR_CHART budjeteille, PIE_CHART jakaumille, LINE_CHART trendeille, CARDS riskeille, GANTT aikatauluille. Raskaat aiheet voi jakaa 2-3 diaan.`
      :`User choice/modification: "${userText}"\n\nShow FINAL slide structure as ONE numbered list. Cover always 1. Each row: number + emoji + name - layout\n\nLayouts: title, bullets, table, gantt, cards, two-col, bar_chart, pie_chart, line_chart\nUse variety: TABLE for comparisons, BAR_CHART for budgets, PIE_CHART for distributions, LINE_CHART for trends. Heavy topics can span 2-3 slides.`;
    const r=await api([...recentMessages(3),{role:"user",content:modifyPrompt}],"VAIHE: Diarakenne.\n"+buildContext());
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
    setScreenSync("planning");setSlideIdxSync(0);
    addDivider("📄 Vaihe 5 — Diojen sisällöntuotanto");
    setTimeout(()=>proposeSlide(0,confirmed),100);
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
        table:fi?`Ehdota TAULUKKO dialle "${slide.label}".\nSarakkeet vertailua varten, konkreettisia lukuja, johtopäätös/suositus.\nÄlä tee bullet-listaa — tee OIKEA taulukko.`
          :`Propose TABLE for "${slide.label}".\nColumns for comparison, concrete numbers, conclusion/recommendation.`,
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
        bullets:fi?`Ehdota sisältö dialle "${slide.label}".\n\nJos datassa lukuja → EHDOTA taulukkoa, pylväskaaviota tai piirakkakaaviota. Bullet-lista vain kun ei lukuja.\nJokainen bullet = insight, ei pelkkä fakta. LASKE jos lukuja on.`
          :`Propose content for "${slide.label}".\n\nIf data has numbers → SUGGEST table, bar chart or pie chart. Bullets only without numbers.\nEach bullet = insight, not just fact. CALCULATE if numbers exist.`,
      };
      const prompt=layoutPrompts[slide.layout]||layoutPrompts.bullets;
      const fullPrompt=`[DIA ${idx+1}/${cur.length} — ${slide.label} (${slide.layout})]\n${prompt}\n\nTarjoa 2 vaihtoehtoa. Kerro kumpi on suosituksesi. Älä käytä JSON:ia.`;
      const r=await api([{role:"user",content:fullPrompt}],"VAIHE: Diojen sisältö.\n"+buildContext());
      const cleanText=strip(r);lastProposalRef.current[slide.id]=cleanText;
      addDivider("📄 Dia "+(idx+1)+"/"+cur.length+" — "+(slide.icon||"")+" "+slide.label);
      addMsg("assistant",cleanText);
      setStatuses(prev=>({...prev,[slide.id]:"confirming"}));
    }finally{proposingRef.current=false;}
  }

  async function runPlanning(userText){
    const cur=slidesRef.current;const idx=slideIdxRef.current;const slide=cur[idx];
    const cancelWords=["en mitään","ei muutoksia","peruuta","nothing","no changes","cancel","nevermind"];
    const isCancel=editingSlide!==null&&cancelWords.some(w=>userText.trim().toLowerCase().includes(w));
    const fi=langRef.current==="fi";

    if(isShortYes(userText)||isCancel){
      addMsg("assistant",T[langRef.current].saving);
      const proposalText=lastProposalRef.current[slide.id]||"";
      const slideData=await convertToJSON(slide.label,slide.layout,proposalText,langRef.current);
      if(slideData){collectedRef.current={...collectedRef.current,[slide.id]:slideData};}
      setStatuses(prev=>({...prev,[slide.id]:"done"}));
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
    addMsg("assistant",fi?"Tarkistan diojen johdonmukaisuuden...":"Checking slide consistency...");
    try{
      // Kootaan kaikkien diojen sisällöt tiivistetysti
      const slidesSummary=cur.map((s,i)=>{
        const proposal=(lastProposalRef.current[s.id]||"").substring(0,400);
        return `DIA ${i+1}: "${s.label}" (${s.layout})\n${proposal}`;
      }).join("\n\n---\n\n");

      const checkPrompt=fi
        ?`Alla on kaikki ${cur.length} dian sisällöt. Tee LYHYT laaduntarkistus:\n\n1. RISTIRIIDAT: Onko diojen välillä ristiriitaisia tietoja? (esim. eri luvut, eri suositukset, eri aikataulut)\n2. PUUTTEET: Puuttuuko jotain olennaista mitä materiaalien perusteella pitäisi olla?\n3. PARANNUSEHDOTUKSET: 1-2 konkreettista ehdotusta (esim. "dia 3 voisi olla taulukko" tai "dia 5 puuttuu budjettiluvut")\n\nOle tiivis — max 5-8 riviä. Jos kaikki ok, sano se.\n\nDIAT:\n${slidesSummary.substring(0,3000)}`
        :`Below are all ${cur.length} slide contents. Do a BRIEF quality check:\n\n1. CONTRADICTIONS: Any conflicting info between slides?\n2. GAPS: Anything missing that the source material suggests?\n3. SUGGESTIONS: 1-2 concrete improvements\n\nBe concise — max 5-8 lines. If all good, say so.\n\nSLIDES:\n${slidesSummary.substring(0,3000)}`;

      const r=await api([{role:"user",content:checkPrompt}],"VAIHE: Laaduntarkistus.\n"+buildContext());
      addMsg("assistant",strip(r));
    }catch(e){console.log("Consistency check:",e);}
    showReview(cur);
  }

  // ═══ REVIEW ═══
  function showReview(slidesArr){
    setScreenSync("review");setEditingSlide(null);
    const cur=slidesArr||slidesRef.current;const fi=langRef.current==="fi";
    const list=cur.map((s,i)=>`${i+1}. ${s.icon||"📄"} ${s.label}`).join("\n");
    const instructions=fi
      ?`${cur.length} diaa on käyty läpi!\n\n${list}\n\nToiminnot:\n• "muokkaa dia 2" — muokkaa sisältöä\n• "poista dia 3" — poistaa dian\n• "lisää dia" — lisää uusi dia\n• "korjaa ehdotukset" — tee tarkistuksen ehdottamat muutokset\n• "valmis" — generoi PowerPoint`
      :`${cur.length} slides completed!\n\n${list}\n\nActions:\n• "edit slide 2" — edit content\n• "remove slide 3" — remove slide\n• "add slide" — add new slide\n• "fix suggestions" — apply review suggestions\n• "done" — generate PowerPoint`;
    setMsgs(p=>[...p,
      {type:"divider",content:T[langRef.current].phases.review},
      {role:"assistant",content:instructions},
    ]);
  }

  async function runReview(userText){
    const lower=userText.trim().toLowerCase();const fi=langRef.current==="fi";
    // EDIT
    const editM=lower.match(/(?:muokkaa|muuta|korjaa|edit|change|fix)\s*(?:dia(?:a|n)?|slide)?\s*(\d+)/);
    if(editM){const num=parseInt(editM[1])-1;if(num>=0&&num<slidesRef.current.length){
      const slide=slidesRef.current[num];setEditingSlide(num);setScreenSync("planning");setSlideIdxSync(num);
      setStatuses(prev=>({...prev,[slide.id]:"confirming"}));
      addDivider("✏️ "+(fi?"Muokataan":"Editing")+": "+(num+1)+" — "+slide.label);
      addMsg("assistant",T[langRef.current].editAsk+" \""+slide.label+"\"?\n"+T[langRef.current].editCancel);return;}}
    // DELETE
    const delM=lower.match(/(?:poista|remove|delete)\s*(?:dia(?:a|n)?|slide)?\s*(\d+)/);
    if(delM){const num=parseInt(delM[1])-1;if(num>=0&&num<slidesRef.current.length){
      const slide=slidesRef.current[num];
      if(slide.layout==="title"){addMsg("assistant",fi?"Kansidiaa ei voi poistaa.":"Cannot remove title slide.");return;}
      const newSlides=slidesRef.current.filter((_,i)=>i!==num);
      setSlides(newSlides);slidesRef.current=newSlides;
      // Siivoa data JA statukset
      const nc={...collectedRef.current};delete nc[slide.id];collectedRef.current=nc;
      setStatuses(prev=>{const ns={...prev};delete ns[slide.id];return ns;});
      addMsg("assistant","✓ \""+slide.label+"\" "+(fi?"poistettu.":"removed."));
      showReview(newSlides);return;}}
    // ADD — kysytään aihe ja paikka
    if(["lisää dia","lisää uusi","add slide","add new","new slide"].some(w=>lower.includes(w))){
      addDivider("➕ "+(fi?"Uusi dia":"New slide"));
      const cur=slidesRef.current;const list=cur.map((s,i)=>`${i+1}. ${s.label}`).join(", ");
      addMsg("assistant",fi
        ?`Nykyinen järjestys: ${list}\n\nKerro:\n1. Dian aihe (esim. "Riskirekisteri")\n2. Monenneksi diaksi? (numero, esim. "3" = kolmanneksi)\n3. Layout: bullets, table, gantt, cards, two-col\n\nEsim: "Riskirekisteri, 3. diaksi, table"`
        :`Current order: ${list}\n\nTell me:\n1. Slide topic (e.g. "Risk register")\n2. Position? (number, e.g. "3" = third)\n3. Layout: bullets, table, gantt, cards, two-col\n\nE.g.: "Risk register, position 3, table"`);
      setEditingSlide("adding");return;}
    // HANDLE ADD response
    if(editingSlide==="adding"){
      const layoutM=lower.match(/(bullets|table|gantt|cards|two-col)/i);
      const layout=layoutM?layoutM[1].toLowerCase():"bullets";
      const posM=lower.match(/(\d+)\.?\s*(?:dia|slide|position|paikka|diaksi)/i)||lower.match(/(?:dia|slide|position|paikka|diaksi)\s*(\d+)/i)||lower.match(/\b(\d+)\b/);
      const pos=posM?Math.max(1,Math.min(parseInt(posM[1]),slidesRef.current.length+1)):slidesRef.current.length+1;
      const name=userText.trim().replace(/\s*[-–—,]\s*(bullets|table|gantt|cards|two-col|\d+\.?\s*dia.*)/gi,"").replace(/\d+\.?\s*diaksi/gi,"").trim().substring(0,50)||"Uusi dia";
      const newId="dia_"+Date.now();const newSlide={id:newId,label:name,icon:"📌",layout};
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
    addMsg("assistant",fi?"Komennot: \"muokkaa dia X\", \"poista dia X\", \"lisää dia\", \"korjaa ehdotukset\" tai \"valmis\".":"Commands: \"edit slide X\", \"remove slide X\", \"add slide\", \"fix suggestions\" or \"done\".");
  }

  async function doDownload(){
    setScreenSync("ready");addDivider("✅ PowerPoint");addMsg("assistant",T[langRef.current].generating);setBuilding(true);
    try{
      const r=await fetch(API+"/api/build-pptx",{method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},body:JSON.stringify({slideData:collectedRef.current,slideStructure:slidesRef.current})});
      if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"HTTP "+r.status);
      const blob=await r.blob();const url=URL.createObjectURL(blob);
      Object.assign(document.createElement("a"),{href:url,download:"projektisuunnitelma.pptx"}).click();URL.revokeObjectURL(url);
      addMsg("assistant",T[langRef.current].downloaded);
    }catch(e){addMsg("assistant","⚠️ "+e.message);}
    setBuilding(false);
  }

  // ═══ TIEDOSTOT ═══
  async function readFile(f){
    if(f.name.match(/\.(txt|md|csv|json)$/i)){const t=await f.text().catch(()=>"");return{name:f.name,content:"["+f.name+"]\n"+t.substring(0,5000)};}
    const mm={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png"};const mt=mm[f.name.split(".").pop().toLowerCase()];
    if(mt){try{const buf=await f.arrayBuffer();const bytes=new Uint8Array(buf);let bin="";for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
      const r=await fetch(API+"/api/extract-file",{method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},body:JSON.stringify({base64:btoa(bin),mimeType:mt,fileName:f.name})});
      const d=await r.json();return{name:f.name,content:"["+f.name+(d.text?"]\n"+d.text:": virhe]")};}catch{return{name:f.name,content:"["+f.name+": virhe]"};}}
    return{name:f.name,content:"["+f.name+" — ei tuettu]"};
  }
  async function addFiles(fl){const read=await Promise.all(Array.from(fl).map(readFile));setAttachments(p=>[...p,...read]);}

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
      else if(s==="planning")await runPlanning(apiText);
      else if(s==="review")await runReview(apiText);
    }catch(e){addMsg("assistant","⚠️ "+e.message);}setBusy(false);
  }

  async function doLogin(){if(!pwInput)return;try{const r=await fetch(API+"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pwInput})});const d=await r.json();if(d.token){localStorage.setItem("pm_token",d.token);setAuthed(true);}else setPwError(true);}catch{setPwError(true);}}

  // ═══ RENDER ═══
  const canSend=!busy&&(input.trim().length>0||attachments.length>0);
  const doneCount=slides.filter(s=>statuses[s.id]==="done").length;
  const showSidebar=slides.length>0&&["planning","review","ready"].includes(screen);

  const LangToggle=()=>(<div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:20}}>
    {[["fi","🇫🇮 Suomi"],["en","🇬🇧 English"]].map(([c,l])=>(<button key={c} onClick={()=>setLang(c)} style={{padding:"6px 16px",borderRadius:8,border:lang===c?"2px solid "+G.orange:"1px solid "+G.grey,background:lang===c?G.orange:"transparent",color:lang===c?G.white:G.grey,fontSize:13,fontWeight:600,cursor:"pointer"}}>{l}</button>))}
  </div>);

  if(!authed)return(<div style={{minHeight:"100vh",background:G.deepBlue,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif"}}><div style={{textAlign:"center",width:320}}>
    <div style={{width:60,height:60,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:G.white,fontWeight:700,margin:"0 auto 20px"}}>G</div>
    <h2 style={{color:G.white,marginBottom:8}}>{t.title}</h2><LangToggle/>
    <input type="password" value={pwInput} onChange={e=>{setPwInput(e.target.value);setPwError(false);}} onKeyDown={e=>{if(e.key==="Enter")doLogin();}} placeholder={t.password} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid "+(pwError?G.orange:G.grey),background:"rgba(255,255,255,0.08)",color:G.white,fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
    {pwError&&<div style={{color:G.orange,fontSize:13,marginBottom:8}}>{t.wrongPw}</div>}
    <button onClick={doLogin} style={{width:"100%",background:G.orange,color:G.white,border:"none",borderRadius:10,padding:"12px 0",fontSize:15,fontWeight:700,cursor:"pointer"}}>{t.login}</button>
  </div></div>);

  if(screen==="intro")return(<div style={{minHeight:"100vh",background:G.deepBlue,display:"flex",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'Segoe UI',sans-serif"}}><div style={{maxWidth:480,width:"100%",textAlign:"center"}}>
    <div style={{width:68,height:68,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,color:G.white,fontWeight:700,margin:"0 auto 24px"}}>G</div>
    <h1 style={{color:G.white,fontSize:24,fontWeight:700,margin:"0 0 8px"}}>{t.title}</h1>
    <p style={{color:G.codeBlue,fontSize:14,lineHeight:1.7,margin:"0 0 24px"}}>{t.subtitle}</p><LangToggle/>
    <div style={{background:"rgba(255,255,255,0.05)",borderRadius:14,padding:20,marginBottom:32,textAlign:"left"}}>
      {t.steps.map(([i,title,desc])=><div key={title} style={{display:"flex",gap:12,marginBottom:14}}><span style={{fontSize:18}}>{i}</span><div><div style={{color:G.white,fontWeight:600,fontSize:13}}>{title}</div><div style={{color:G.grey,fontSize:12}}>{desc}</div></div></div>)}
    </div>
    <button onClick={startInterview} style={{width:"100%",background:G.orange,color:G.white,border:"none",borderRadius:12,padding:"14px 0",fontSize:16,fontWeight:700,cursor:"pointer"}}>{t.start}</button>
  </div></div>);

  const phaseText=(()=>{if(screen==="planning"&&slides.length>0)return t.phases.planning+" "+(slideIdx+1)+"/"+slides.length+(slides[slideIdx]?" — "+slides[slideIdx].label:"");if(screen==="insights"&&focusType)return t.phases.insights+": "+focusType;return t.phases[screen]||"";})();

  return(<div style={{height:"100vh",display:"flex",fontFamily:"'Segoe UI',sans-serif",background:G.bg,overflow:"hidden"}}>
    {showSidebar&&<div style={{width:200,background:G.white,borderRight:"1px solid "+G.silver,padding:"14px 12px",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
      <div style={{color:G.grey,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>{t.slides} {doneCount}/{slides.length}</div>
      {slides.map(s=><Pill key={s.id} slide={s} status={statuses[s.id]||"pending"}/>)}
      {screen==="ready"&&<button onClick={doDownload} disabled={building} style={{background:building?G.grey:G.orange,color:G.white,border:"none",borderRadius:10,padding:"12px 0",fontSize:13,fontWeight:700,cursor:building?"not-allowed":"pointer",marginTop:16}}>{building?"⏳...":t.redownload}</button>}
    </div>}
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:G.deepBlue,padding:"8px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{width:28,height:28,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:G.white,fontWeight:700,fontSize:12}}>G</div>
        <div><div style={{color:G.white,fontWeight:600,fontSize:13}}>{t.title}</div><div style={{color:G.codeBlue,fontSize:11}}>{phaseText}</div></div>
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
      </div>
      {attachments.length>0&&<div style={{background:G.white,borderTop:"1px solid "+G.silver,padding:"8px 16px",display:"flex",flexWrap:"wrap",gap:6}}>
        {attachments.map((a,i)=><div key={i} style={{background:G.light,border:"1px solid "+G.silver,borderRadius:6,padding:"3px 10px",fontSize:12,color:G.deepBlue,display:"flex",alignItems:"center",gap:6}}>📄 {a.name}<span style={{cursor:"pointer",color:G.grey}} onClick={()=>setAttachments(p=>p.filter((_,j)=>j!==i))}>×</span></div>)}
      </div>}
      <div style={{background:G.white,borderTop:"1px solid "+G.silver,padding:"12px 16px",flexShrink:0}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-end",maxWidth:900,margin:"0 auto"}}>
          <button onClick={()=>fileInput.current?.click()} style={{width:36,height:36,flexShrink:0,background:"transparent",border:"1.5px dashed "+G.silver,borderRadius:9,cursor:"pointer",fontSize:16,color:G.grey}}>📎</button>
          <input ref={fileInput} type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg" style={{display:"none"}} onChange={e=>{if(e.target.files?.length)addFiles(e.target.files);e.target.value="";}}/>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();doSend();}}}
            placeholder={t.placeholder[screen]||t.placeholder.default}
            style={{flex:1,background:G.light,outline:"none",resize:"vertical",border:"1.5px solid "+(input.length>0?G.digitalBlue:G.silver),borderRadius:11,padding:"10px 14px",fontSize:14,fontFamily:"inherit",lineHeight:1.6,color:G.deepBlue,minHeight:80,maxHeight:220}}/>
          <button onClick={doSend} disabled={!canSend} style={{width:38,height:38,flexShrink:0,background:canSend?G.orange:G.silver,color:G.white,border:"none",borderRadius:"50%",fontSize:18,cursor:canSend?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button>
        </div>
      </div>
    </div>
  </div>);
}