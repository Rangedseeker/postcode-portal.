
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

// UK outward part (first chunk before the space)
function outwardFromDatasetPostcode(pc) {
  const s = (pc ?? '').toString().trim().toUpperCase();
  const parts = s.split(/\s+/);
  return parts[0] || s;
}

// Normalize user input per country (UK: outward-only)
function normalizePostcodeByCountry(input, countryCode) {
  let s = (input ?? '').toString().trim();
  if (!s) return '';
  const cc = (countryCode ?? '').toUpperCase();

  s = s.replace(/\s+/g, '');

  if (cc === 'UK') {
    // Allow outward-only typing; just uppercase
    return s.toUpperCase();
  }
  return s.toUpperCase();
}

const score = (row, q) => {
  const p = row.postcode.toLowerCase();
  if (p === q) return 0;
  if (p.startsWith(q)) return 1;
  if (p.includes(q)) return 2;
  return 9;
};

function summaryHTML(row){
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

  if (!elCountry) {
    console.warn(`wireSection: missing #${countryId}`);
    return;
  }

  let selectedCountry = null;  // 'UK' | 'BEL' | 'NL' | 'LUX'
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
      if(!meta) {
        console.warn(`[${countryId}] No dataset for`, selectedCountry);
        return;
      }
      const res = await fetch(meta.file, { cache:'no-store' });
      if(!res.ok) throw new Error(`${meta.file} ${res.status}`);
      const raw = await res.json();
      const arr = Array.isArray(raw) ? raw : (raw.data || raw.rows || []);
      dataRows = arr.map(normRow).filter(r => r.postcode);

      // For UK datasets, cache outward code
      if (selectedCountry === 'UK') {
        dataRows = dataRows.map(r => ({ ...r, outward: outwardFromDatasetPostcode(r.postcode) }));
      }

      if (elPostcode) elPostcode.disabled = false;
      console.log(`[${countryId}] Loaded ${dataRows.length} rows for ${selectedCountry}`);
    }catch(err){
      console.error(`[${countryId}] Failed to load dataset for ${selectedCountry}:`, err);
      // Let user type even if suggestions fail
      if (elPostcode) elPostcode.disabled = false;
    }
  }

  function filter(q){
    hits = [];
    if(!q) return;

    const normalized = normalizePostcodeByCountry(q, selectedCountry);
    const qq = normalized.trim().toLowerCase();

    if (selectedCountry === 'UK') {
      // Outward-only: startsWith outward
      hits = dataRows
        .filter(r => r.outward && r.outward.toLowerCase().startsWith(qq))
        .sort((a,b)=> a.outward.localeCompare(b.outward))
        .slice(0, 1);
    } else {
      // Original behavior for other countries
      hits = dataRows
        .filter(r => r.postcode && r.postcode.toLowerCase().includes(qq))
        .sort((a,b)=> score(a,qq) - score(b,qq) || a.postcode.localeCompare(b.postcode))
        .slice(0, 1);
    }
  }

  // Country select
  elCountry.addEventListener('change', () => loadCountry(elCountry.value));

  if (elPostcode) {
    elPostcode.addEventListener('input', () => {
      const qRaw = (elPostcode.value || '').trim();
      const formatted = normalizePostcodeByCountry(qRaw, selectedCountry);
      if (formatted !== elPostcode.value) elPostcode.value = formatted;
      filter(formatted);
      if (elTown) elTown.innerHTML = summaryHTML(hits[0] || null);
    });

    elPostcode.addEventListener('keydown', (e) => {
      if(e.key !== 'Enter') return;
      const typed = normalizePostcodeByCountry((elPostcode.value || '').trim(), selectedCountry);
      if(!typed) return;

      let chosen = null;
      if (selectedCountry === 'UK') {
        chosen = dataRows.find(r => r.outward && r.outward.toLowerCase() === typed.toLowerCase());
      } else {
        chosen = dataRows.find(r => r.postcode.toLowerCase() === typed.toLowerCase());
      }
      if(!chosen){ filter(typed); chosen = hits[0]; }

      if(chosen){
        e.preventDefault();
        committedPostcode = selectedCountry === 'UK' ? (chosen.outward || chosen.postcode) : chosen.postcode;
        elPostcode.value = committedPostcode;
        if (elTown) elTown.innerHTML = summaryHTML(chosen);
      }
    });
  } else {
    console.warn(`wireSection: missing #${postcodeId}`);
  }

  // Initial state + initial dataset load if a value is already present (e.g., preselected)
  resetSectionUI();
  if (elCountry.value) loadCountry(elCountry.value);
}

/* ========= NUMBERS SUM ========= */
function toNum(v){
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  // Remove spaces and thousands separators
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

  // Sum: initial calc + live updates
  updateSum();
  document.addEventListener('input', (e)=>{
    if (e.target && e.target.matches('input[data-sum]')) updateSum();
  });
  document.addEventListener('change', (e)=>{
    if (e.target && e.target.matches('input[data-sum]')) updateSum();
  });
});

