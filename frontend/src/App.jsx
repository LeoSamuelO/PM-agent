import { useState, useRef, useEffect, useCallback } from "react";

const API = "https://pm-agent-avpl.onrender.com";
const G = {
  deepBlue:"#0C2340", digitalBlue:"#1B6CA8", codeBlue:"#5BA4CF",
  orange:"#E8521A", mint:"#3BBFAD", white:"#FFFFFF",
  grey:"#8C9BAA", silver:"#D3D9DF", light:"#EEF1F3", bg:"#F4F6F9",
};
const TODAY = new Date().toLocaleDateString("fi-FI",{year:"numeric",month:"long",day:"numeric"});

const SYSTEM = `Olet kokenut projektikonsultti Goforella. Kommunikoi AINA suomeksi.
TÄNÄÄN ON: ${TODAY}.
ROOLISI: Olet osa sovellusta joka generoi PowerPoint-tiedoston automaattisesti. Sinun EI tarvitse tehdä PPTX-tiedostoa. Roolisi on kerätä sisältö keskustelemalla.
PERUSSÄÄNNÖT:
1. ÄLÄ keksi tietoja. Käytä VAIN annettuja materiaaleja.
2. Puuttuva tieto → KYSY.
3. Ole ytimekäs, max 2-3 kappaletta.
4. Käsittele VAIN pyydetty asia. Älä hyppää eteenpäin.
5. Kysy mielipide ja odota vastaus.
6. Tarjoa mielellään 2 eri lähestymistapaa.
TÄRKEÄ: ÄLÄ KOSKAAN tuota [SLIDE_DATA] tai [STRUCTURE_DATA] tageja. Kirjoita VAIN luonnollista suomea. Sovellus hoitaa datan tallennuksen erikseen.`;

const SEARCH_TRIGGERS = ["hae","etsi","googla","selvitä","search"];

async function callAPI(messages, systemExtra, forceSearch) {
  const system = systemExtra ? SYSTEM+"\n\n"+systemExtra : SYSTEM;
  const last = [...messages].reverse().find(m=>m.role==="user")?.content||"";
  const useSearch = forceSearch || SEARCH_TRIGGERS.some(t=>last.toLowerCase().includes(t));
  const r = await fetch(API+"/api/chat",{
    method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},
    body:JSON.stringify({messages,system,useSearch}),
  });
  const d = await r.json();
  if(r.status===401){localStorage.removeItem("pm_token");window.location.reload();}
  if(d.error)throw new Error(d.error);
  return d.text;
}

/** Erillinen API-kutsu joka muuntaa luonnollisen tekstin JSON-dataksi.
 *  Tämä on "vaihe 2" kaksivaiheisesta tallennuksesta. */
async function convertToJSON(slideLabel, layout, proposalText) {
  const schemas = {
    title:'{"title":"projektin nimi","tagline":"1 lause","meta":"pvm | organisaatio","projectLead":"nimi tai tyhjä"}',
    bullets:'{"heading":"otsikko","bullets":["kohta 1","kohta 2","kohta 3"],"note":"valinnainen huomio"}',
    table:'{"heading":"otsikko","columns":["Sarake1","Sarake2","Sarake3"],"rows":[["arvo1","arvo2","arvo3"]]}',
    gantt:'{"heading":"otsikko","totalWeeks":10,"frozenWeek":null,"phases":[{"name":"Vaihe","start":1,"end":3,"critical":false}]}',
    cards:'{"heading":"otsikko","cards":[{"icon":"⚠️","title":"otsikko","desc":"kuvaus","level":"high"}]}',
    "two-col":'{"heading":"otsikko","left":{"title":"vasen","items":["kohta"]},"right":{"title":"oikea","items":["kohta"]}}',
  };
  const schema = schemas[layout] || schemas.bullets;
  const r = await callAPI([{role:"user",content:
    `Muunna alla oleva dian sisältö JSON-muotoon.

DIA: "${slideLabel}" (layout: ${layout})
JSON-SKEEMA: ${schema}

DIAN SOVITTU SISÄLTÖ:
---
${proposalText.substring(0,3000)}
---

SÄÄNNÖT:
1. Vastaa VAIN JSON-objektilla. Ei mitään muuta.
2. Käytä TÄSMÄLLEEN yllä olevan sisällön tiedot. ÄLÄ keksi uutta.
3. Jokainen kohta/rivi sisällöstä PITÄÄ olla JSON:ssa.
4. ÄLÄ muuta sanamuotoja. ÄLÄ tiivistä. ÄLÄ jätä pois.`}],
    "Olet JSON-muunnin. Vastaa VAIN validilla JSON-objektilla."
  );
  try {
    const m = r.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch(e) { console.error("JSON parse error:", e); }
  return null;
}

function strip(text) {
  let t = text;
  // Poista mahdolliset tagit jotka AI saattaa silti tuottaa
  t = t.replace(/\[SLIDE_DATA:[\w_-]+\][\s\S]*?\[\/SLIDE_DATA\]/g, "");
  t = t.replace(/\[STRUCTURE_DATA\][\s\S]*?\[\/STRUCTURE_DATA\]/g, "");
  t = t.replace(/^.*\[(SLIDE_DATA|STRUCTURE_DATA|FOCUS_TYPE|JÄRJESTELMÄOHJE).*$/gm, "");
  t = t.replace(/##[\w_]+##/g, "");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

function isShortYes(text) {
  const t = text.trim().toLowerCase(); const w = t.split(/\s+/);
  if(w.length>8) return false;
  if(["ok","joo","kyllä","selvä","hyvä","sopii","käy","juu","yes","jep","okei","sovittu","hyväksyn","edetään","aloitetaan","siirrytään","toimii","mennään","jatketaan","eteenpäin","seuraava","kunnossa","valmis"].some(x=>w.includes(x))) return true;
  return ["tämä käy","joo hyvä","tämä hyvä","mennään eteenpäin","rakenne hyvä","näillä mennään","hyvältä näyttää","sopii hyvin","ihan hyvä","tämä sopii"].some(p=>t.includes(p));
}

const LAYOUT_DESC = {title:"otsikkodia",bullets:"bullet-lista",table:"taulukko",gantt:"Gantt-kaavio",cards:"korttiruudukko","two-col":"kaksipalstainen"};

// ═══ UI ═══
function Divider({text}){return(<div style={{display:"flex",alignItems:"center",gap:12,margin:"20px 0"}}><div style={{flex:1,height:1,background:G.silver}}/><span style={{background:G.light,border:"1px solid "+G.silver,borderRadius:20,padding:"3px 14px",fontSize:12,color:G.grey,fontWeight:600,whiteSpace:"nowrap"}}>{text}</span><div style={{flex:1,height:1,background:G.silver}}/></div>);}

function Bubble({role,content}){
  const ai=role==="assistant";
  return(<div style={{display:"flex",flexDirection:ai?"row":"row-reverse",gap:10,marginBottom:16,alignItems:"flex-start"}}>
    <div style={{width:32,height:32,borderRadius:"50%",background:ai?G.deepBlue:G.orange,color:ai?G.orange:G.white,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,flexShrink:0,marginTop:2}}>{ai?"G":"P"}</div>
    <div style={{maxWidth:"76%",background:ai?G.white:G.deepBlue,color:ai?G.deepBlue:G.white,borderRadius:ai?"3px 14px 14px 14px":"14px 3px 14px 14px",padding:"12px 16px",fontSize:14,lineHeight:1.65,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{content}</div>
  </div>);}

function Pill({slide,status}){
  const cfg={pending:{bg:G.light,border:G.silver,color:G.grey,sub:""},proposing:{bg:"#FFF3EE",border:G.orange,color:G.orange,sub:"Ehdotettu"},confirming:{bg:"#E8F4FB",border:G.digitalBlue,color:G.digitalBlue,sub:"Odottaa"},done:{bg:"#E8FAF7",border:G.mint,color:G.mint,sub:"✓ Sovittu"}}[status]||{bg:G.light,border:G.silver,color:G.grey,sub:""};
  return(<div style={{background:cfg.bg,border:"1.5px solid "+cfg.border,borderRadius:10,padding:"8px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:8}}>
    <span style={{fontSize:15}}>{slide.icon||"📄"}</span>
    <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:cfg.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{slide.label}</div>
    {cfg.sub&&<div style={{fontSize:10,color:cfg.color,opacity:0.8}}>{cfg.sub}</div>}</div>
    <div style={{width:7,height:7,borderRadius:"50%",background:cfg.border,flexShrink:0}}/>
  </div>);}

// ═══ PÄÄKOMPONENTTI ═══
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
  const [building, setBuilding] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [docContext, setDocContext] = useState("");
  const [focusType, setFocusType] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [editingSlide, setEditingSlide] = useState(null);

  const bottom=useRef(); const fileInput=useRef();
  const collectedRef=useRef({}); const proposingRef=useRef(false);
  const screenRef=useRef("intro"); const slideIdxRef=useRef(0);
  const slidesRef=useRef([]); const focusTypeRef=useRef("");
  const pendingStructRef=useRef(null);
  const docContextRef=useRef("");
  // PARANNUS 1: Tallenna jokaisen dian ehdotusteksti konversio-vaihetta varten
  const lastProposalRef=useRef({});
  // PARANNUS 2: Historian tiivistelmä — sisältää vaiheet 1-4 tiivistettynä
  const summaryRef=useRef("");

  useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth"});},[msgs,busy]);
  function setScreenSync(v){setScreen(v);screenRef.current=v;}
  function setSlideIdxSync(v){setSlideIdx(v);slideIdxRef.current=v;}
  const addMsg=useCallback((role,content)=>setMsgs(p=>[...p,{role,content}]),[]);
  const addDivider=useCallback((text)=>setMsgs(p=>[...p,{type:"divider",content:text}]),[]);

  // PARANNUS 2: Tiivistetty historia API-kutsuja varten
  // Sen sijaan, että lähetetään koko viestihisoria, rakennetaan konteksti tiivistelmästä
  function buildContext() {
    let ctx = "";
    if (summaryRef.current) ctx += summaryRef.current + "\n\n";
    if (docContextRef.current) ctx += "LÄHDEMATERIAALIT:\n" + docContextRef.current.substring(0, 3000) + "\n\n";
    if (focusTypeRef.current) ctx += "FOKUS: " + focusTypeRef.current + "\n\n";
    return ctx;
  }

  // Hae viimeisimmät viestit (max N kpl) nykyisestä vaiheesta
  function recentMessages(maxPairs) {
    const all = msgs.filter(m => m.role === "user" || m.role === "assistant");
    const recent = all.slice(-(maxPairs * 2));
    return recent.map(m => ({role: m.role, content: m.content}));
  }

  // Luo tiivistelmä kun vaihdetaan vaiheesta toiseen
  async function updateSummary(phaseNote) {
    const current = summaryRef.current || "";
    summaryRef.current = current + (current ? "\n" : "") + phaseNote;
  }

  // ═══ VAIHE 1: HAASTATTELU ═══
  function startInterview(){
    setScreenSync("interview");
    setMsgs([{type:"divider",content:"💬 Vaihe 1 — Haastattelu"},
      {role:"assistant",content:"Hei! Olen Goforen projektisuunnitelma-agentti.\n\nKerro projektistasi — mitä tehdään, milloin, kenen kanssa ja mitkä ovat tärkeimmät haasteet. Voit liittää dokumentteja 📎-napista.\n\n5 vaihetta:\n1️⃣ Projektitiedot  2️⃣ Fokus  3️⃣ Havainnot  4️⃣ Rakenne  5️⃣ Diat"}]);
  }

  async function runInterview(userText,ctx){
    const extra=ctx||docContextRef.current;
    if(extra && extra.length > 100) {
      addMsg("assistant","Kiitos materiaalista! Siirrytään valitsemaan esityksen tarkoitus.");
      await updateSummary("HAASTATTELU: Käyttäjä antoi projektimateriaalin.");
      await runFocusAsk();
      return;
    }
    const r=await callAPI([...recentMessages(3),{role:"user",content:userText},
      {role:"user",content:"[JÄRJESTELMÄOHJE] Riittävätkö tiedot? Jos KYLLÄ: tiivistä 2 lauseella + ##READY_TO_PLAN##. Jos EI: kysy YKSI kysymys."}],
      "VAIHE: Haastattelu.\n"+buildContext());
    addMsg("assistant",strip(r));
    if(r.includes("##READY_TO_PLAN##")){
      await updateSummary("HAASTATTELU: "+strip(r).substring(0,300));
      await runFocusAsk();
    }
  }

  // ═══ VAIHE 2: FOKUS ═══
  async function runFocusAsk(){
    setScreenSync("focus");
    addDivider("🎯 Vaihe 2 — Esityksen fokus");
    const r=await callAPI([{role:"user",content:
      "Kerro 1 lauseella projektin tilanteesta ja kysy mihin tarkoitukseen esitys tehdään:\n1. 📋 Yleinen projektisuunnitelma\n2. ⚠️ Riskianalyysi\n3. 📅 Aikataulukatsaus\n4. 🚀 Kickoff-materiaali\n5. 👥 Sidosryhmäraportti\n6. 🔍 Muu"}],
      "VAIHE: Fokus.\n"+buildContext());
    addMsg("assistant",strip(r));
  }

  async function runFocusConfirm(userText){
    setFocusType(userText.trim()); focusTypeRef.current=userText.trim();
    await updateSummary("FOKUS: "+userText.trim());
    setScreenSync("insights");
    addDivider("🔍 Vaihe 3 — Tärkeimmät havainnot");
    const r=await callAPI([{role:"user",content:
      `Fokus: "${userText.trim()}"
Listaa 4-6 havaintoa tämän fokuksen näkökulmasta ja kysy tarkentavia kysymyksiä.
ÄLÄ ehdota diarakennetta. Kysy: "Hyväksytkö vai haluatko muuttaa?"`}],
      "VAIHE: Havainnot.\n"+buildContext());
    addMsg("assistant",strip(r));
  }

  // ═══ VAIHE 3: HAVAINNOT ═══
  async function runInsightsConfirm(userText){
    if(isShortYes(userText)){
      addMsg("assistant","Hienoa! Siirrytään rakentamaan diarakenne.");
      // Tiivistä havainnot
      const lastAi=msgs.filter(m=>m.role==="assistant").slice(-2).map(m=>m.content).join("\n");
      await updateSummary("HAVAINNOT:\n"+lastAi.substring(0,500));
      await runStructureAsk(); return;
    }
    const r=await callAPI([...recentMessages(3),{role:"user",content:userText},
      {role:"user",content:"[JÄRJESTELMÄOHJE] Päivitä havainnot. ÄLÄ ehdota diarakennetta."}],
      "VAIHE: Havainnot.\n"+buildContext());
    addMsg("assistant",strip(r));
  }

  // ═══ VAIHE 4: RAKENNE ═══
  async function runStructureAsk(){
    setScreenSync("structure");
    addDivider("📐 Vaihe 4 — Diarakenne");
    const r=await callAPI([{role:"user",content:
      `Ehdota KAKSI diarakennevaihtoehtoa fokukselle "${focusTypeRef.current}":
**Vaihtoehto A: Tiivis (4-6 diaa)** — kansi + 3-5 sisältödiaa
**Vaihtoehto B: Kattava (7-9 diaa)** — kansi + 6-8 sisältödiaa
Ensimmäinen dia on AINA: 1. 🎯 Kansi - title
Jokainen rivi: numero + emoji + nimi + layout (bullets/table/gantt/cards/two-col)
Kysy: "Kumpi sopii vai haluatko yhdistelmän?"`}],
      "VAIHE: Diarakenne.\n"+buildContext());
    const structure=tryParseStructure(strip(r));
    if(structure) pendingStructRef.current=structure;
    addMsg("assistant",strip(r));
  }

  function tryParseStructure(text){
    const lines=text.split("\n").filter(l=>/^\d+\.\s/.test(l.trim()));
    if(!lines.length) return null;
    const kw={kansi:"title",otsikko:"title",aikataulu:"gantt",gantt:"gantt",taulukko:"table",table:"table",riski:"cards",cards:"cards","two-col":"two-col"};
    return lines.map((line,i)=>{
      const iconM=line.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
      const labelM=line.match(/\d+\.\s*(?:\S+\s+)?(?:\*{0,2})([\wÀ-ÿ\s-]+?)(?:\*{0,2})\s*[-—–\(]/);
      const label=labelM?labelM[1].trim():"Dia "+(i+1);
      const id=label.toLowerCase().replace(/[^a-zäöå0-9]/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"")||"dia_"+(i+1);
      const layoutM=line.match(/[-–—]\s*(title|bullets|table|gantt|cards|two-col)/i) || line.match(/\((title|bullets|table|gantt|cards|two-col)\)/i);
      let layout=layoutM?layoutM[1].toLowerCase():"bullets";
      if(!layoutM){for(const[k,v]of Object.entries(kw)){if(line.toLowerCase().includes(k)){layout=v;break;}}}
      if(i===0&&/kansi|cover/i.test(line))layout="title";
      return{id,label,icon:iconM?iconM[1]:"📄",layout};
    });
  }

  function ensureKansi(s){
    if(!s||!s.length) return [{id:"kansi",label:"Kansi",icon:"🎯",layout:"title"}];
    return s[0].layout==="title"?s:[{id:"kansi",label:"Kansi",icon:"🎯",layout:"title"},...s];
  }

  async function runStructureConfirm(userText){
    const has=pendingStructRef.current?.length>0;
    if(isShortYes(userText)&&has){
      const confirmed=ensureKansi(pendingStructRef.current);
      addMsg("assistant","Rakenne vahvistettu! Aloitetaan diojen sisällöntuotanto.");
      await updateSummary("RAKENNE: "+confirmed.map(s=>s.label+"("+s.layout+")").join(", "));
      startPlanning(confirmed); return;
    }
    if(isShortYes(userText)&&!has){
      addMsg("assistant","Rakennetta ei tallennettu. Generoidaan uudelleen...");
      await runStructureAsk(); return;
    }
    const r=await callAPI([...recentMessages(3),{role:"user",content:userText},
      {role:"user",content:"[JÄRJESTELMÄOHJE] Tee muutokset ja näytä lopullinen rakenne. Kansi AINA 1. Kysy hyväksyntä."}],
      "VAIHE: Diarakenne.\n"+buildContext());
    const structure=tryParseStructure(strip(r));
    if(structure) pendingStructRef.current=structure;
    addMsg("assistant",strip(r));
  }

  // ═══ VAIHE 5: DIOJEN SISÄLTÖ (KAKSIVAIHEINEN) ═══
  // Vaihe A: AI ehdottaa sisällön LUONNOLLISELLA KIELELLÄ (ei tageja)
  // Vaihe B: Kun käyttäjä hyväksyy, erillinen convertToJSON muuntaa datan
  function startPlanning(confirmed){
    setSlides(confirmed);slidesRef.current=confirmed;
    setStatuses(Object.fromEntries(confirmed.map(s=>[s.id,"pending"])));
    setScreenSync("planning"); setSlideIdxSync(0);
    addDivider("📄 Vaihe 5 — Diojen sisällöntuotanto");
    setTimeout(()=>proposeSlide(0,confirmed),100);
  }

  async function proposeSlide(idx,slidesArr){
    if(proposingRef.current)return;
    proposingRef.current=true;
    try{
      const cur=slidesArr||slidesRef.current;
      setSlideIdxSync(idx);
      setStatuses(prev=>{const n={...prev};cur.forEach((s,i)=>{if(i===idx)n[s.id]="proposing";else if(n[s.id]!=="done")n[s.id]="pending";});return n;});
      const slide=cur[idx];

      // AI ehdottaa sisältöä ILMAN JSON-tageja — pelkkä luonnollinen kieli
      const prompt = slide.layout==="title"
        ? `Ehdota kansidian sisältö:\n- Otsikko (projektin nimi)\n- Tagline (1 lause)\n- Meta (päivämäärä | organisaatio)\n- Projektipäällikkö\nKysy: "Sopiiko vai muutoksia?"`
        : `Ehdota konkreettinen sisältö dialle "${slide.label}" (layout: ${LAYOUT_DESC[slide.layout]||slide.layout}).\nTarjoa 2 vaihtoehtoa ja kysy kumpi sopii.\nKirjoita sisältö selkeästi — älä käytä JSON:ia tai tageja.`;

      const r=await callAPI([{role:"user",content:`[DIA ${idx+1}/${cur.length} — ${slide.label}]\n${prompt}`}],
        "VAIHE: Diojen sisältö.\n"+buildContext());

      const cleanText=strip(r);
      lastProposalRef.current[slide.id]=cleanText;
      addDivider("📄 Dia "+(idx+1)+"/"+cur.length+" — "+(slide.icon||"")+" "+slide.label);
      addMsg("assistant",cleanText);
      setStatuses(prev=>({...prev,[slide.id]:"confirming"}));
    }finally{proposingRef.current=false;}
  }

  async function runPlanning(userText){
    const cur=slidesRef.current; const idx=slideIdxRef.current;
    const slide=cur[idx]; const isLast=idx===cur.length-1;

    const cancelWords=["en mitään","ei muutoksia","peruuta","en halua","ei tarvitse","ei muuteta","en muuta"];
    const isCancel=editingSlide!==null && cancelWords.some(w=>userText.trim().toLowerCase().includes(w));

    if(isShortYes(userText)||isCancel){
      // PARANNUS 1: Erillinen JSON-konversio hyväksytystä tekstistä
      addMsg("assistant","💾 Tallennetaan...");
      const proposalText = isCancel
        ? (lastProposalRef.current[slide.id] || "")  // Pidetään vanha
        : (lastProposalRef.current[slide.id] || "");  // Hyväksytty ehdotus

      const slideData = await convertToJSON(slide.label, slide.layout, proposalText);
      if(slideData){
        const nc={...collectedRef.current,[slide.id]:slideData};
        collectedRef.current=nc;
      }
      setStatuses(prev=>({...prev,[slide.id]:"done"}));

      if(editingSlide!==null){
        setEditingSlide(null);
        addMsg("assistant","✓ "+slide.label+(isCancel?" — ei muutoksia.":" päivitetty!"));
        showReview(cur); return;
      }

      const next=idx+1;
      if(!isLast&&next<cur.length){
        setSlideIdxSync(next);
        addMsg("assistant","✓ "+slide.label+" tallennettu. Siirrytään seuraavaan.");
        setTimeout(()=>proposeSlide(next,cur),300);
      } else {
        addMsg("assistant","✓ "+slide.label+" tallennettu.");
        showReview(cur);
      }
      return;
    }

    // Muutoksia — AI muokkaa ja päivittää ehdotusta
    const r=await callAPI([{role:"user",content:
      `Dian "${slide.label}" aiempi ehdotus:\n---\n${lastProposalRef.current[slide.id]||""}\n---\n\nKäyttäjän muutospyyntö: "${userText}"\n\nTee muutokset ja näytä uusi versio. Kysy hyväksyntä.`}],
      "VAIHE: Diojen sisältö.\n"+buildContext());
    const cleanText=strip(r);
    lastProposalRef.current[slide.id]=cleanText;
    addMsg("assistant",cleanText);
  }

  // ═══ REVIEW ═══
  function showReview(slidesArr){
    setScreenSync("review");
    const list=(slidesArr||slidesRef.current).map((s,i)=>`${i+1}. ${s.icon||"📄"} ${s.label}`).join("\n");
    setMsgs(p=>[...p,
      {type:"divider",content:"👀 Loppukatsaus"},
      {role:"assistant",content:`Kaikki ${(slidesArr||slidesRef.current).length} diaa on käyty läpi!\n\n${list}\n\nHaluatko muokata jotain diaa? Kirjoita esim. "muokkaa dia 2".\nKun olet tyytyväinen, kirjoita "valmis".`},
    ]);
  }

  async function runReview(userText){
    const lower=userText.trim().toLowerCase();
    const editMatch=lower.match(/(?:muokkaa|muuta|korjaa|palaa)\s*(?:dia(?:a|n)?|slide)?\s*(\d+)/);
    if(editMatch){
      const num=parseInt(editMatch[1])-1;
      if(num>=0&&num<slidesRef.current.length){
        const slide=slidesRef.current[num];
        setEditingSlide(num);setScreenSync("planning");setSlideIdxSync(num);
        setStatuses(prev=>({...prev,[slide.id]:"confirming"}));
        addDivider("✏️ Muokataan: Dia "+(num+1)+" — "+slide.label);
        addMsg("assistant","Mitä haluat muuttaa diassa \""+slide.label+"\"?\nKirjoita muutokset tai \"en mitään\" palataksesi.");
        return;
      }
    }
    if(["valmis","generoi","lataa","tee","luo"].some(w=>lower.includes(w))){
      doDownload(); return;
    }
    addMsg("assistant","Kirjoita \"valmis\" tai \"muokkaa dia X\".");
  }

  async function doDownload(){
    setScreenSync("ready");
    addDivider("✅ PowerPoint generoidaan");
    addMsg("assistant","Generoidaan PowerPoint...");
    setBuilding(true);
    try{
      const r=await fetch(API+"/api/build-pptx",{
        method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},
        body:JSON.stringify({slideData:collectedRef.current,slideStructure:slidesRef.current}),
      });
      if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"HTTP "+r.status);
      const blob=await r.blob();
      const url=URL.createObjectURL(blob);
      Object.assign(document.createElement("a"),{href:url,download:"projektisuunnitelma.pptx"}).click();
      URL.revokeObjectURL(url);
      addMsg("assistant","✅ PowerPoint ladattu!");
    }catch(e){addMsg("assistant","⚠️ Virhe: "+e.message);}
    setBuilding(false);
  }

  // ═══ TIEDOSTOT ═══
  async function readFile(f){
    if(f.name.match(/\.(txt|md|csv|json)$/i)){const t=await f.text().catch(()=>"");return{name:f.name,content:"["+f.name+"]\n"+t.substring(0,5000)};}
    const mm={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png"};
    const mt=mm[f.name.split(".").pop().toLowerCase()];
    if(mt){try{
      const buf=await f.arrayBuffer();const bytes=new Uint8Array(buf);let bin="";
      for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
      const r=await fetch(API+"/api/extract-file",{method:"POST",headers:{"Content-Type":"application/json","x-session-token":localStorage.getItem("pm_token")||""},body:JSON.stringify({base64:btoa(bin),mimeType:mt,fileName:f.name})});
      const d=await r.json();return{name:f.name,content:"["+f.name+(d.text?" — sisältö:]\n"+d.text:": virhe]")};
    }catch(e){return{name:f.name,content:"["+f.name+": virhe]"};}}
    return{name:f.name,content:"["+f.name+" — ei tuettu]"};
  }
  async function addFiles(fl){const read=await Promise.all(Array.from(fl).map(readFile));setAttachments(p=>[...p,...read]);}
  async function onDrop(e){
    e.preventDefault();setDragOver(false);const files=[];
    if(e.dataTransfer.items){for(const item of Array.from(e.dataTransfer.items)){if(item.kind==="file"){const f=item.getAsFile();if(f)files.push(f);}}}
    else files.push(...Array.from(e.dataTransfer.files));
    if(files.length)await addFiles(files);
  }

  // ═══ LÄHETYS ═══
  async function doSend(){
    const text=input.trim();const files=attachments;
    if(!text&&!files.length)return;if(busy)return;
    let display=text,apiText=text,newCtx=docContext;
    if(files.length>0){
      const names=files.map(f=>f.name).join(", ");const bodies=files.map(f=>f.content).join("\n\n---\n\n");
      display=(text?text+"\n\n":"")+"📎 "+names;
      apiText=(text?text+"\n\n":"Projektimateriaali:\n\n")+bodies;
      newCtx=(docContext?docContext+"\n\n---\n\n":"LÄHDEMATERIAALIT:\n\n")+bodies;
      setDocContext(newCtx);docContextRef.current=newCtx;
    }
    setInput("");setAttachments([]);
    setMsgs(p=>[...p,{role:"user",content:display}]);setBusy(true);
    try{
      const s=screenRef.current;
      if(s==="interview") await runInterview(apiText,newCtx);
      else if(s==="focus") await runFocusConfirm(apiText);
      else if(s==="insights") await runInsightsConfirm(apiText);
      else if(s==="structure") await runStructureConfirm(apiText);
      else if(s==="planning") await runPlanning(apiText);
      else if(s==="review") await runReview(apiText);
    }catch(e){addMsg("assistant","⚠️ Virhe: "+e.message);}
    setBusy(false);
  }

  async function doLogin(){
    if(!pwInput)return;
    try{const r=await fetch(API+"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pwInput})});
    const d=await r.json();if(d.token){localStorage.setItem("pm_token",d.token);setAuthed(true);}else setPwError(true);}catch{setPwError(true);}
  }

  // ═══ RENDER ═══
  const canSend=!busy&&(input.trim().length>0||attachments.length>0);
  const doneCount=Object.values(statuses).filter(s=>s==="done").length;
  const showSidebar=slides.length>0&&["planning","review","ready"].includes(screen);

  if(!authed)return(
    <div style={{minHeight:"100vh",background:G.deepBlue,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{textAlign:"center",width:320}}>
        <div style={{width:60,height:60,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:G.white,fontWeight:700,margin:"0 auto 20px"}}>G</div>
        <h2 style={{color:G.white,marginBottom:8}}>Projektisuunnitelma-agentti</h2>
        <input type="password" value={pwInput} onChange={e=>{setPwInput(e.target.value);setPwError(false);}} onKeyDown={e=>{if(e.key==="Enter")doLogin();}} placeholder="Salasana"
          style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid "+(pwError?G.orange:G.grey),background:"rgba(255,255,255,0.08)",color:G.white,fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:8}} />
        {pwError&&<div style={{color:G.orange,fontSize:13,marginBottom:8}}>Väärä salasana</div>}
        <button onClick={doLogin} style={{width:"100%",background:G.orange,color:G.white,border:"none",borderRadius:10,padding:"12px 0",fontSize:15,fontWeight:700,cursor:"pointer"}}>Kirjaudu →</button>
      </div>
    </div>
  );

  if(screen==="intro")return(
    <div style={{minHeight:"100vh",background:G.deepBlue,display:"flex",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{maxWidth:480,width:"100%",textAlign:"center"}}>
        <div style={{width:68,height:68,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,color:G.white,fontWeight:700,margin:"0 auto 24px"}}>G</div>
        <h1 style={{color:G.white,fontSize:24,fontWeight:700,margin:"0 0 8px"}}>Projektisuunnitelma-agentti</h1>
        <p style={{color:G.codeBlue,fontSize:14,lineHeight:1.7,margin:"0 0 32px"}}>Rakennetaan projektisuunnitelmasi yhdessä, dia kerrallaan.</p>
        <div style={{background:"rgba(255,255,255,0.05)",borderRadius:14,padding:20,marginBottom:32,textAlign:"left"}}>
          {[["💬","Haastattelu","Kerro projektistasi"],["🔍","Havainnot","Tunnistan riskit ja vaihtoehdot"],["🤝","Dia kerrallaan","Ehdotan sisällön, sinä vahvistat"],["📊","Valmis PPTX","Gofore-teemainen esitys"]].map(([i,t,d])=>
            <div key={t} style={{display:"flex",gap:12,marginBottom:14}}><span style={{fontSize:18}}>{i}</span><div><div style={{color:G.white,fontWeight:600,fontSize:13}}>{t}</div><div style={{color:G.grey,fontSize:12}}>{d}</div></div></div>
          )}
        </div>
        <button onClick={startInterview} style={{width:"100%",background:G.orange,color:G.white,border:"none",borderRadius:12,padding:"14px 0",fontSize:16,fontWeight:700,cursor:"pointer"}}>Aloita haastattelu →</button>
      </div>
    </div>
  );

  return(
    <div style={{height:"100vh",display:"flex",fontFamily:"'Segoe UI',sans-serif",background:G.bg,overflow:"hidden"}}>
      {showSidebar&&(
        <div style={{width:200,background:G.white,borderRight:"1px solid "+G.silver,padding:"14px 12px",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
          <div style={{color:G.grey,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Diat {doneCount}/{slides.length}</div>
          {slides.map(s=><Pill key={s.id} slide={s} status={statuses[s.id]||"pending"} />)}
          {screen==="ready"&&<button onClick={doDownload} disabled={building} style={{background:building?G.grey:G.orange,color:G.white,border:"none",borderRadius:10,padding:"12px 0",fontSize:13,fontWeight:700,cursor:building?"not-allowed":"pointer",marginTop:16}}>{building?"⏳...":"🚀 Lataa uudelleen"}</button>}
        </div>
      )}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:G.deepBlue,padding:"8px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:28,height:28,background:G.orange,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:G.white,fontWeight:700,fontSize:12}}>G</div>
          <div>
            <div style={{color:G.white,fontWeight:600,fontSize:13}}>Projektisuunnitelma-agentti</div>
            <div style={{color:G.codeBlue,fontSize:11}}>
              {screen==="interview"?"💬 Vaihe 1 — Haastattelu":screen==="focus"?"🎯 Vaihe 2 — Fokus":screen==="insights"?"🔍 Vaihe 3 — Havainnot"+(focusType?": "+focusType:""):screen==="structure"?"📐 Vaihe 4 — Diarakenne":screen==="planning"&&slides.length>0?"📄 Vaihe 5 — Dia "+(slideIdx+1)+"/"+slides.length+(slides[slideIdx]?" — "+slides[slideIdx].label:""):screen==="review"?"👀 Loppukatsaus":screen==="ready"?"✅ Valmis":""}
            </div>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"20px 16px",position:"relative"}}
          onDragOver={e=>{e.preventDefault();setDragOver(true);}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOver(false);}}
          onDrop={onDrop}>
          {dragOver&&<div style={{position:"absolute",inset:0,background:"rgba(27,108,168,0.1)",border:"2px dashed "+G.digitalBlue,borderRadius:8,zIndex:10,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}><div style={{background:G.white,borderRadius:12,padding:"24px 40px",textAlign:"center"}}><div style={{fontSize:36,marginBottom:8}}>📂</div><div style={{color:G.digitalBlue,fontWeight:600}}>Pudota tiedostot tähän</div></div></div>}
          {msgs.map((m,i)=>{
            if(m.type==="divider")return<Divider key={i} text={m.content}/>;
            return<Bubble key={i} role={m.role} content={m.content}/>;
          })}
          {busy&&<div style={{display:"flex",gap:10}}><div style={{width:32,height:32,borderRadius:"50%",background:G.deepBlue,color:G.orange,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12}}>G</div><div style={{background:G.white,borderRadius:"3px 14px 14px 14px",padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}><span style={{color:G.grey,letterSpacing:6,fontSize:16}}>● ● ●</span></div></div>}
          <div ref={bottom}/>
        </div>
        {attachments.length>0&&<div style={{background:G.white,borderTop:"1px solid "+G.silver,padding:"8px 16px",display:"flex",flexWrap:"wrap",gap:6}}>
          {attachments.map((a,i)=><div key={i} style={{background:G.light,border:"1px solid "+G.silver,borderRadius:6,padding:"3px 10px",fontSize:12,color:G.deepBlue,display:"flex",alignItems:"center",gap:6}}>📄 {a.name}<span style={{cursor:"pointer",color:G.grey,fontSize:14}} onClick={()=>setAttachments(p=>p.filter((_,j)=>j!==i))}>×</span></div>)}
        </div>}
        <div style={{background:G.white,borderTop:"1px solid "+G.silver,padding:"12px 16px",flexShrink:0}}>
          <div style={{display:"flex",gap:8,alignItems:"flex-end",maxWidth:900,margin:"0 auto"}}>
            <button title="Liitä" onClick={()=>fileInput.current?.click()} style={{width:36,height:36,flexShrink:0,alignSelf:"flex-end",background:"transparent",border:"1.5px dashed "+G.silver,borderRadius:9,cursor:"pointer",fontSize:16,color:G.grey}}>📎</button>
            <input ref={fileInput} type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg" style={{display:"none"}} onChange={e=>{if(e.target.files?.length)addFiles(e.target.files);e.target.value="";}}/>
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();doSend();}}}
              placeholder={screen==="review"?"Kirjoita 'valmis' tai 'muokkaa dia X'...":screen==="interview"?"Kerro projektistasi...":"Kommentoi tai hyväksy..."}
              style={{flex:1,background:G.light,outline:"none",resize:"vertical",border:"1.5px solid "+(input.length>0?G.digitalBlue:G.silver),borderRadius:11,padding:"10px 14px",fontSize:14,fontFamily:"inherit",lineHeight:1.6,color:G.deepBlue,minHeight:80,maxHeight:220}}/>
            <button onClick={doSend} disabled={!canSend}
              style={{width:38,height:38,flexShrink:0,alignSelf:"flex-end",background:canSend?G.orange:G.silver,color:G.white,border:"none",borderRadius:"50%",fontSize:18,cursor:canSend?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s"}}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}