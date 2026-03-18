require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Auth ──────────────────────────────────────────────────────────
const PASSWORD = process.env.APP_PASSWORD || "AgenttiTestaus123";
const sessions = new Map();
function generateToken() { return require("crypto").randomBytes(32).toString("hex"); }
function isValidToken(token) {
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { sessions.delete(token); return false; }
  return true;
}
app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/api/login") return next();
  if (!isValidToken(req.headers["x-session-token"])) return res.status(401).json({ error: "Istunto vanhentunut" });
  next();
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post("/api/login", (req, res) => {
  if (req.body.password !== PASSWORD) return res.status(401).json({ error: "Väärä salasana" });
  const token = generateToken();
  sessions.set(token, Date.now() + 8 * 3600000);
  res.json({ token });
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

// ── File extract ──────────────────────────────────────────────────
app.post("/api/extract-file", async (req, res) => {
  const { base64, mimeType, fileName } = req.body;
  if (!base64 || !mimeType) return res.status(400).json({ error: "base64/mimeType puuttuu" });
  try {
    const block = mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } };
    const r = await client.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 2000,
      messages: [{ role: "user", content: [block, { type: "text", text: "Lue tiedosto (" + fileName + "). Tiivistä oleellinen projektitieto suomeksi." }] }]
    });
    res.json({ text: r.content.find(b => b.type === "text")?.text || "" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Chat ──────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages, system, useSearch } = req.body;
  if (!messages?.length) return res.status(400).json({ error: "messages puuttuu" });
  try {
    const params = { model: "claude-sonnet-4-20250514", max_tokens: 4000, system: system || "Olet projektikonsultti. Suomeksi.", messages };
    if (useSearch) params.tools = [{ type: "web_search_20250305", name: "web_search" }];
    const r = await client.messages.create(params);
    res.json({ text: r.content.filter(b => b.type === "text").map(b => b.text).join("\n") });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PPTX — Python + Gofore-template (fallback: pptxgenjs) ────────
app.post("/api/build-pptx", async (req, res) => {
  const { slideData, slideStructure } = req.body;
  if (!slideData || !slideStructure?.length) return res.status(400).json({ error: "Data puuttuu" });

  for (const sd of slideStructure) {
    if (!slideData[sd.id]) slideData[sd.id] = getDefault(sd);
  }

  const ts = Date.now();
  const outPath = path.join(__dirname, "pptx_" + ts + ".pptx");
  const jsonPath = path.join(__dirname, "pptx_data_" + ts + ".json");
  const script = path.join(__dirname, "build_pptx.py");

  // KRIITTINEN FIX: Kirjoita payload TIEDOSTOON, ei CLI-argumenttina
  // (CLI-argumentti voi olla liian pitkä suurille esityksille)
  if (fs.existsSync(script)) {
    try {
      fs.writeFileSync(jsonPath, JSON.stringify({ slideData, slideStructure }), "utf8");
      console.log("📝 JSON kirjoitettu:", jsonPath, "(" + fs.statSync(jsonPath).size + " bytes)");

      await new Promise((ok, fail) => {
        execFile("python3", [script, "--file", jsonPath, outPath], {
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000,
        }, (err, stdout, stderr) => {
          if (err) {
            console.error("Python stderr:", stderr);
            fail(new Error(stderr || err.message));
          } else {
            console.log("Python stdout:", stdout.trim());
            ok(stdout);
          }
        });
      });

      // Siivoa JSON-tiedosto
      fs.unlink(jsonPath, () => {});

      if (fs.existsSync(outPath)) {
        console.log("✅ Python PPTX generoitu:", outPath);
        return res.download(outPath, "projektisuunnitelma.pptx", () => fs.unlink(outPath, () => {}));
      }
    } catch (e) {
      console.error("❌ Python PPTX-virhe:", e.message);
      fs.unlink(outPath, () => {});
      fs.unlink(jsonPath, () => {});
    }
  } else {
    console.warn("⚠️ build_pptx.py ei löydy:", script);
  }

  // Fallback: pptxgenjs
  console.log("⚠️ Käytetään pptxgenjs fallbackia");
  try {
    const fbPath = await buildFallbackPPTX(slideData, slideStructure);
    res.download(fbPath, "projektisuunnitelma.pptx", () => fs.unlink(fbPath, () => {}));
  } catch (err) {
    res.status(500).json({ error: "PPTX epäonnistui: " + err.message });
  }
});

function getDefault(sd) {
  const m = { title:{title:sd.label||"Projekti",tagline:"",meta:""}, bullets:{heading:sd.label||"",bullets:["(Puuttuu)"]},
    table:{heading:sd.label||"",columns:["Tieto"],rows:[["(Puuttuu)"]]}, cards:{heading:sd.label||"",cards:[{icon:"📌",title:"(Puuttuu)",desc:"",level:"medium"}]},
    "two-col":{heading:sd.label||"",left:{title:"",items:["(Puuttuu)"]},right:{title:"",items:[]}},
    gantt:{heading:sd.label||"Aikataulu",totalWeeks:8,phases:[{name:"(Puuttuu)",start:1,end:4,critical:false}]} };
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
      s.addText(d.title||"Projekti",{x:0.9,y:1.4,w:8.5,h:2.2,fontSize:36,fontFace:F,bold:true,color:C.white,margin:0});
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
      const cards=d.cards||[],lc={high:"C0392B",medium:"E67E22",low:"27AE60"},nc=Math.min(cards.length,3),cw=12.3/Math.max(nc,1);
      cards.slice(0,3).forEach((c,i)=>{const x=0.5+i*cw,cc=lc[String(c.level||"").toLowerCase()]||C.digitalBlue;
        s.addShape(pres.shapes.RECTANGLE,{x,y:1,w:cw-0.2,h:2.4,fill:{color:C.white},line:{color:C.silver}});
        s.addShape(pres.shapes.RECTANGLE,{x,y:1,w:cw-0.2,h:0.06,fill:{color:cc}});
        s.addText(c.icon||"📌",{x:x+0.1,y:1.1,w:0.5,h:0.5,fontSize:22,margin:0});
        s.addText(c.title||"",{x:x+0.65,y:1.1,w:cw-1,h:0.44,fontSize:13,fontFace:F,bold:true,color:C.deepBlue,margin:0});
        s.addText(c.desc||"",{x:x+0.1,y:1.62,w:cw-0.4,h:1.6,fontSize:11,fontFace:F,color:C.grey,margin:0});});
    } else if (sd.layout==="two-col") {
      const s=pres.addSlide(); s.background={color:C.white}; hdr(s,d.heading||sd.label);
      [d.left||{},d.right||{}].forEach((col,ci)=>{const x=ci===0?0.5:6.9;
        s.addShape(pres.shapes.RECTANGLE,{x,y:0.82,w:6,h:0.38,fill:{color:ci===0?C.deepBlue:C.digitalBlue}});
        s.addText(col.title||"",{x:x+0.1,y:0.82,w:5.8,h:0.38,fontSize:12,fontFace:F,bold:true,color:C.white,valign:"middle",margin:0});
        (col.items||[]).slice(0,8).forEach((it,ii)=>{s.addText(it,{x:x+0.42,y:1.28+ii*0.62,w:5.4,h:0.52,fontSize:12,fontFace:F,color:C.deepBlue,valign:"middle",margin:0});});});
    } else {
      // Bullets — FIX: pienennä fonttia jos paljon sisältöä
      const s=pres.addSlide(); s.background={color:C.white}; hdr(s,d.heading||sd.label);
      const bullets=d.bullets||[];
      const fontSize = bullets.length > 7 ? 11 : bullets.length > 5 ? 12 : 13;
      const rowH = bullets.length > 7 ? 0.55 : bullets.length > 5 ? 0.6 : 0.7;
      bullets.slice(0,10).forEach((b,i)=>{
        s.addShape(pres.shapes.RECTANGLE,{x:0.5,y:0.88+i*rowH,w:0.06,h:rowH-0.2,fill:{color:C.orange}});
        s.addText(b,{x:0.75,y:0.88+i*rowH,w:12,h:rowH,fontSize,fontFace:F,color:C.deepBlue,valign:"middle",margin:0});
      });
    }
  }
  const es=pres.addSlide();es.background={color:C.deepBlue};es.addText("Pioneering\nan ethical\ndigital world.",{x:0.8,y:1.8,w:8,h:2.8,fontSize:34,fontFace:F,bold:true,color:C.white,margin:0});es.addText("GOFORE",{x:0.8,y:6.85,w:3,h:0.35,fontSize:12,fontFace:F,bold:true,color:C.orange,charSpacing:5,margin:0});
  const out=path.join(__dirname,"pptx_fb_"+Date.now()+".pptx");
  await pres.writeFile({fileName:out}); return out;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Gofore agentti portissa ${PORT}`));