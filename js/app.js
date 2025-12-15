
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

// Normalize user-typed postcode per country.
// For UK: uppercase, remove spaces, then reinsert single space before last 3 chars when possible.
function normalizePostcodeByCountry(input, country) {
  const s = (input ?? '').toString().trim();
  if (!s) return '';

  if ((country ?? '').toUpperCase() === 'UK') {
    let u = s.toUpperCase().replace(/\s+/g, '');
    // Only format with a space if we have at least 5 chars (outward+inward)
    if (u.length >= 5) {
      return u.slice(0, -3) + ' ' + u.slice(-3);
    }
    return u; // allow partial typing
  }

  // For other countries, just trim and uppercase (adjust as needed for BEL/NL/LUX rules)
  return s.toUpperCase();
}

const score = (row, q) => {
  // q is already lowercased in filter()
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
      <tr><td class="small muted">Postcode</td><td><strong>${row.postcode}</strong></td></tr>
      <tr><td class="small muted">Town / Area</td><td>${row.region || '—'}</td></tr>
    </table>`;
}

/* ========= SECTION WIRING ========= */
function wireSection({ countryId, postcodeId, townId }){
  const elCountry  = document.getElementById(countryId);
  const elPostcode = document.getElementById(postcodeId);
  const elTown     = document.getElementById(townId);

  // If the country element is missing, bail early for this section
  if (!elCountry) {
    console.warn(`wireSection: missing country element #${countryId}`);
    return;
  }
  // We'll guard postcodes/town uses where needed below.

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
      if(!meta) {
        console.warn('No dataset mapping for country', selectedCountry);
        return;
      }
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
    const normalized = normalizePostcodeByCountry(q, selectedCountry);
    const qq = normalized.trim().toLowerCase();

    hits = dataRows
      .filter(r => r.postcode && r.postcode.toLowerCase().includes(qq))
      .sort((a,b)=> score(a,qq) - score(b,qq) || a.postcode.localeCompare(b.postcode))
      .slice(0, 1); // top suggestion only
  }

  // Country change
  elCountry.addEventListener('change', () => loadCountry(elCountry.value));

  // Guard: only add listeners if elPostcode exists
  if (elPostcode) {
    elPostcode.addEventListener('input', () => {
      const qRaw = (elPostcode.value || '').trim();
      // Normalize as the user types (light-touch: only for UK spacing)
      const formatted = normalizePostcodeByCountry(qRaw, selectedCountry);
      if (formatted !== elPostcode.value) {
        elPostcode.value = formatted;
      }
      filter(formatted);
      if (elTown) elTown.innerHTML = summaryHTML(hits[0] || null);
    });

    elPostcode.addEventListener('keydown', (e) => {
      if(e.key !== 'Enter') return;
      const typed = normalizePostcodeByCountry((elPostcode.value || '').trim(), selectedCountry);
      if(!typed) return;

      let chosen = dataRows.find(r => r.postcode.toLowerCase() === typed.toLowerCase());
      if(!chosen){ filter(typed); chosen = hits[0]; }

      if(chosen){
        e.preventDefault();
        committedPostcode = chosen.postcode;
        elPostcode.value = committedPostcode;
        if (elTown) elTown.innerHTML = summaryHTML(chosen);
      }
    });
  } else {
    console.warn(`wireSection: missing postcode element #${postcodeId}`);
  }

  // Initial state
  resetSectionUI();

  // If the country already has a value on page load, load its dataset immediately.
  if (elCountry.value) {
    // Fire and forget; the input will be enabled after data fetch
       loadCountry(elCountry.value);
  }

