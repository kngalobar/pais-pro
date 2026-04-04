import { useState } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from "recharts";

const CATS = [
  { id:"financial",   label:"Financial Viability",        weight:0.30, color:"#C5993A" },
  { id:"market",      label:"Market & Macro Quality",     weight:0.20, color:"#4A90D9" },
  { id:"physical",    label:"Physical Condition & CapEx", weight:0.15, color:"#27AE60" },
  { id:"operational", label:"Operational & Management",   weight:0.15, color:"#8B5CF6" },
  { id:"location",    label:"Location & Submarket",       weight:0.10, color:"#E67E22" },
  { id:"strategic",   label:"Strategic Fit & Exit",       weight:0.10, color:"#E91E8C" },
];
const HARD_FILTERS = [
  { id:"rc",   label:"Acquisition price > 85% of replacement cost" },
  { id:"dscr", label:"DSCR below 1.20x" },
  { id:"rti",  label:"Rent-to-income ratio above 35%" },
  { id:"emp",  label:"Single employer > 30% of submarket employment" },
  { id:"env",  label:"Phase II environmental required" },
  { id:"ins",  label:"Insurance premiums escalating 15%+ annually" },
  { id:"rc2",  label:"Active / pending rent control legislation" },
];
const GUIDES = {
  financial:   ["85–100: Cap rate ≥ market+150bps, DSCR >1.35x, price <70% replacement cost","70–84: Cap rate at market, DSCR 1.20–1.35x, price 70–80% replacement cost","55–69: Cap rate slightly below market, DSCR 1.10–1.20x","<55: Negative leverage, DSCR <1.10x, exceeds replacement cost"],
  market:      ["85–100: Top-quartile population/job growth, supply-constrained","70–84: Above-average growth, moderate supply pipeline","55–69: Flat or mixed fundamentals","<55: Declining population, oversupplied, employer concentration"],
  physical:    ["85–100: Built post-2000, all systems <10yr remaining life","70–84: Built 1990s, moderate CapEx, no environmental","55–69: Built 1970s–80s, significant CapEx","<55: Pre-1970, major systems at end of life"],
  operational: ["85–100: Occupancy >95%, institutional PM, strong collections","70–84: Occupancy 90–95%, professional PM","55–69: Occupancy 85–90%, deferred maintenance","<55: Occupancy <85%, self-managed, poor collections"],
  location:    ["85–100: Walk Score >80, major employment proximity, A/B neighborhood","70–84: Walk Score 60–80, suburban employment access","55–69: Car-dependent, secondary employment","<55: Isolated, weak employment, declining neighborhood"],
  strategic:   ["85–100: Ideal mandate fit, broad exit buyer universe","70–84: Good fit, adequate exit options","55–69: Acceptable fit, limited exit buyers","<55: Off-mandate, thin exit market"],
};
const ASSET_TYPES = ["SFR","Duplex/Triplex/Quad","Small Multifamily (5–20)","Multifamily (21–100)","Large Multifamily (100+)"];
const DEAL_TYPES  = ["Acquisition","Value-Add","Development","Refinance"];
const PLANS = [
  { tier:"analyst", label:"Analyst", price:"$29", features:["10 deals/month","AI comps & rates","Sensitivity analysis","PDF memos"] },
  { tier:"pro",     label:"Pro",     price:"$79", highlight:true, features:["Unlimited deals","All AI features","Pipeline view","Docx export"] },
  { tier:"team",    label:"Team",    price:"$149", features:["5 users","All Pro features","Shared pipeline","Priority support"] },
];

function getBand(s) {
  if (s>=85) return { label:"Strong Buy",        color:"#27AE60", bg:"#e8f5e9", border:"#27AE60" };
  if (s>=70) return { label:"Qualified Buy",     color:"#C5993A", bg:"#fff8e1", border:"#C5993A" };
  if (s>=55) return { label:"Further Diligence", color:"#E67E22", bg:"#fff3e0", border:"#E67E22" };
  return            { label:"Decline / Pass",    color:"#E53935", bg:"#ffebee", border:"#E53935" };
}
function getComposite(sc) { return CATS.reduce((s,c)=>s+(sc[c.id]||0)*c.weight,0); }
function calcFin(f) {
  const price=+f.price||0,noi=+f.noi||0,down=+f.down||25,rate=+f.rate||6.5,yrs=+f.yrs||30,units=+f.units||1,gri=+f.gri||0,rc=+f.rc||0;
  const eq=price*(down/100),loan=price-eq,mr=rate/100/12,n=yrs*12;
  const mp=loan>0&&mr>0?loan*(mr*Math.pow(1+mr,n))/(Math.pow(1+mr,n)-1):0;
  const ads=mp*12,capRate=price>0?(noi/price)*100:0,cf=noi-ads;
  return { eq,loan,ads,mp,capRate,cf,coc:eq>0?(cf/eq)*100:0,dscr:ads>0?noi/ads:0,grm:gri>0?price/gri:0,rcPct:rc>0?(price/rc)*100:0,ppu:units>0?price/units:0,noiPpu:units>0?noi/units:0 };
}
function getTrialState() {
  try {
    let start=localStorage.getItem("pais_trial_start");
    if(!start){start=new Date().toISOString();localStorage.setItem("pais_trial_start",start);}
    const tier=localStorage.getItem("pais_sub_tier")||"trial";
    const elapsed=Math.floor((Date.now()-new Date(start))/86400000);
    const remaining=Math.max(0,14-elapsed);
    const isPaid=["analyst","pro","team"].includes(tier);
    return {tier,elapsed,remaining,isExpired:tier==="trial"&&elapsed>=14,isPaid};
  } catch { return {tier:"trial",elapsed:0,remaining:14,isExpired:false,isPaid:false}; }
}
function simUpgrade(tier){try{localStorage.setItem("pais_sub_tier",tier);window.location.reload();}catch{}}

const fmt=(n,d=1)=>isNaN(n)?"—":n.toFixed(d);
const fmtC=n=>(!n||isNaN(n))?"—":"$"+Math.round(n).toLocaleString();
const fmtP=n=>isNaN(n)?"—":n.toFixed(2)+"%";

function PlanCard({p,onClick}){
  return(
    <div onClick={onClick} style={{padding:16,border:`2px solid ${p.highlight?"#C5993A":"#e8eaed"}`,borderRadius:10,background:p.highlight?"#fff8e1":"#fafafa",cursor:"pointer",position:"relative"}}>
      {p.highlight&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:"#C5993A",color:"#1B2A4A",fontSize:10,fontWeight:800,padding:"2px 10px",borderRadius:10,whiteSpace:"nowrap"}}>MOST POPULAR</div>}
      <div style={{fontWeight:700,color:"#1B2A4A",marginBottom:4}}>{p.label}</div>
      <div style={{fontSize:24,fontWeight:900,color:"#C5993A",marginBottom:10}}>{p.price}<span style={{fontSize:11,color:"#aaa"}}>/mo</span></div>
      {p.features.map(f=><div key={f} style={{fontSize:11,color:"#555",marginBottom:3}}>✓ {f}</div>)}
    </div>
  );
}

function SensTable({f}){
  const br=+f.rate||6.5,bv=+f.vacancy||5,price=+f.price||1,noi=+f.noi||0,eq=(+f.price||0)*(+f.down||25)/100;
  const rates=[br-1,br-0.5,br,br+0.5,br+1],vacs=[bv-5,bv,bv+5,bv+10,bv+15];
  function coc(r,v){const loan=price-eq,mr=r/100/12,n=360;const mp=loan>0&&mr>0?loan*(mr*Math.pow(1+mr,n))/(Math.pow(1+mr,n)-1):0;return eq>0?(noi*(1-Math.max(0,v)/100)-mp*12)/eq*100:0;}
  function cc(v){return v>=10?"#27AE60":v>=6?"#C5993A":v>=0?"#E67E22":"#E53935";}
  return(
    <div style={{overflowX:"auto"}}>
      <p style={{fontSize:12,color:"#888",marginBottom:8}}>Cash-on-Cash Return (%) — Interest Rate vs. Vacancy</p>
      <table style={{borderCollapse:"collapse",fontSize:13,width:"100%"}}>
        <thead><tr>
          <th style={{padding:"6px 10px",background:"#1B2A4A",color:"#C5993A",textAlign:"left"}}>Rate ↓ / Vac →</th>
          {vacs.map(v=><th key={v} style={{padding:"6px 10px",background:"#1B2A4A",color:"#fff",textAlign:"center"}}>{Math.max(0,v).toFixed(0)}%</th>)}
        </tr></thead>
        <tbody>{rates.map((r,ri)=>(
          <tr key={r} style={{background:ri%2===0?"#f8f9fa":"#fff"}}>
            <td style={{padding:"6px 10px",fontWeight:600,color:"#1B2A4A"}}>{r.toFixed(1)}%</td>
            {vacs.map(v=>{const val=coc(r,v);return(<td key={v} style={{padding:"6px 10px",textAlign:"center",fontWeight:600,color:cc(val),background:r===br&&v===bv?"#fffde7":"transparent"}}>{val.toFixed(1)}%</td>);})}
          </tr>
        ))}</tbody>
      </table>
      <p style={{fontSize:11,color:"#aaa",marginTop:6}}>Yellow = base case · Green ≥10% · Amber 6–10% · Orange 0–6% · Red negative</p>
    </div>
  );
}

function AIPanel({deal}){
  const [q,setQ]=useState("");const [res,setRes]=useState("");const [loading,setLoading]=useState(false);
  const presets=["Analyze submarket fundamentals — vacancy trends, rent growth, supply pipeline, employment base.","What are current cap rates for this asset class and market? How does our cap rate compare?","What are current DSCR loan, agency, and bridge rates for this deal type?","Identify the top 3 risks for this deal and suggest specific mitigations.","Draft a one-paragraph IC memo narrative for investment committee review."];
  const ctx=()=>`Property: ${deal.intake.address||"TBD"}, ${deal.intake.city||""} ${deal.intake.state||""}\nAsset: ${deal.intake.assetType} · Deal: ${deal.intake.dealType} · Units: ${deal.intake.units||"N/A"}\nPrice: $${(+deal.intake.price||0).toLocaleString()} · NOI: $${(+deal.intake.noi||0).toLocaleString()}\nPAIS Score: ${deal.comp.toFixed(1)} — ${deal.b.label}`;
  const ask=async(query)=>{
    if(!query.trim())return;setLoading(true);setRes("");
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:"You are a sharp real estate investment analyst. Respond in 3–5 tight paragraphs, no bullet points. Be direct and specific. Flag risks clearly.",messages:[{role:"user",content:`Deal context:\n${ctx()}\n\nQuestion: ${query}`}]})});
      const d=await r.json();setRes(d.content?.find(b=>b.type==="text")?.text||"No response.");
    }catch{setRes("Connection error.");}
    setLoading(false);
  };
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        {presets.map((p,i)=>(<button key={i} onClick={()=>{setQ(p);ask(p);}} style={{padding:"8px 12px",background:"#f0f4ff",border:"1px solid #c8d8ff",borderRadius:6,fontSize:12,color:"#1B2A4A",cursor:"pointer",textAlign:"left",lineHeight:1.4}}>{p.substring(0,65)}…</button>))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <textarea value={q} onChange={e=>setQ(e.target.value)} rows={3} placeholder="Ask anything about this deal — market, financing, risks, comps..." style={{flex:1,padding:"10px 14px",border:"1.5px solid #ddd",borderRadius:8,fontSize:14,fontFamily:"inherit",resize:"vertical"}}/>
        <button onClick={()=>ask(q)} disabled={loading} style={{padding:"0 20px",background:"#1B2A4A",color:"#C5993A",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14,minWidth:80}}>{loading?"…":"Ask"}</button>
      </div>
      {loading&&<div style={{padding:20,textAlign:"center",color:"#888"}}>Analyzing deal…</div>}
      {res&&<div style={{padding:20,background:"#f8f9fa",borderRadius:8,border:"1px solid #e8eaed",fontSize:14,lineHeight:1.7,color:"#1B2A4A",whiteSpace:"pre-wrap"}}>{res}</div>}
    </div>
  );
}

// ─── AI INTAKE COMPONENT ─────────────────────────────────────────────────────
function AIIntakePanel({ onPopulate }) {
  const [sources, setSources] = useState([]);
  const [pasted, setPasted] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  const addPasted = () => {
    if (!pasted.trim()) return;
    setSources(s => [...s, { id: Date.now(), name: "Pasted text", content: pasted, type: "text" }]);
    setPasted("");
  };

  const addFile = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const content = await new Promise((res, rej) => {
        const reader = new FileReader();
        if (file.type === "application/pdf" || file.type.startsWith("image/")) {
          reader.onload = () => res(reader.result);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        } else {
          reader.onload = () => res(reader.result);
          reader.onerror = rej;
          reader.readAsText(file);
        }
      });
      setSources(s => [...s, { id: Date.now() + Math.random(), name: file.name, content, type: file.type || "text" }]);
    }
    e.target.value = "";
  };

  const removeSource = (id) => setSources(s => s.filter(x => x.id !== id));

  const SYS = `You are a real estate deal analyst. Extract all available deal information from the provided sources and return ONLY a valid JSON object with these exact keys (use null for any field not found):
{"address":string|null,"city":string|null,"state":string|null,"units":number|null,"assetType":"SFR"|"Duplex/Triplex/Quad"|"Small Multifamily (5–20)"|"Multifamily (21–100)"|"Large Multifamily (100+)"|null,"dealType":"Acquisition"|"Value-Add"|"Development"|"Refinance"|null,"price":number|null,"noi":number|null,"gri":number|null,"vacancy":number|null,"down":number|null,"rate":number|null,"yrs":number|null,"rc":number|null,"notes":string|null}
Return ONLY the JSON. No explanation, no markdown fences.`;

  const extract = async () => {
    if (sources.length === 0) { setError("Add at least one source first."); return; }
    setExtracting(true); setError(""); setPreview(null);
    try {
      const userContent = [];
      for (const src of sources) {
        if ((src.type.startsWith("image/") || src.type === "application/pdf") && src.content.startsWith("data:")) {
          const mediaType = src.type === "application/pdf" ? "application/pdf" : src.type;
          const b64 = src.content.split(",")[1];
          const blockType = src.type === "application/pdf" ? "document" : "image";
          userContent.push({ type: blockType, source: { type: "base64", media_type: mediaType, data: b64 } });
          userContent.push({ type: "text", text: `[Above: ${src.name}]` });
        } else {
          userContent.push({ type: "text", text: `--- SOURCE: ${src.name} ---
${src.content}
--- END ---` });
        }
      }
      userContent.push({ type: "text", text: "Extract all real estate deal fields." });
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: SYS, messages: [{ role: "user", content: userContent }] })
      });
      const data = await resp.json();
      const raw = data.content?.find(b => b.type === "text")?.text || "";
      setPreview(JSON.parse(raw.replace(/```json|```/g,"").trim()));
    } catch (e) { setError("Extraction failed: " + e.message); }
    setExtracting(false);
  };

  const AT = ["SFR","Duplex/Triplex/Quad","Small Multifamily (5–20)","Multifamily (21–100)","Large Multifamily (100+)"];
  const DT = ["Acquisition","Value-Add","Development","Refinance"];

  const applyToForm = () => {
    if (!preview) return;
    onPopulate({
      address: preview.address||"", city: preview.city||"", state: preview.state||"",
      units: preview.units!=null?String(preview.units):"",
      assetType: AT.includes(preview.assetType)?preview.assetType:"Multifamily (21–100)",
      dealType: DT.includes(preview.dealType)?preview.dealType:"Acquisition",
      price: preview.price!=null?String(preview.price):"",
      noi: preview.noi!=null?String(preview.noi):"",
      gri: preview.gri!=null?String(preview.gri):"",
      vacancy: preview.vacancy!=null?String(preview.vacancy):"5",
      down: preview.down!=null?String(preview.down):"25",
      rate: preview.rate!=null?String(preview.rate):"6.5",
      yrs: preview.yrs!=null?String(preview.yrs):"30",
      rc: preview.rc!=null?String(preview.rc):"",
      notes: preview.notes||"",
    });
    setPreview(null); setSources([]);
  };

  const LABELS = {address:"Address",city:"City",state:"State",units:"Units",assetType:"Asset Type",dealType:"Deal Type",price:"Asking Price",noi:"NOI (annual)",gri:"Gross Rental Income",vacancy:"Vacancy %",down:"Down Payment %",rate:"Loan Rate %",yrs:"Amortization",rc:"Replacement Cost",notes:"Notes"};
  const fv = (k,v) => { if(v==null)return null; if(["price","noi","gri","rc"].includes(k))return "$"+Number(v).toLocaleString(); if(["vacancy","down","rate"].includes(k))return v+"%"; if(k==="yrs")return v+" yrs"; return String(v); };

  return (
    <div>
      <div style={{marginBottom:24,padding:20,background:"#fff8e1",borderRadius:10,border:"1.5px solid #C5993A"}}>
        <p style={{fontSize:14,color:"#7a5c00",fontWeight:700,marginBottom:4}}>✦ AI-Assisted Deal Intake</p>
        <p style={{fontSize:13,color:"#a07820",lineHeight:1.6,margin:0}}>Add any combination of sources — paste an OM excerpt, broker email, Zillow listing, rent roll, or raw numbers. Upload PDFs or images. Claude reads everything together and populates every PAIS field it can find.</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <div style={{background:"#fff",borderRadius:10,padding:20,border:"1px solid #e8eaed"}}>
          <p style={{fontSize:13,fontWeight:700,color:"#1B2A4A",marginBottom:12}}>Paste Text</p>
          <textarea value={pasted} onChange={e=>setPasted(e.target.value)} rows={9}
            placeholder={"Paste anything:

• Broker email or OM excerpt
• Zillow / LoopNet listing text
• Rent roll figures
• Raw numbers: '72 units, $4.5M ask, $315K NOI'
• Multiple pastes — each becomes its own source"}
            style={{width:"100%",padding:"10px 14px",border:"1.5px solid #ddd",borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.6}}/>
          <button onClick={addPasted} disabled={!pasted.trim()} style={{marginTop:10,padding:"8px 18px",background:pasted.trim()?"#1B2A4A":"#e0e0e0",color:pasted.trim()?"#C5993A":"#aaa",border:"none",borderRadius:6,fontSize:13,fontWeight:700,cursor:pasted.trim()?"pointer":"default"}}>+ Add Source</button>
        </div>
        <div style={{background:"#fff",borderRadius:10,padding:20,border:"1px solid #e8eaed"}}>
          <p style={{fontSize:13,fontWeight:700,color:"#1B2A4A",marginBottom:12}}>Upload Files</p>
          <label style={{display:"block",padding:"28px 20px",border:"2px dashed #C5993A",borderRadius:10,textAlign:"center",cursor:"pointer",background:"#fffbf0",marginBottom:12}}>
            <input type="file" multiple accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={addFile} style={{display:"none"}}/>
            <div style={{fontSize:32,marginBottom:8}}>📎</div>
            <div style={{fontSize:13,color:"#7a5c00",fontWeight:700}}>Click to upload</div>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>PDF · TXT · CSV · PNG · JPG</div>
          </label>
          <p style={{fontSize:11,color:"#aaa",lineHeight:1.6}}>PDFs: offering memos, rent rolls, T12s<br/>Images: screenshots, scanned docs, listing photos<br/>Text: exported spreadsheets, broker packages</p>
        </div>
      </div>
      {sources.length>0&&(
        <div style={{background:"#fff",borderRadius:10,padding:20,border:"1px solid #e8eaed",marginBottom:20}}>
          <p style={{fontSize:13,fontWeight:700,color:"#1B2A4A",marginBottom:12}}>Sources ({sources.length})</p>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            {sources.map(s=>(
              <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#f8f9fa",borderRadius:8,border:"1px solid #eee"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18}}>{s.type==="text"?"📝":s.type.startsWith("image")?"🖼️":"📄"}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"#1B2A4A"}}>{s.name}</div>
                    <div style={{fontSize:11,color:"#aaa"}}>{s.type==="text"?s.content.substring(0,80).replace(/
/g," ")+"…":s.type}</div>
                  </div>
                </div>
                <button onClick={()=>removeSource(s.id)} style={{background:"none",border:"none",color:"#ccc",fontSize:18,cursor:"pointer"}}>×</button>
              </div>
            ))}
          </div>
          <button onClick={extract} disabled={extracting}
            style={{width:"100%",padding:"13px 0",background:extracting?"#e0e0e0":"#1B2A4A",color:extracting?"#aaa":"#C5993A",border:"none",borderRadius:8,fontSize:15,fontWeight:800,cursor:extracting?"default":"pointer",letterSpacing:"0.04em"}}>
            {extracting?`✦ Extracting from ${sources.length} source${sources.length>1?"s":""}…`:`✦ Extract Deal Data from ${sources.length} Source${sources.length>1?"s":""}`}
          </button>
        </div>
      )}
      {error&&<div style={{padding:14,background:"#ffebee",borderRadius:8,border:"1px solid #E53935",color:"#c62828",fontSize:13,marginBottom:16}}>{error}</div>}
      {preview&&(
        <div style={{background:"#fff",borderRadius:10,border:"2px solid #27AE60",padding:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <p style={{fontSize:15,fontWeight:800,color:"#1B2A4A",margin:0}}>✓ Extraction Complete</p>
              <p style={{fontSize:12,color:"#888",marginTop:2}}>Green = found · Grey = not in sources. Review then apply.</p>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setPreview(null)} style={{padding:"8px 16px",background:"#f0f0f0",color:"#666",border:"none",borderRadius:6,fontSize:13,cursor:"pointer"}}>Discard</button>
              <button onClick={applyToForm} style={{padding:"8px 20px",background:"#27AE60",color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer"}}>Apply to Deal Form →</button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {Object.entries(LABELS).filter(([k])=>k!=="notes").map(([k,l])=>{
              const val=fv(k,preview[k]); const found=val!==null;
              return(<div key={k} style={{padding:"10px 14px",borderRadius:8,background:found?"#e8f5e9":"#f8f8f8",border:`1px solid ${found?"#a5d6a7":"#eee"}`}}>
                <div style={{fontSize:10,color:found?"#2e7d32":"#aaa",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>{l}</div>
                <div style={{fontSize:14,fontWeight:found?700:400,color:found?"#1B2A4A":"#ccc"}}>{found?val:"—"}</div>
              </div>);
            })}
          </div>
          {preview.notes&&<div style={{marginTop:12,padding:"10px 14px",background:"#e8f5e9",borderRadius:8,border:"1px solid #a5d6a7"}}><div style={{fontSize:10,color:"#2e7d32",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Deal Notes Extracted</div><div style={{fontSize:13,color:"#1B2A4A",lineHeight:1.6}}>{preview.notes}</div></div>}
        </div>
      )}
    </div>
  );
}

function F({label,value,onChange,placeholder,type="text"}){
  return(<div><label style={{fontSize:12,color:"#666",fontWeight:600,display:"block",marginBottom:4}}>{label}</label><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"10px 14px",border:"1.5px solid #ddd",borderRadius:8,fontSize:14,fontFamily:"inherit",boxSizing:"border-box"}}/></div>);
}
function Sel({label,value,onChange,options}){
  return(<div><label style={{fontSize:12,color:"#666",fontWeight:600,display:"block",marginBottom:4}}>{label}</label><select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"10px 14px",border:"1.5px solid #ddd",borderRadius:8,fontSize:14,fontFamily:"inherit",boxSizing:"border-box",background:"#fff"}}>{options.map(o=><option key={o}>{o}</option>)}</select></div>);
}

export default function PAISPro(){
  const trial=getTrialState();
  const [tab,setTab]=useState("intake");
  const [pipe,setPipe]=useState([]);
  const [modal,setModal]=useState(false);
  const [intake,setI]=useState({address:"",city:"",state:"",units:"",assetType:"Multifamily (21–100)",dealType:"Acquisition",price:"",noi:"",gri:"",vacancy:"5",down:"25",rate:"6.5",yrs:"30",rc:"",notes:""});
  const [scores,setSc]=useState({financial:70,market:70,physical:70,operational:70,location:70,strategic:70});
  const [filters,setFl]=useState(Object.fromEntries(HARD_FILTERS.map(f=>[f.id,"clear"])));
  const [amends,setAm]=useState({a1:false,a2:false,a3:false});

  const fin=calcFin(intake);
  const comp=getComposite(scores);
  const b=getBand(comp);
  const deal={intake,scores,filters,amends,fin,comp,b};
  const flagged=HARD_FILTERS.filter(f=>filters[f.id]==="flagged");

  const populateFromAI = (fields) => {
    setI(p => ({ ...p, ...fields }));
    setTab("intake");
  };

  const save=()=>{
    setPipe(p=>[{id:Date.now(),address:intake.address||"Untitled",city:intake.city,state:intake.state,assetType:intake.assetType,comp,band:b.label,price:intake.price,capRate:fin.capRate,saved:new Date().toLocaleString()},...p]);
    setTab("pipeline");
  };

  const TABS=[{id:"aiintake",label:"✦ AI Intake"},{id:"intake",label:"Deal Intake"},{id:"scoring",label:"PAIS Scoring"},{id:"fin",label:"Financial Model"},{id:"sens",label:"Sensitivity"},{id:"filters",label:"Hard Filters"},{id:"ai",label:"AI Research"},{id:"results",label:"Results & Memo"},{id:"pipeline",label:`Pipeline (${pipe.length})`}];

  if(trial.isExpired&&!trial.isPaid) return(
    <div style={{fontFamily:"Georgia,serif",background:"#f4f5f7",minHeight:"100vh"}}>
      <div style={{background:"#1B2A4A",borderBottom:"3px solid #C5993A",padding:"16px 24px"}}>
        <span style={{fontSize:22,fontWeight:700,color:"#C5993A"}}>PAIS</span>
        <span style={{fontSize:13,color:"#8ca0bf",marginLeft:10,letterSpacing:"0.1em"}}>PROPERTY ACQUISITION INTELLIGENCE SCORE</span>
      </div>
      <div style={{maxWidth:580,margin:"80px auto",padding:"0 24px",textAlign:"center"}}>
        <div style={{background:"#fff",borderRadius:16,border:"2px solid #C5993A",padding:"48px 40px",boxShadow:"0 8px 40px rgba(0,0,0,0.10)"}}>
          <div style={{fontSize:48,marginBottom:16}}>🔒</div>
          <h2 style={{fontSize:24,fontWeight:800,color:"#1B2A4A",marginBottom:8}}>Your Trial Has Ended</h2>
          <p style={{fontSize:15,color:"#666",lineHeight:1.7,marginBottom:8}}>Your 14-day free trial has expired. All your saved deals are locked and waiting — upgrade to regain full access instantly.</p>
          <p style={{fontSize:13,color:"#aaa",marginBottom:32}}>No deals are deleted. Everything is preserved.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:24}}>
            {PLANS.map(p=><PlanCard key={p.tier} p={p} onClick={()=>simUpgrade(p.tier)}/>)}
          </div>
          <p style={{fontSize:11,color:"#bbb"}}>Billed via Stripe · Cancel anytime · Annual plans save 20%</p>
          <p style={{fontSize:10,color:"#ddd",marginTop:4}}>[Demo: click a plan to simulate upgrade]</p>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{fontFamily:"Georgia,serif",background:"#f4f5f7",minHeight:"100vh"}}>

      {!trial.isPaid&&!trial.isExpired&&(
        <div style={{background:trial.remaining<=3?"#fff3e0":"#f0f4ff",borderBottom:`2px solid ${trial.remaining<=3?"#E67E22":"#4A90D9"}`,padding:"8px 24px",display:"flex",alignItems:"center",justifyContent:"center",gap:16}}>
          <span style={{fontSize:13,color:trial.remaining<=3?"#bf5000":"#1B2A4A",fontWeight:trial.remaining<=3?700:400}}>
            {trial.remaining<=3?"⚠ ":"ℹ "}{trial.remaining} day{trial.remaining!==1?"s":""} remaining in your free trial.{trial.remaining<=3?" Upgrade now to avoid losing access.":" Full access — no restrictions during trial."}
          </span>
          <button onClick={()=>setModal(true)} style={{padding:"5px 16px",background:trial.remaining<=3?"#E67E22":"#1B2A4A",color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}}>Upgrade →</button>
        </div>
      )}

      <div style={{background:"#1B2A4A",borderBottom:"3px solid #C5993A"}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{display:"flex",alignItems:"baseline",gap:10}}>
              <span style={{fontSize:22,fontWeight:700,color:"#C5993A",letterSpacing:"0.04em"}}>PAIS</span>
              <span style={{fontSize:13,color:"#8ca0bf",letterSpacing:"0.1em",textTransform:"uppercase"}}>Property Acquisition Intelligence Score</span>
            </div>
            <div style={{fontSize:11,color:"#5a7090",marginTop:2,letterSpacing:"0.06em"}}>PROFESSIONAL DEAL EVALUATION PLATFORM</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {flagged.length>0&&<div style={{padding:"6px 14px",background:"#ffebee",border:"1.5px solid #E53935",borderRadius:6,fontSize:12,color:"#E53935",fontWeight:700}}>⚑ {flagged.length} Flag{flagged.length>1?"s":""}</div>}
            <div style={{textAlign:"center",padding:"8px 20px",background:b.bg,border:`2px solid ${b.border}`,borderRadius:8}}>
              <div style={{fontSize:26,fontWeight:800,color:b.color,lineHeight:1}}>{comp.toFixed(0)}</div>
              <div style={{fontSize:10,color:b.color,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>{b.label}</div>
            </div>
            <button onClick={save} style={{padding:"8px 18px",background:"#C5993A",color:"#1B2A4A",border:"none",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Save to Pipeline</button>
            {trial.isPaid&&<div style={{padding:"5px 12px",background:"#27AE60",color:"#fff",borderRadius:6,fontSize:11,fontWeight:700,letterSpacing:"0.06em"}}>{trial.tier.toUpperCase()}</div>}
          </div>
        </div>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"0 24px",display:"flex",gap:2,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 18px",background:tab===t.id?"#C5993A":"transparent",color:tab===t.id?"#1B2A4A":"#8ca0bf",border:"none",cursor:"pointer",fontSize:13,fontWeight:tab===t.id?700:400,borderRadius:"4px 4px 0 0",whiteSpace:"nowrap"}}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1200,margin:"0 auto",padding:"28px 24px"}}>

        {tab==="aiintake"&&(
          <div>
            <h2 style={{fontSize:20,color:"#1B2A4A",marginBottom:6,fontWeight:700}}>AI Deal Intake</h2>
            <p style={{color:"#666",fontSize:14,marginBottom:24}}>Add sources — paste text, upload files — and Claude extracts every available deal field. Works with OMs, broker emails, listing pages, rent rolls, or raw numbers.</p>
            <AIIntakePanel onPopulate={populateFromAI}/>
          </div>
        )}

        {tab==="intake"&&(
          <div>
            <h2 style={{fontSize:20,color:"#1B2A4A",marginBottom:20,fontWeight:700}}>Deal Intake</h2>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:16,marginBottom:16}}>
              <F label="Street Address" value={intake.address} onChange={v=>setI(p=>({...p,address:v}))} placeholder="123 Main Street"/>
              <F label="City" value={intake.city} onChange={v=>setI(p=>({...p,city:v}))} placeholder="Nashville"/>
              <F label="State" value={intake.state} onChange={v=>setI(p=>({...p,state:v}))} placeholder="TN"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16,marginBottom:16}}>
              <Sel label="Asset Type" value={intake.assetType} onChange={v=>setI(p=>({...p,assetType:v}))} options={ASSET_TYPES}/>
              <Sel label="Deal Type" value={intake.dealType} onChange={v=>setI(p=>({...p,dealType:v}))} options={DEAL_TYPES}/>
              <F label="Units" value={intake.units} onChange={v=>setI(p=>({...p,units:v}))} placeholder="72" type="number"/>
              <F label="Acquisition Price ($)" value={intake.price} onChange={v=>setI(p=>({...p,price:v}))} placeholder="4500000" type="number"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16,marginBottom:16}}>
              <F label="Stabilized NOI ($)" value={intake.noi} onChange={v=>setI(p=>({...p,noi:v}))} placeholder="315000" type="number"/>
              <F label="Gross Rental Income ($)" value={intake.gri} onChange={v=>setI(p=>({...p,gri:v}))} placeholder="420000" type="number"/>
              <F label="Vacancy Rate (%)" value={intake.vacancy} onChange={v=>setI(p=>({...p,vacancy:v}))} placeholder="5" type="number"/>
              <F label="Replacement Cost ($)" value={intake.rc} onChange={v=>setI(p=>({...p,rc:v}))} placeholder="5500000" type="number"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
              <F label="Down Payment (%)" value={intake.down} onChange={v=>setI(p=>({...p,down:v}))} placeholder="25" type="number"/>
              <F label="Loan Rate (%)" value={intake.rate} onChange={v=>setI(p=>({...p,rate:v}))} placeholder="6.5" type="number"/>
              <F label="Amortization (years)" value={intake.yrs} onChange={v=>setI(p=>({...p,yrs:v}))} placeholder="30" type="number"/>
            </div>
            <div>
              <label style={{fontSize:12,color:"#666",fontWeight:600,display:"block",marginBottom:4}}>Deal Notes</label>
              <textarea value={intake.notes} onChange={e=>setI(p=>({...p,notes:e.target.value}))} rows={4} placeholder="Value-add thesis, key assumptions, sponsor background, deal source..." style={{width:"100%",padding:"10px 14px",border:"1.5px solid #ddd",borderRadius:8,fontSize:14,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
            </div>
            {intake.price&&(
              <div style={{marginTop:24,padding:20,background:"#fff",borderRadius:10,border:"1px solid #e8eaed"}}>
                <p style={{fontSize:12,color:"#888",marginBottom:14,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>Quick Metrics Preview</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:16}}>
                  {[{l:"Cap Rate",v:fmtP(fin.capRate)},{l:"Cash-on-Cash",v:fmtP(fin.coc)},{l:"DSCR",v:fmt(fin.dscr)+"x"},{l:"vs Replacement",v:fin.rcPct>0?fmt(fin.rcPct)+"%":"—"},{l:"Annual Cash Flow",v:fmtC(fin.cf)}].map(m=>(
                    <div key={m.l} style={{textAlign:"center"}}>
                      <div style={{fontSize:22,fontWeight:700,color:"#1B2A4A"}}>{m.v}</div>
                      <div style={{fontSize:11,color:"#888",marginTop:2}}>{m.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="scoring"&&(
          <div>
            <h2 style={{fontSize:20,color:"#1B2A4A",marginBottom:6,fontWeight:700}}>PAIS Scoring</h2>
            <p style={{color:"#666",fontSize:14,marginBottom:24}}>Score each category 0–100. Composite updates live in the header.</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              {CATS.map(c=>(
                <div key={c.id} style={{background:"#fff",borderRadius:10,padding:20,border:"1px solid #e8eaed"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div>
                      <div style={{fontWeight:700,color:"#1B2A4A",fontSize:15}}>{c.label}</div>
                      <div style={{fontSize:11,color:"#888"}}>Weight: {(c.weight*100).toFixed(0)}% · Contribution: {(scores[c.id]*c.weight).toFixed(1)} pts</div>
                    </div>
                    <div style={{fontSize:32,fontWeight:800,color:c.color}}>{scores[c.id]}</div>
                  </div>
                  <input type="range" min={0} max={100} value={scores[c.id]} onChange={e=>setSc(p=>({...p,[c.id]:+e.target.value}))} style={{width:"100%",accentColor:c.color,marginBottom:12}}/>
                  <div style={{borderTop:"1px solid #f0f0f0",paddingTop:10}}>
                    {GUIDES[c.id].map((g,i)=><p key={i} style={{fontSize:11,color:"#777",margin:"3px 0",lineHeight:1.4}}>{g}</p>)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginTop:20}}>
              <div style={{background:"#fff",borderRadius:10,padding:20,border:"1px solid #e8eaed"}}>
                <p style={{fontSize:13,fontWeight:700,color:"#1B2A4A",marginBottom:12}}>Score Radar</p>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={CATS.map(c=>({subject:c.label.split(" ").slice(0,2).join(" "),score:scores[c.id],fullMark:100}))}>
                    <PolarGrid stroke="#eee"/><PolarAngleAxis dataKey="subject" tick={{fontSize:11,fill:"#666"}}/>
                    <Radar dataKey="score" stroke="#C5993A" fill="#C5993A" fillOpacity={0.25} strokeWidth={2}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div style={{background:"#fff",borderRadius:10,padding:20,border:"1px solid #e8eaed"}}>
                <p style={{fontSize:13,fontWeight:700,color:"#1B2A4A",marginBottom:12}}>Weighted Contribution</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={CATS.map(c=>({name:c.label.split(" ")[0],val:scores[c.id]*c.weight,color:c.color}))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                    <XAxis type="number" domain={[0,30]} tick={{fontSize:11}}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={70}/>
                    <Tooltip formatter={v=>v.toFixed(1)+" pts"}/>
                    <Bar dataKey="val" radius={[0,4,4,0]}>{CATS.map((c,i)=><Cell key={i} fill={c.color}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{marginTop:20,background:"#fff",borderRadius:10,padding:20,border:"1px solid #e8eaed"}}>
              <p style={{fontSize:13,fontWeight:700,color:"#1B2A4A",marginBottom:12}}>Amendment v1 Flags</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                {[{k:"a1",l:"A1: Subsidized Demand",d:"Section 8/LIHTC — adjust affordability to payment standards"},{k:"a2",l:"A2: Transitional Vacancy",d:"Score on occupancy history, not spot vacancy rate"},{k:"a3",l:"A3: Catalytic Investment",d:"Funded public investment in trade area (+up to 15 pts Market)"}].map(a=>(
                  <div key={a.k} onClick={()=>setAm(p=>({...p,[a.k]:!p[a.k]}))} style={{padding:14,border:`2px solid ${amends[a.k]?"#C5993A":"#e8eaed"}`,borderRadius:8,cursor:"pointer",background:amends[a.k]?"#fff8e1":"#fafafa"}}>
                    <div style={{fontWeight:700,fontSize:13,color:amends[a.k]?"#C5993A":"#1B2A4A",marginBottom:4}}>{amends[a.k]?"✓ ":""}{a.l}</div>
                    <div style={{fontSize:11,color:"#777",lineHeight:1.4}}>{a.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab==="fin"&&(
          <div>
            <h2 style={{fontSize:20,color:"#1B2A4A",marginBottom:20,fontWeight:700}}>Financial Model</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
              <div style={{background:"#fff",borderRadius:10,padding:20,border:"1px solid #e8eaed"}}>
                <p style={{fontSize:13,fontWeight:700,color:"#1B2A4A",marginBottom:16,textTransform:"uppercase",letterSpacing:"0.06em"}}>Key Metrics</p>
                {[{l:"Capitalization Rate",v:fmtP(fin.capRate),flag:fin.capRate<5},{l:"Cash-on-Cash Return",v:fmtP(fin.coc),flag:fin.coc<5},{l:"DSCR",v:fmt(fin.dscr)+"x",flag:fin.dscr<1.2},{l:"Gross Rent Multiplier",v:fmt(fin.grm)+"x"},{l:"Annual Cash Flow",v:fmtC(fin.cf),flag:fin.cf<0},{l:"Monthly Debt Service",v:fmtC(fin.mp)},{l:"Equity Required",v:fmtC(fin.eq)},{l:"Loan Amount",v:fmtC(fin.loan)}].map(m=>(
                  <div key={m.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f4f4f4"}}>
                    <span style={{fontSize:13,color:"#555"}}>{m.l}</span>
                    <span style={{fontSize:16,fontWeight:700,color:m.flag?"#E53935":"#1B2A4A"}}>{m.v}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{background:"#fff",borderRadius:10,padding:20,border:"1px solid #e8eaed",marginBottom:16}}>
                  <p style={{fontSize:13,fontWeight:700,color:"#1B2A4A",marginBottom:16,textTransform:"uppercase",letterSpacing:"0.06em"}}>Replacement Cost Test</p>
                  {fin.rcPct>0?(
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:"#555"}}>Acquisition Price</span><span style={{fontWeight:700}}>{fmtC(+intake.price)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><span style={{fontSize:13,color:"#555"}}>Replacement Cost</span><span style={{fontWeight:700}}>{fmtC(+intake.rc)}</span></div>
                      <div style={{background:"#f4f5f7",borderRadius:8,padding:16,textAlign:"center"}}>
                        <div style={{fontSize:36,fontWeight:800,color:fin.rcPct<=70?"#27AE60":fin.rcPct<=85?"#C5993A":"#E53935"}}>{fmt(fin.rcPct)}%</div>
                        <div style={{fontSize:12,color:"#888",marginTop:4}}>of Replacement Cost</div>
                        <div style={{fontSize:12,marginTop:8,fontWeight:600,color:fin.rcPct<=70?"#27AE60":fin.rcPct<=85?"#C5993A":"#E53935"}}>{fin.rcPct<=70?"✓ Strong margin of safety":fin.rcPct<=85?"⚠ Approaching 85% threshold":"⚑ Hard filter triggered — exceeds 85%"}</div>
                      </div>
                    </div>
                  ):<p style={{color:"#aaa",fontSize:13}}>Enter price and replacement cost in Deal Intake.</p>}
                </div>
                <div style={{background:"#fff",borderRadius:10,padding:20,border:"1px solid #e8eaed"}}>
                  <p style={{fontSize:13,fontWeight:700,color:"#1B2A4A",marginBottom:16,textTransform:"uppercase",letterSpacing:"0.06em"}}>Per-Unit Metrics</p>
                  {[{l:"Price per Unit",v:fmtC(fin.ppu)},{l:"NOI per Unit",v:fmtC(fin.noiPpu)},{l:"Cash Flow per Unit",v:fmtC(fin.cf/(+intake.units||1))}].map(m=>(
                    <div key={m.l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f4f4f4"}}><span style={{fontSize:13,color:"#555"}}>{m.l}</span><span style={{fontSize:16,fontWeight:700,color:"#1B2A4A"}}>{m.v}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab==="sens"&&(
          <div>
            <h2 style={{fontSize:20,color:"#1B2A4A",marginBottom:8,fontWeight:700}}>Sensitivity Analysis</h2>
            <p style={{color:"#666",fontSize:14,marginBottom:24}}>Two-variable heat map: interest rate vs. vacancy. Base case in yellow.</p>
            {intake.price?<div style={{background:"#fff",borderRadius:10,padding:24,border:"1px solid #e8eaed",marginBottom:24}}><SensTable f={intake}/></div>:<div style={{padding:40,textAlign:"center",color:"#aaa",background:"#fff",borderRadius:10}}>Enter acquisition price in Deal Intake first.</div>}
            <div style={{background:"#fff",borderRadius:10,padding:24,border:"1px solid #e8eaed"}}>
              <p style={{fontSize:13,fontWeight:700,color:"#1B2A4A",marginBottom:16,textTransform:"uppercase",letterSpacing:"0.06em"}}>Scenario Comparison</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                {[{l:"Bear Case",v:+intake.vacancy+10,r:+intake.rate+1,c:"#E53935"},{l:"Base Case",v:+intake.vacancy,r:+intake.rate,c:"#C5993A"},{l:"Bull Case",v:Math.max(0,+intake.vacancy-3),r:+intake.rate-0.5,c:"#27AE60"}].map(s=>{
                  const sf=calcFin({...intake,vacancy:s.v,rate:s.r});
                  return(<div key={s.l} style={{padding:20,border:`2px solid ${s.c}`,borderRadius:10,background:"#fafafa"}}>
                    <div style={{fontSize:15,fontWeight:700,color:s.c,marginBottom:8}}>{s.l}</div>
                    <div style={{fontSize:11,color:"#888",marginBottom:12}}>Vacancy: {s.v.toFixed(0)}% · Rate: {s.r.toFixed(1)}%</div>
                    {[{l:"CoC Return",v:fmtP(sf.coc)},{l:"Cash Flow",v:fmtC(sf.cf)},{l:"DSCR",v:fmt(sf.dscr)+"x"}].map(m=>(
                      <div key={m.l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #eee"}}><span style={{fontSize:12,color:"#666"}}>{m.l}</span><span style={{fontSize:14,fontWeight:700,color:s.c}}>{m.v}</span></div>
                    ))}
                  </div>);
                })}
              </div>
            </div>
          </div>
        )}

        {tab==="filters"&&(
          <div>
            <h2 style={{fontSize:20,color:"#1B2A4A",marginBottom:8,fontWeight:700}}>Hard Filters</h2>
            <p style={{color:"#666",fontSize:14,marginBottom:24}}>Binary go/no-go checks. A flagged filter must be acknowledged before advancing to IC.</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {HARD_FILTERS.map(f=>(
                <div key={f.id} style={{background:"#fff",borderRadius:10,padding:18,border:`1.5px solid ${filters[f.id]==="flagged"?"#E53935":filters[f.id]==="monitor"?"#E67E22":"#e8eaed"}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:16}}>
                    <div style={{fontSize:20}}>{filters[f.id]==="flagged"?"🔴":filters[f.id]==="monitor"?"🟡":"🟢"}</div>
                    <div style={{flex:1,fontSize:14,color:"#1B2A4A",fontWeight:500}}>{f.label}</div>
                    <div style={{display:"flex",gap:6}}>
                      {["clear","monitor","flagged"].map(s=>(
                        <button key={s} onClick={()=>setFl(p=>({...p,[f.id]:s}))} style={{padding:"5px 12px",border:"1.5px solid",borderColor:filters[f.id]===s?(s==="flagged"?"#E53935":s==="monitor"?"#E67E22":"#27AE60"):"#ddd",borderRadius:4,fontSize:11,cursor:"pointer",fontWeight:filters[f.id]===s?700:400,background:filters[f.id]===s?(s==="flagged"?"#ffebee":s==="monitor"?"#fff3e0":"#e8f5e9"):"#fff",color:filters[f.id]===s?(s==="flagged"?"#E53935":s==="monitor"?"#E67E22":"#27AE60"):"#888",textTransform:"capitalize"}}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {flagged.length>0&&<div style={{marginTop:20,padding:16,background:"#ffebee",borderRadius:8,border:"1.5px solid #E53935"}}><p style={{fontWeight:700,color:"#E53935",marginBottom:6}}>⚑ {flagged.length} filter{flagged.length>1?"s":""} flagged — must be addressed before IC submission</p>{flagged.map(f=><p key={f.id} style={{fontSize:13,color:"#c62828",margin:"2px 0"}}>· {f.label}</p>)}</div>}
          </div>
        )}

        {tab==="ai"&&(
          <div>
            <h2 style={{fontSize:20,color:"#1B2A4A",marginBottom:8,fontWeight:700}}>AI Research</h2>
            <p style={{color:"#666",fontSize:14,marginBottom:24}}>Ask anything — comps, market data, financing rates, risk analysis. Deal context is passed automatically.</p>
            <div style={{background:"#fff",borderRadius:10,padding:24,border:"1px solid #e8eaed"}}><AIPanel deal={deal}/></div>
          </div>
        )}

        {tab==="results"&&(
          <div>
            <h2 style={{fontSize:20,color:"#1B2A4A",marginBottom:20,fontWeight:700}}>Results & Deal Memo</h2>
            <div style={{marginBottom:20,padding:16,background:"#fff",borderRadius:10,border:"1px solid #e8eaed",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <span style={{fontSize:14,fontWeight:700,color:"#1B2A4A"}}>Export Options</span>
                <span style={{fontSize:12,color:"#888",marginLeft:12}}>{trial.isPaid?"Download your IC memo as a formatted document.":"Export available on paid plans — upgrade to unlock."}</span>
              </div>
              {trial.isPaid?(
                <button onClick={()=>{
                  const txt=`PAIS INVESTMENT COMMITTEE MEMORANDUM\n${"=".repeat(50)}\n\nProperty: ${intake.address||"TBD"}, ${intake.city||""} ${intake.state||""}\nAsset: ${intake.assetType} | Deal Type: ${intake.dealType} | Units: ${intake.units||"N/A"}\nDate: ${new Date().toLocaleDateString()}\n\n${"─".repeat(50)}\nKEY METRICS\n${"─".repeat(50)}\nAcquisition Price: ${fmtC(+intake.price)}\nCap Rate: ${fmtP(fin.capRate)}\nCash-on-Cash: ${fmtP(fin.coc)}\nDSCR: ${fmt(fin.dscr)}x\nAnnual Cash Flow: ${fmtC(fin.cf)}\nvs Replacement Cost: ${fin.rcPct>0?fmt(fin.rcPct)+"%":"N/A"}\n\n${"─".repeat(50)}\nPAIS COMPOSITE SCORE: ${comp.toFixed(0)} — ${b.label}\n${"─".repeat(50)}\n${CATS.map(c=>`${c.label.padEnd(35)} ${String(scores[c.id]).padStart(3)}/100  (${(c.weight*100).toFixed(0)}% wt = ${(scores[c.id]*c.weight).toFixed(1)} pts)`).join("\n")}\n\n${"─".repeat(50)}\nHARD FILTERS\n${"─".repeat(50)}\n${HARD_FILTERS.map(f=>`${filters[f.id]==="flagged"?"⚑ FLAGGED   ":"○ "+filters[f.id].toUpperCase().padEnd(8)} ${f.label}`).join("\n")}\n\n${"─".repeat(50)}\nDECISION: ${b.label}\n${"─".repeat(50)}\n${flagged.length>0?`FLAGS REQUIRING RESOLUTION:\n${flagged.map(f=>"· "+f.label).join("\n")}`:""}\n${intake.notes?`\nNOTES: ${intake.notes}`:""}\n\n${"─".repeat(50)}\nGenerated by PAIS Deal Evaluation Platform\nAll documents are drafts requiring professional review.\n`;
                  const blob=new Blob([txt],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`PAIS_Memo_${(intake.address||"Deal").replace(/\s+/g,"_")}.txt`;a.click();URL.revokeObjectURL(url);
                }} style={{padding:"8px 18px",background:"#1B2A4A",color:"#C5993A",border:"none",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer"}}>↓ Download Memo</button>
              ):(
                <button onClick={()=>setModal(true)} style={{padding:"8px 18px",background:"#f0f0f0",color:"#999",border:"1.5px solid #ddd",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer"}}>🔒 Download Memo — Upgrade to unlock</button>
              )}
            </div>
            <div style={{background:"#fff",borderRadius:10,padding:28,border:`2px solid ${b.border}`,marginBottom:24}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:13,color:"#888",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>PAIS Composite Score</div>
                  <div style={{fontSize:72,fontWeight:900,color:b.color,lineHeight:1}}>{comp.toFixed(0)}</div>
                  <div style={{fontSize:22,fontWeight:700,color:b.color,marginTop:4}}>{b.label}</div>
                  {intake.address&&<div style={{fontSize:14,color:"#666",marginTop:8}}>{intake.address}{intake.city?`, ${intake.city}`:""}{intake.state?`, ${intake.state}`:""}</div>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                  {CATS.map(c=>(<div key={c.id} style={{textAlign:"center",padding:"10px 14px",background:"#fafafa",borderRadius:8,border:"1px solid #eee"}}><div style={{fontSize:22,fontWeight:800,color:c.color}}>{scores[c.id]}</div><div style={{fontSize:10,color:"#777",marginTop:2,lineHeight:1.3}}>{c.label}</div><div style={{fontSize:10,color:"#aaa"}}>{(c.weight*100).toFixed(0)}% wt</div></div>))}
                </div>
              </div>
            </div>
            <div style={{background:"#fff",borderRadius:10,padding:28,border:"1px solid #e8eaed"}}>
              <div style={{borderBottom:"2px solid #C5993A",paddingBottom:16,marginBottom:20}}>
                <div style={{fontSize:11,color:"#888",letterSpacing:"0.1em",textTransform:"uppercase"}}>Investment Committee Memorandum</div>
                <div style={{fontSize:20,fontWeight:700,color:"#1B2A4A",marginTop:4}}>{intake.address||"Subject Property"}{intake.city?` — ${intake.city}`:""}{intake.state?`, ${intake.state}`:""}</div>
                <div style={{fontSize:13,color:"#666",marginTop:4}}>{intake.assetType} · {intake.dealType}{intake.units?` · ${intake.units} units`:""} · Prepared {new Date().toLocaleDateString()}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16,marginBottom:24,padding:16,background:"#f8f9fa",borderRadius:8}}>
                {[{l:"Acquisition Price",v:fmtC(+intake.price)},{l:"Cap Rate",v:fmtP(fin.capRate)},{l:"DSCR",v:fmt(fin.dscr)+"x"},{l:"PAIS Score",v:comp.toFixed(0)+" — "+b.label}].map(m=>(<div key={m.l}><div style={{fontSize:11,color:"#888",marginBottom:2}}>{m.l}</div><div style={{fontSize:15,fontWeight:700,color:"#1B2A4A"}}>{m.v}</div></div>))}
              </div>
              <div style={{fontSize:14,lineHeight:1.8,color:"#333"}}>
                <p><strong>Decision:</strong> <span style={{color:b.color,fontWeight:700}}>{b.label}</span> — Composite PAIS score of {comp.toFixed(0)}/100.</p>
                {flagged.length>0&&<p><strong>Hard Filter Flags ({flagged.length}):</strong> {flagged.map(f=>f.label).join("; ")}. These must be addressed before commitment.</p>}
                <p><strong>Financial Summary:</strong> Acquisition price of {fmtC(+intake.price)} implies a cap rate of {fmtP(fin.capRate)}, cash-on-cash return of {fmtP(fin.coc)}, and DSCR of {fmt(fin.dscr)}x. Annual cash flow of {fmtC(fin.cf)}.{fin.rcPct>0?` Acquisition represents ${fmt(fin.rcPct)}% of estimated replacement cost.`:""}</p>
                <p><strong>Category Scores:</strong> {CATS.map(c=>`${c.label.split(" ").slice(0,2).join(" ")}: ${scores[c.id]}`).join(" · ")}.</p>
                {amends.a1&&<p><strong>Amendment A1 — Subsidized Demand:</strong> Active. Affordability adjusted to Section 8 payment standards.</p>}
                {amends.a2&&<p><strong>Amendment A2 — Transitional Vacancy:</strong> Active. Vacancy scored on occupancy history, not spot rate.</p>}
                {amends.a3&&<p><strong>Amendment A3 — Catalytic Investment:</strong> Active. Funded public investment within trade area identified.</p>}
                {intake.notes&&<p><strong>Notes:</strong> {intake.notes}</p>}
              </div>
            </div>
          </div>
        )}

        {tab==="pipeline"&&(
          <div>
            <h2 style={{fontSize:20,color:"#1B2A4A",marginBottom:20,fontWeight:700}}>Deal Pipeline</h2>
            {pipe.length===0?(
              <div style={{padding:60,textAlign:"center",background:"#fff",borderRadius:10,color:"#aaa"}}>
                <div style={{fontSize:40,marginBottom:12}}>📋</div>
                <p>No deals saved yet. Score a deal and click "+ Save to Pipeline."</p>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {pipe.map(d=>{const db=getBand(d.comp);return(
                  <div key={d.id} style={{background:"#fff",borderRadius:10,padding:20,border:`1.5px solid ${db.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,color:"#1B2A4A",fontSize:16}}>{d.address}</div>
                      <div style={{fontSize:13,color:"#666",marginTop:2}}>{d.city}{d.state?`, ${d.state}`:""} · {d.assetType} · Saved {d.saved}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:20}}>
                      {d.price&&<div style={{textAlign:"right"}}><div style={{fontSize:12,color:"#888"}}>Price</div><div style={{fontWeight:700,color:"#1B2A4A"}}>${(+d.price).toLocaleString()}</div></div>}
                      {d.capRate>0&&<div style={{textAlign:"right"}}><div style={{fontSize:12,color:"#888"}}>Cap Rate</div><div style={{fontWeight:700,color:"#1B2A4A"}}>{d.capRate.toFixed(2)}%</div></div>}
                      <div style={{textAlign:"center",padding:"10px 20px",background:db.bg,border:`2px solid ${db.border}`,borderRadius:8}}>
                        <div style={{fontSize:24,fontWeight:800,color:db.color}}>{d.comp.toFixed(0)}</div>
                        <div style={{fontSize:10,color:db.color,fontWeight:700,textTransform:"uppercase"}}>{d.band}</div>
                      </div>
                    </div>
                  </div>
                );})}
              </div>
            )}
          </div>
        )}
      </div>

      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{maxWidth:560,width:"90%",background:"#fff",borderRadius:16,border:"2px solid #C5993A",padding:"40px 36px",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
              <div>
                <h2 style={{fontSize:22,fontWeight:800,color:"#1B2A4A",margin:0}}>Choose Your Plan</h2>
                <p style={{fontSize:13,color:"#888",marginTop:4}}>{trial.remaining} day{trial.remaining!==1?"s":""} remaining in trial · Annual plans save 20%</p>
              </div>
              <button onClick={()=>setModal(false)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#aaa"}}>×</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
              {PLANS.map(p=><PlanCard key={p.tier} p={p} onClick={()=>simUpgrade(p.tier)}/>)}
            </div>
            <p style={{fontSize:11,color:"#bbb",textAlign:"center"}}>Billed via Stripe · Cancel anytime · All deals preserved</p>
            <p style={{fontSize:10,color:"#ddd",textAlign:"center",marginTop:4}}>[Demo: click a plan to simulate upgrade]</p>
          </div>
        </div>
      )}
    </div>
  );
}
