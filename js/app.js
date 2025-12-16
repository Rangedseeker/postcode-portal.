
/* ========= DATA FILE MAP ========= */
const DATA_FILES = {
  UK:  { file: 'postcodes_uk.json'  },
  BEL: { file: 'postcodes_bel.json' },
  NL:  { file: 'postcodes_nl.json'  },
  LUX: { file: 'postcodes_lux.json' }
};

/* ========= UTILITIES ========= */
const normRow = (r) => {
  const postcode = (r.postcode ?? r.Postcode ?? '').toString().trim();
  const region   = (r.region   ?? r.Region   ?? r['Town/Area'] ?? r.Town ?? '').toString().trim();
  return { postcode, region };
};

function outwardUK(pc){
  const s = (pc ?? '').toString().trim().toUpperCase();
  const [outward] = s.split(/\s+/);
  return outward || s;
}

function summaryHTML(row){
  if(!row) return '';
  return `
    <table>
      <tr><td class="muted small">Postcode</td><td><strong>${row.postcode}</strong></td></tr>
      <tr><td class="muted small">Town / Area</td><td>${row.region || '—'}</td></tr>
    </table>`;
}

function resolveCountryCode(raw) {
  const v = (raw ?? '').toString().trim().toUpperCase();
  if (!v) return null;
  if (DATA_FILES[v]) return v;
  const map = {
    'UK':'UK','GB':'UK','GBR':'UK','UNITED KINGDOM':'UK','GREAT BRITAIN':'UK',
    'ENGLAND':'UK','SCOTLAND':'UK','WALES':'UK','NORTHERN IRELAND':'UK',
    'BEL':'BEL','BELGIUM':'BEL','BE':'BEL',
    'NL':'NL','NLD':'NL','NETHERLANDS':'NL','HOLLAND':'NL',
    'LUX':'LUX','LUXEMBOURG':'LUX','LU':'LUX',
  };
  return map[v] ?? null;
}

function normalizePostcode(input, country){
  let s = (input ?? '').toString().trim().replace(/\s+/g, '');
  if (!s) return '';
  return s.toUpperCase(); // outward-only for UK; others uppercase
}

/* ========= TYPEAHEAD WIDGET ========= */
function makeTypeahead(inputEl, {
  source,            // async (query) => [{label, value, payload}]
  onSelect,          // (item) => void
  minChars = 1,
  linkToCountry = null // optional function to get current country code
}){
  const wrap = document.createElement('div');
  wrap.className = 'ta-wrap';
  inputEl.parentElement.appendChild(wrap);
  wrap.appendChild(inputEl);

  const list = document.createElement('ul');
  list.className = 'ta-list';
  inputEl.parentElement.appendChild(list);

  let items = [];
  let activeIndex = -1;

  function render(){
    list.innerHTML = '';
    items.forEach((it, idx)=>{
      const li = document.createElement('li');
      li.className = 'ta-item' + (idx === activeIndex ? ' active' : '');
      li.textContent = it.label;
      li.addEventListener('mousedown', (e)=>{ e.preventDefault(); select(idx); });
      list.appendChild(li);
    });
    list.style.display = items.length ? 'block' : 'none';
  }

  async function update(){
    const q = inputEl.value || '';
    const cc = linkToCountry ? linkToCountry() : null;
    if (q.trim().length < minChars) { items = []; render(); return; }
    try{
      items = await source(q, cc);
    }catch(e){
      console.error('typeahead source error', e);
      items = [];
    }
    activeIndex = items.length ? 0 : -1;
    render();
  }

  function select(idx){
    if (idx < 0 || idx >= items.length) return;
    const it = items[idx];
    inputEl.value = it.value;
    items = []; render();
    onSelect?.(it);
  }

  inputEl.addEventListener('input', update);
  inputEl.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex+1, items.length-1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex-1, 0); render(); }
    else if (e.key === 'Enter') { if (activeIndex >= 0) { e.preventDefault(); select(activeIndex); } }
    else if (e.key === 'Escape') { items = []; render(); }
  });

  // Hide list when clicking elsewhere
  document.addEventListener('click', (e)=>{
    if (!list.contains(e.target) && e.target !== inputEl) {
      items = []; render();
    }
  });

  return { update, clear: ()=>{ items=[]; render(); } };
}

/* ========= DATA LAYER FOR POSTCODES ========= */
async function loadDatasetFor(code){
  const cc = resolveCountryCode(code);
  if(!cc) return { cc:null, rows:[] };
  const meta = DATA_FILES[cc];
  const res = await fetch(meta.file, { cache:'no-store' });
  if(!res.ok) throw new Error(`${meta.file} ${res.status}`);
  const raw = await res.json();
  const arr = Array.isArray(raw) ? raw : (raw.data || raw.rows || []);
  let rows = arr.map(normRow).filter(r => r.postcode);
  if (cc === 'UK') rows = rows.map(r => ({ ...r, outward: outwardUK(r.postcode) }));
  return { cc, rows };
}

/* ========= SECTION WIRING WITH TYPEAHEAD ========= */
function wireSection({ countryId, postcodeId, townId }){
  const elCountry  = document.getElementById(countryId);
  const elPostcode = document.getElementById(postcodeId);
  const elTown     = document.getElementById(townId);

  if (!elCountry || !elPostcode || !elTown) {
    console.warn('Missing elements for', {countryId, postcodeId, townId});
    return;
  }

  let state = {
    cc: null,
    rows: [],
  };

  // Country typeahead (static suggestions)
  const countrySuggestions = [
    { label:'United Kingdom', value:'United Kingdom' },
    { label:'UK', value:'UK' },
    { label:'GB', value:'GB' },
    { label:'Belgium', value:'Belgium' },
    { label:'BEL', value:'BEL' },
    { label:'BE', value:'BE' },
    { label:'Netherlands', value:'Netherlands' },
    { label:'NL', value:'NL' },
    { label:'Luxembourg', value:'Luxembourg' },
    { label:'LUX', value:'LUX' },
    { label:'LU', value:'LU' },
  ];

  const countryTA = makeTypeahead(elCountry, {
    source: async (q) => {
      const qq = q.trim().toLowerCase();
      return countrySuggestions
        .filter(x => x.label.toLowerCase().includes(qq) || x.value.toLowerCase().includes(qq))
        .map(x => ({ ...x, payload:null }))
        .slice(0, 8);
    },
    onSelect: async (item) => {
      elTown.innerHTML = '';
      elPostcode.value = '';
      elPostcode.disabled = true;
      try{
        const { cc, rows } = await loadDatasetFor(item.value);
        state.cc = cc;
        state.rows = rows;
        elPostcode.disabled = !cc;
      }catch(err){
        console.error('Country dataset load failed', err);
        state.cc = null; state.rows = [];
        elPostcode.disabled = false; // allow typing even if dataset fails
      }
    },
    minChars: 1,
  });

  // Postcode typeahead (depends on selected country)
  const postcodeTA = makeTypeahead(elPostcode, {
    linkToCountry: () => state.cc,
    source: async (q, cc) => {
      const normalized = normalizePostcode(q, cc);
      const qq = normalized.toLowerCase();
      if (!cc || !qq) return [];

      if (cc === 'UK') {
        // Outward-only: prefix match outward
        return state.rows
          .filter(r => r.outward && r.outward.toLowerCase().startsWith(qq))
          .slice(0, 10)
          .map(r => ({
            label: `${r.outward} — ${r.region || '—'}`,
            value: r.outward,
            payload: r
          }));
      }
      // Other countries: includes on full postcode
      return state.rows
        .filter(r => r.postcode && r.postcode.toLowerCase().includes(qq))
        .slice(0, 10)
        .map(r => ({
          label: `${r.postcode} — ${r.region || '—'}`,
          value: r.postcode,
          payload: r
        }));
    },
    onSelect: (item) => {
      const r = item.payload;
      elTown.innerHTML = summaryHTML(r);
    },
    minChars: 1,
  });

  // If a country value is prefilled (e.g., from server), load immediately
  if (elCountry.value) {
    countryTA.source(elCountry.value).then(async (list)=>{
      // Resolve and load even if it wasn't selected via list
      try{
        const { cc, rows } = await loadDatasetFor(elCountry.value);
        state.cc = cc; state.rows = rows;
        elPostcode.disabled = !cc;
      }catch(err){
        console.error('Initial country dataset load failed', err);
        elPostcode.disabled = false;
      }
    });
  }
}

/* ========= NUMBERS SUM (unchanged behavior, comma-safe) ========= */
function toNum(v){
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/\s+/g, '').replace(/,/g, '');
  const x = Number(s);
  return Number.isFinite(x) ? x : 0;
}

function updateSum(){
  const inputs = document.querySelectorAll('input[data-sum]');
  const sum = Array.from(inputs).reduce((acc, el)=> acc + toNum(el.value), 0);
  const out = document.getElementById('sumTotal');
  if (out) out.textContent = sum.toLocaleString(undefined, { maximumFractionDigits: 20 });
}

/* ========= BOOTSTRAP ========= */
document.addEventListener('DOMContentLoaded', () => {
  wireSection({ countryId:'Col_Country', postcodeId:'Col_Postcode', townId:'Col_Town' });
  wireSection({ countryId:'Del_Country', postcodeId:'Del_Postcode', townId:'Del_Town' });

  updateSum();
  document.addEventListener('input', (e)=>{
    if (e.target && e.target.matches('input[data-sum]')) updateSum();
  });
  document.addEventListener('change', (e)=>{
    if (e.target && e.target.matches('input[data-sum]')) updateSum();
  });
});
