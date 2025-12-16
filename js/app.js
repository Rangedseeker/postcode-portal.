
/* ========= DATA FILE MAP ========= */
const DATA_FILES = {
  UK:  { file: 'postcodes_uk.json' },
  BEL: { file: 'postcodes_bel.json' },
  NL:  { file: 'postcodes_nl.json' },
  LUX: { file: 'postcodes_lux.json' }
};

/* ========= UTILITIES ========= */
const normRow = (r) => ({
  postcode: (r.postcode ?? r.Postcode ?? '').toString().trim(),
  region: (r.region ?? r.Region ?? r["Town/Area"] ?? r.Town ?? '').toString().trim()
});

function outwardUK(pc){
  const s = (pc ?? "").toString().trim().toUpperCase();
  return s.split(" ")[0] || s;
}

function summaryHTML(row){
  if(!row) return "";
  return `
<table>
<tr><td>Postcode</td><td>${row.postcode}</td></tr>
<tr><td>Town / Area</td><td>${row.region || "—"}</td></tr>
</table>`;
}

function resolveCountryCode(v){
  v = (v ?? "").trim().toUpperCase();
  const map = {
    "UK":"UK","GB":"UK","GBR":"UK","UNITED KINGDOM":"UK","GREAT BRITAIN":"UK",
    "ENGLAND":"UK","WALES":"UK","SCOTLAND":"UK","NORTHERN IRELAND":"UK",
    "BEL":"BEL","BELGIUM":"BEL","BE":"BEL",
    "NL":"NL","NETHERLANDS":"NL","HOLLAND":"NL",
    "LUX":"LUX","LUXEMBOURG":"LUX","LU":"LUX"
  };
  return DATA_FILES[v] ? v : map[v] ?? null;
}

function normalizePostcode(v){
  return (v ?? "").toString().replace(/\s+/g,"").toUpperCase();
}

/* ========= TYPEAHEAD ========= */
function makeTypeahead(inputEl, { source, onSelect, minChars=1, linkToCountry=null }){

  const wrap = document.createElement("div");
  wrap.className = "ta-wrap";
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);

  const list = document.createElement("ul");
  list.className = "ta-list";
  wrap.appendChild(list);

  let items = [];
  let active = -1;

  function render(){
    list.innerHTML = "";
    items.forEach((it,i)=>{
      const li = document.createElement("li");
      li.className = "ta-item" + (i === active ? " active" : "");
      li.textContent = it.label;
      li.addEventListener("mousedown", e => {
        e.preventDefault();
        select(i);
      });
      list.appendChild(li);
    });
    list.style.display = items.length ? "block" : "none";
  }

  async function update(){
    const q = inputEl.value.trim();
    if(q.length < minChars){ items=[]; render(); return; }
    const cc = linkToCountry ? linkToCountry() : null;
    items = await source(q, cc);
    active = items.length ? 0 : -1;
    render();
  }

  function select(i){
    if(i<0 || i>=items.length) return;
    const it = items[i];
    inputEl.value = it.value;
    items=[];
    render();
    onSelect?.(it);
  }

  inputEl.addEventListener("input", update);
  inputEl.addEventListener("keydown", e=>{
    if(e.key==="ArrowDown"){ active=Math.min(active+1, items.length-1); e.preventDefault(); }
    if(e.key==="ArrowUp"){ active=Math.max(active-1, 0); e.preventDefault(); }
    if(e.key==="Enter" && active>=0){ e.preventDefault(); select(active); }
    if(e.key==="Escape"){ items=[]; render(); }
    render();
  });

  document.addEventListener("click", e=>{
    if(!wrap.contains(e.target)){ items=[]; render(); }
  });
}

/* ========= DATA LOADING ========= */
async function loadDatasetFor(country){
  const cc = resolveCountryCode(country);
  if(!cc) return { cc:null, rows:[] };

  const res = await fetch(DATA_FILES[cc].file, { cache:"no-store" });
  const raw = await res.json();
  let rows = (Array.isArray(raw) ? raw : raw.data ?? raw.rows ?? []).map(normRow);

  if(cc === "UK") rows = rows.map(r => ({...r, outward: outwardUK(r.postcode)}));

  return { cc, rows };
}

/* ========= WIRE SECTIONS ========= */
function wireSection({ countryId, postcodeId, townId }){

  const elCountry = document.getElementById(countryId);
  const elPost    = document.getElementById(postcodeId);
  const elTown    = document.getElementById(townId);

  let state = { cc:null, rows:[] };

  /* Country typeahead */
  const COUNTRY_LIST = [
    "UK","United Kingdom","GB",
    "Belgium","BEL","BE",
    "Netherlands","NL",
    "Luxembourg","LUX","LU"
  ].map(x=>({ label:x, value:x }));

  makeTypeahead(elCountry, {
    source: (q)=> COUNTRY_LIST.filter(x => x.label.toLowerCase().includes(q.toLowerCase())),
    onSelect: async (item)=>{
      elPost.value = "";
      elTown.innerHTML = "";
      elPost.disabled = true;

      const { cc, rows } = await loadDatasetFor(item.value);
      state = { cc, rows };
      elPost.disabled = !cc;
    }
  });

  /* Postcode typeahead */
  makeTypeahead(elPost, {
    linkToCountry: ()=> state.cc,
    source: (q,cc)=>{
      q = normalizePostcode(q);
      if(!cc) return [];

      if(cc === "UK"){
        return state.rows
          .filter(r=>r.outward.toLowerCase().startsWith(q.toLowerCase()))
          .slice(0,10)
          .map(r=>({ label:`${r.outward} — ${r.region}`, value:r.outward, payload:r }));
      }

      return state.rows
        .filter(r=>r.postcode.toLowerCase().includes(q.toLowerCase()))
        .slice(0,10)
        .map(r=>({ label:`${r.postcode} — ${r.region}`, value:r.postcode, payload:r }));
    },
    onSelect: (item)=>{
      elTown.innerHTML = summaryHTML(item.payload);
    }
  });
}

/* ========= SUM NUMBERS ========= */
function updateSum(){
  const inputs = [...document.querySelectorAll("input[data-sum]")];
  const total = inputs.reduce((n,el)=>{
    return n + Number(String(el.value).replace(/,/g,"")) || 0;
  },0);

  document.getElementById("sumTotal").textContent = total.toLocaleString();
}

/* ========= INIT ========= */
document.addEventListener("DOMContentLoaded", ()=>{

  wireSection({
    countryId:"Col_Country",
    postcodeId:"Col_Postcode",
    townId:"Col_Town"
  });

  wireSection({
    countryId:"Del_Country",
    postcodeId:"Del_Postcode",
    townId:"Del_Town"
  });

  updateSum();
  document.addEventListener("input", e=>{
    if(e.target.matches("input[data-sum]")) updateSum();
  });
});
``

