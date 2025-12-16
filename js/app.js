
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

const score = (row, q) => {
  const p = row.postcode.toLowerCase();
  if (p === q) return 0;
  if (p.startsWith(q)) return 1;
  if (p.includes(q)) return 2;
  return 9;
};

function summaryHTML(row){
  // Show nothing if no row (per your requirement)
  if(!row) return '';
  return `
    <table>
      <tr><td class="muted small">Postcode</td><td><strong>${row.postcode}</strong></td></tr>
      <tr><td class="muted small">Town / Area</td><td>${row.region || '—'}</td></tr>
    </table>`;
}

/* ========= SECTION WIRING ========= */
function wireSection({ countryId, postcodeId, townId }){
  const elCountry  = document.getElementById(countryId);
  const elPostcode = document.getElementById(postcodeId);
  const elTown     = document.getElementById(townId);

  let selectedCountry = null;
  let dataRows = [];
  let hits = [];
  let committedPostcode = null;

  function resetSectionUI(){
    committedPostcode = null;
    dataRows = [];
    hits = [];
    if (elPostcode){
      elPostcode.value = '';
      elPostcode.disabled = true;
    }
    if (elTown) elTown.innerHTML = ''; // show nothing
  }

  async function loadCountry(code){
    if(!code){
      selectedCountry = null;
      resetSectionUI();
      return;
    }
    selectedCountry = code.toUpperCase();
    resetSectionUI();

    try{
      const meta = DATA_FILES[selectedCountry];
      if(!meta) return;
      const res = await fetch(meta.file, { cache:'no-store' });
      if(!res.ok) throw new Error(`${meta.file} ${res.status}`);
      const raw = await res.json();
      const arr = Array.isArray(raw) ? raw : (raw.data || raw.rows || []);
      dataRows = arr.map(normRow).filter(r => r.postcode);
      if (elPostcode) elPostcode.disabled = false;
    }catch(err){
      console.error('Failed to load dataset for', selectedCountry, err);
    }
  }

  function filter(q){
    if(!q){ hits = []; return; }
    const qq = q.trim().toLowerCase();
    hits = dataRows
      .filter(r => r.postcode && r.postcode.toLowerCase().includes(qq))
      .sort((a,b)=> score(a,qq) - score(b,qq) || a.postcode.localeCompare(b.postcode));
    hits = hits.slice(0,1); // top suggestion only
  }

  elCountry.addEventListener('change', ()=> loadCountry(elCountry.value));

  elPostcode.addEventListener('input', ()=>{
    const q = (elPostcode.value || '').trim();
    filter(q);
    elTown.innerHTML = summaryHTML(hits[0] || null);
  });

  elPostcode.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    const typed = (elPostcode.value || '').trim();
    if(!typed) return;

    let chosen = dataRows.find(r => r.postcode.toLowerCase() === typed.toLowerCase());
    if(!chosen){ filter(typed); chosen = hits[0]; }

    if(chosen){
      e.preventDefault();
      committedPostcode = chosen.postcode;
      elPostcode.value = committedPostcode;
      elTown.innerHTML = summaryHTML(chosen);
    }
  });

  resetSectionUI();
}

// Wire both sections (your IDs & naming conventions)
wireSection({ countryId:'Col_Country', postcodeId:'Col_Postcode', townId:'Col_Town' });
wireSection({ countryId:'Del_Country', postcodeId:'Del_Postcode', townId:'Del_Town' });

/* ========= NUMBERS SUM ========= */
function toNum(v){ const x = parseFloat(v); return Number.isFinite(x) ? x : 0; }
function updateSum(){
  const inputs = document.querySelectorAll('input[data-sum]');
  const sum = Array.from(inputs).reduce((acc, el)=> acc + toNum(el.value), 0);
  const out = document.getElementById('sumTotal');
  if (out) out.textContent = sum.toLocaleString();
}
document.addEventListener('input', (e)=>{
  if (e.target && e.target.matches('input[data-sum]')) updateSum();
});
document.addEventListener('change', (e)=>{
  if (e.target && e.target.matches  if (e.target && e.target.matches('input[data-sum]')) updateSum();
});
