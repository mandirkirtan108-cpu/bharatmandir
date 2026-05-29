import { useState, useRef, Fragment } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { adminAPI } from '../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const SECTS = ['','Shaiva','Vaishnava','Shakta','Smartha','Jain','Buddhist','Sikh','Other'];
const STATES_IN = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Delhi',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jammu & Kashmir','Jharkhand',
  'Karnataka','Kerala','Ladakh','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim',
  'Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
];
const SETTINGS = ['','Riverbank / Ghats','Hilltop / Mountain','Forest / Jungle','Urban / City','Cave / Underground','Island','Roadside / Highway','Village common'];
const ARCH_STYLES = ['Nagara (North Indian)','Dravidian (South Indian)','Vesara (Mixed)','Kalinga (Odisha)','Hemadpanthi','Modern / Other'];
const BUILDING_CONDITIONS = ['','Excellent — well maintained','Good — minor maintenance needed','Fair — needs renovation','Poor — urgent repair needed'];
const WEEKDAYS = ['None / All days equal','Monday (Shiva)','Tuesday (Hanuman / Devi)','Wednesday (Ganesha)','Thursday (Vishnu / Guru)','Friday (Lakshmi / Devi)','Saturday (Saturn / Hanuman)','Sunday (Surya)'];
const SAMPRADAYAS = ['','Shaiva','Vaishnava','Shakta','Smarta','Ramanandi','Madhva','ISKCON / Vaishnava','Other'];
const APPT_TYPES = ['','Hereditary family priest','Trust-appointed','Government / Endowment Board appointed','Community elected'];
const STATUS_OPTS = ['draft','review','published','flagged','archived'];
const SOURCE_OPTS = ['manual','wikidata','wikipedia','google_places','openstreetmap','government','ai_enriched','csv_import'];
const ROLES = ['admin','temple_representative','volunteer','data_entry'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const DESIGNATIONS = [
  { key:'is_jyotirlinga',     label:'⚡ Jyotirlinga' },
  { key:'is_shaktipeeth',     label:'🌸 Shaktipeeth' },
  { key:'is_divya_desam',     label:'🌿 Divya Desam' },
  { key:'is_ashtavinayak',    label:'🐘 Ashtavinayak' },
  { key:'is_char_dham',       label:'🏔️ Char Dham' },
  { key:'is_heritage_site',   label:'🏛️ Heritage Site' },
  { key:'is_asi_protected',   label:'🔒 ASI Protected' },
  { key:'is_pancha_bhuta',    label:'🌊 Pancha Bhuta' },
  { key:'is_51_shakti_peeths',label:'🌺 51 Shakti Peeths' },
  { key:'is_unesco_heritage', label:'🌍 UNESCO Heritage' },
  { key:'is_state_heritage',  label:'📜 State Heritage' },
];

const PUJAS = [
  { key:'puja_rudrabhishek',     label:'Rudrabhishek' },
  { key:'puja_satyanarayan',     label:'Satyanarayan Puja' },
  { key:'puja_havan_homa',       label:'Havan / Homa' },
  { key:'puja_laghu_rudra',      label:'Laghu Rudra' },
  { key:'puja_mahamrityunjaya',  label:'Mahamrityunjaya Japa' },
  { key:'puja_griha_pravesh',    label:'Griha Pravesh' },
  { key:'puja_naamkaran',        label:'Naamkaran' },
  { key:'puja_vivah',            label:'Vivah / Wedding' },
  { key:'puja_annaprashan',      label:'Annaprashan' },
  { key:'puja_mundan',           label:'Mundan / Chudakarana' },
  { key:'puja_pitru_tarpan',     label:'Pitru Tarpan' },
  { key:'puja_sahasranamarchana',label:'Sahasranamarchana' },
];

const FACILITIES = [
  { key:'facility_electricity',      label:'⚡ Electricity' },
  { key:'facility_water_supply',     label:'💧 Water Supply' },
  { key:'facility_clean_toilets',    label:'🚻 Clean Toilets' },
  { key:'facility_wheelchair',       label:'♿ Wheelchair Access' },
  { key:'facility_dharamshala',      label:'🏠 Dharamshala' },
  { key:'facility_prasad_dining',    label:'🍱 Prasad Dining' },
  { key:'facility_parking',          label:'🚗 Parking' },
  { key:'facility_security',         label:'🛡️ Security Guard' },
  { key:'facility_cctv',             label:'📹 CCTV' },
  { key:'facility_pa_system',        label:'🔊 PA System' },
  { key:'facility_internet_wifi',    label:'📶 Wi-Fi / Internet' },
  { key:'facility_library_pathshala',label:'📚 Library / Pathshala' },
  { key:'facility_gaushaala',        label:'🐄 Gaushaala' },
  { key:'facility_medical_support',  label:'🏥 Medical Support' },
];

const PROGRAMS = [
  { key:'prog_free_food',       label:'🍛 Free Food (Annadanam)' },
  { key:'prog_medical_camps',   label:'💉 Medical Camps' },
  { key:'prog_scholarship_edu', label:'🎓 Scholarships / Education' },
  { key:'prog_womens_selfhelp', label:"👩 Women's Self-Help" },
  { key:'prog_bhajan_kirtan',   label:'🎵 Bhajan / Kirtan' },
  { key:'prog_disaster_relief', label:'🌊 Disaster Relief' },
];

const DONATION_CATS = [
  { key:'donation_temple_renovation',label:'🏛️ Temple Renovation' },
  { key:'donation_annadanam',        label:'🍱 Annadanam' },
  { key:'donation_priest_salary',    label:'👳 Priest Salary' },
  { key:'donation_vedic_education',  label:'📚 Vedic Education' },
  { key:'donation_festival',         label:'🎊 Festival Expenses' },
  { key:'donation_medical_camps',    label:'💉 Medical Camps' },
  { key:'donation_general',          label:'🤲 General / Any Purpose' },
];

const STEP_LABELS = [
  'Temple Identity','Location','History','Visit Info',
  'Digital & Seva','Priests & Schedule','Media','Donations','Review & Submit',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function to12h(val) {
  if (!val) return '';
  const [hStr, mStr] = val.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function to24h(val) {
  if (!val) return '';
  const match = val.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return val;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

function TimeInput({ value, onChange, placeholder = '9:00 AM' }) {
  const [raw, setRaw] = useState(value ? to12h(value) : '');
  const handleChange = (e) => {
    const v = e.target.value;
    setRaw(v);
    const match = v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) onChange(to24h(v));
  };
  const handleBlur = () => {
    let v = raw.trim();
    if (v && !/AM|PM/i.test(v)) {
      const parts = v.split(':');
      const h = parseInt(parts[0], 10);
      const m = parts[1] ? parts[1].padStart(2,'0') : '00';
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = (h % 12) || 12;
      v = `${h12}:${m} ${ampm}`;
    }
    setRaw(v);
    const match = v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) onChange(to24h(v));
  };
  return <input type="text" value={raw} onChange={handleChange} onBlur={handleBlur} placeholder={placeholder} />;
}

function initialForm() {
  const bools = [
    ...DESIGNATIONS.map(d=>d.key),
    ...PUJAS.map(p=>p.key),
    ...FACILITIES.map(f=>f.key),
    ...PROGRAMS.map(p=>p.key),
    ...DONATION_CATS.map(d=>d.key),
  ];
  const base = {
    name:'', name_hindi:'', name_local:'', temple_type:'', sect:'', managing_authority:'',
    managing_authority_custom:'', trust_name:'', trust_registration_no:'',
    primary_deity:'', secondary_deities:'', category_tags:'', google_place_id:'',
    wikidata_id:'', osm_id:'', wikipedia_url:'', status:'draft', source:'manual',
    address:'', city:'', district:'', pincode:'', state:'', setting_environment:'',
    latitude:'', longitude:'', google_maps_link:'', nearest_railway:'', nearest_airport:'',
    nearest_bus_stand:'', local_landmark:'',
    history:'', history_hindi:'', sthala_purana:'', significance:'', puranic_stories:'',
    estimated_year_built:'', founded_by:'', last_renovation_year:'', building_condition:'',
    opening_time:'', closing_time:'', afternoon_closure_start:'', afternoon_closure_end:'',
    entry_fee:'', weekly_special_day:'None / All days equal', prasad_type:'', dress_code:'',
    best_time_to_visit:'', phone:'', whatsapp_number:'', official_email:'', best_time_to_call:'',
    website_url:'', facebook_page:'', youtube_channel:'', instagram_handle:'', hero_image_url:'',
    online_puja_available:'no', live_darshan_available:'no', live_stream_url:'',
    video_aarti_url:'', video_intro_url:'', video_360_url:'',
    chairman_name:'', chairman_contact:'', committee_count:'', election_cycle:'',
    election_cycle_custom:'', accept_online_donations:false, upi_id:'', certificate_80g_no:'',
    bank_account_name:'', bank_name_branch:'', bank_account_number:'', bank_ifsc:'',
    submitter_name:'', submitter_role:'admin', submitter_phone:'', submitter_email:'',
    custom_designation:'', custom_facility:'',
  };
  bools.forEach(k => base[k] = false);
  return base;
}

const initPriest  = () => ({ name:'', title:'', phone:'', sampradaya:'', appt_type:'', years:'', is_head:false, id: Math.random().toString(36).slice(2) });
const initSched   = () => ({ name:'', time:'', type:'Aarti', id: Math.random().toString(36).slice(2) });
const initOffering= () => ({ name:'', timing:'', id: Math.random().toString(36).slice(2) });
const initMantra  = () => ({ title:'', deity:'', sanskrit:'', transliteration:'', meaning:'', audio:'', id: Math.random().toString(36).slice(2) });
const initFestival= () => ({ name:'', hmonth:'', month:'', desc:'', days:'', major:false, id: Math.random().toString(36).slice(2) });

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=Noto+Sans+Devanagari:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
:root{
  --s1:#B84D00;--s2:#D4600A;--s3:#E8720F;--sl:#FFF5EB;--slm:#FFE8D0;
  --g1:#8B6800;--g2:#B8900A;--g3:#D4A820;--gl:#FDF7E0;
  --ink:#180F06;--inkm:#3A2010;--inkl:#7A5535;--inkll:#B09070;--inkx:#D8C0A0;
  --cream:#FDFAF3;--parch:#F8F1DF;--parch2:#F0E8D0;--white:#FFFFFF;
  --bd1:#DDD0B0;--bd2:#EAE0C8;--bd3:#F0EAD8;
  --green:#1A5C30;--greenl:#E8F4EE;--red:#B91C1C;--redl:#FEE2E2;
  --blue:#1D4ED8;--bluel:#EFF6FF;
  --sh1:0 1px 12px rgba(100,50,10,.07);--sh2:0 4px 28px rgba(100,50,10,.11);
  --ff-h:'Cinzel',Georgia,serif;--ff-b:'Crimson Pro',Georgia,serif;
  --ff-u:'DM Sans',system-ui,sans-serif;--ff-hi:'Noto Sans Devanagari',sans-serif;
}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{font-family:var(--ff-u);background:var(--cream);color:var(--ink);-webkit-font-smoothing:antialiased;}

.hero{position:relative;background:linear-gradient(160deg,#1A0A00 0%,#3D1F00 35%,#6B3A10 65%,#B84D00 100%);padding:56px 24px 72px;text-align:center;overflow:hidden;}
.hero-bg{position:absolute;inset:0;pointer-events:none;}
.hero-float{position:absolute;font-size:clamp(20px,3.5vw,44px);opacity:.12;animation:floatUp 7s ease-in-out infinite;}
.hero-float:nth-child(1){top:12%;left:6%;animation-delay:0s;}
.hero-float:nth-child(2){top:55%;left:12%;animation-delay:1.4s;}
.hero-float:nth-child(3){top:18%;right:8%;animation-delay:.7s;}
.hero-float:nth-child(4){bottom:18%;right:5%;animation-delay:2.1s;}
.hero-float:nth-child(5){top:70%;right:18%;animation-delay:1.8s;}
@keyframes floatUp{0%,100%{transform:translateY(0) rotate(-4deg);opacity:.12;}50%{transform:translateY(-16px) rotate(4deg);opacity:.22;}}
.hero-inner{position:relative;z-index:1;}
.hero-chip{display:inline-flex;align-items:center;gap:8px;background:rgba(200,150,12,.18);border:1px solid rgba(240,192,64,.35);backdrop-filter:blur(8px);color:#F0C040;padding:5px 18px;border-radius:50px;font-family:var(--ff-h);font-size:11px;letter-spacing:.14em;margin-bottom:16px;}
.hero h1{font-family:var(--ff-h);font-weight:900;color:#fff;font-size:clamp(28px,5vw,52px);line-height:1.1;margin-bottom:10px;text-shadow:0 2px 20px rgba(0,0,0,.4);}
.hero h1 span{color:#F0C040;}
.hero p{font-family:var(--ff-hi);font-size:15px;color:rgba(255,255,255,.7);}

.progress-wrap{background:var(--white);border-bottom:2px solid var(--bd2);position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(100,50,10,.07);}
.progress{max-width:1000px;margin:0 auto;padding:0 24px;display:flex;align-items:center;overflow-x:auto;gap:0;}
.step{display:flex;align-items:center;flex-shrink:0;}
.step-btn{display:flex;align-items:center;gap:8px;padding:15px 16px;border:none;background:transparent;cursor:pointer;border-bottom:3px solid transparent;transition:all .25s;font-family:var(--ff-u);font-size:12px;color:var(--inkll);white-space:nowrap;}
.step-btn:hover{color:var(--s2);}
.step-btn.active{color:var(--s2);border-bottom-color:var(--s2);background:rgba(232,101,10,.04);}
.step-btn.done{color:var(--green);border-bottom-color:var(--green);}
.step-num{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;background:var(--bd2);color:var(--inkll);flex-shrink:0;transition:all .25s;}
.step-btn.active .step-num{background:var(--s2);color:#fff;}
.step-btn.done .step-num{background:var(--green);color:#fff;}
.step-div{width:1px;height:18px;background:var(--bd2);flex-shrink:0;}

.page{max-width:900px;margin:0 auto;padding:36px 24px 80px;}
.fsec{background:var(--white);border:1px solid var(--bd2);border-radius:16px;padding:26px 30px;margin-bottom:18px;box-shadow:var(--sh1);}
.fsec-hdr{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--bd3);}
.fsec-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;background:var(--sl);}
.fsec-title{font-family:var(--ff-h);font-size:16px;font-weight:700;color:var(--ink);}
.fsec-sub{font-size:11.5px;color:var(--inkl);margin-top:2px;}

.fg{margin-bottom:14px;}
.fg-2{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-bottom:14px;}
.fg-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;margin-bottom:14px;}
.fg-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:13px;margin-bottom:14px;}
.fl{font-size:10.5px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:var(--inkl);display:block;margin-bottom:5px;}
.req{color:var(--s2);}
.opt{color:var(--inkll);font-weight:400;text-transform:none;letter-spacing:0;font-size:10px;}

input[type=text],input[type=email],input[type=tel],input[type=number],input[type=url],
input[type=time],input[type=date],select,textarea{
  width:100%;padding:10px 13px;border:1.5px solid var(--bd2);border-radius:9px;
  font-family:var(--ff-u);font-size:13px;color:var(--ink);background:var(--parch);
  outline:none;transition:border-color .18s,background .18s,box-shadow .18s;
  appearance:none;-webkit-appearance:none;
}
input:focus,select:focus,textarea:focus{border-color:var(--s2);background:var(--white);box-shadow:0 0 0 3px rgba(212,96,10,.08);}
input::placeholder,textarea::placeholder{color:var(--inkx);}
textarea{resize:vertical;min-height:90px;line-height:1.65;}
select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23B09070' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center;padding-right:30px;}

.field-hint{font-size:11px;color:var(--inkll);margin-top:4px;font-style:italic;}
.field-err{font-size:11.5px;color:var(--red);margin-top:5px;font-weight:500;display:flex;align-items:center;gap:5px;}
.field-err::before{content:'⚠';font-size:11px;}

.fg.has-error > input[type=text],
.fg.has-error > input[type=email],
.fg.has-error > input[type=tel],
.fg.has-error > input[type=number],
.fg.has-error > input[type=url],
.fg.has-error > select,
.fg.has-error > textarea{
  border-color:var(--red) !important;
  background:var(--redl) !important;
  box-shadow:0 0 0 3px rgba(185,28,28,.10);
}
.fg.has-error input[type=text]:not(.sched-row input):not(.offering-row input),
.fg.has-error input[type=email],
.fg.has-error input[type=tel],
.fg.has-error input[type=number],
.fg.has-error input[type=url],
.fg.has-error select,
.fg.has-error textarea{
  border-color:var(--red) !important;
  background:var(--redl) !important;
  box-shadow:0 0 0 3px rgba(185,28,28,.10);
}
.fg.has-error input:focus,
.fg.has-error select:focus,
.fg.has-error textarea:focus{
  box-shadow:0 0 0 3px rgba(185,28,28,.18);
}

.chip-group{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;}
.chip{padding:7px 15px;border-radius:50px;border:1.5px solid var(--bd2);background:var(--white);font-family:var(--ff-u);font-size:12.5px;color:var(--inkm);cursor:pointer;transition:all .15s;user-select:none;}
.chip:hover{border-color:var(--s3);color:var(--s2);}
.chip.on{border-color:var(--s2);background:var(--sl);color:var(--s1);font-weight:500;}

.puja-grid,.fac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:8px;}
.fac-grid{grid-template-columns:repeat(auto-fill,minmax(185px,1fr));}
.puja-item,.fac-item{border:1.5px solid var(--bd2);border-radius:9px;padding:9px 12px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:8px;user-select:none;}
.puja-item:hover,.fac-item:hover{border-color:var(--s2);background:var(--sl);}
.puja-item.on,.fac-item.on{border-color:var(--s2);background:var(--sl);}
.puja-name,.fac-name{font-size:12.5px;color:var(--inkm);}

.sched-builder{border:1px solid var(--bd2);border-radius:10px;overflow:hidden;}
.sched-hdr{background:var(--parch);padding:10px 14px;font-size:10.5px;font-weight:500;color:var(--inkl);text-transform:uppercase;letter-spacing:.06em;display:grid;grid-template-columns:1fr 130px 100px 34px;gap:10px;}
.sched-row{display:grid;grid-template-columns:1fr 130px 100px 34px;gap:10px;padding:8px 14px;border-top:1px solid var(--bd3);align-items:center;}
.sched-row input,.sched-row select{padding:6px 10px;border-radius:7px;font-size:12px;}
.sched-del{width:28px;height:28px;border:1px solid var(--bd2);border-radius:7px;background:var(--white);color:var(--red);cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
.sched-del:hover{background:var(--redl);border-color:var(--red);}
.add-sched-btn,.add-btn{padding:8px 16px;border:1px dashed var(--bd1);border-radius:8px;background:transparent;font-size:12px;color:var(--inkl);cursor:pointer;transition:all .15s;margin-top:8px;display:flex;align-items:center;gap:6px;}
.add-sched-btn:hover,.add-btn:hover{border-color:var(--s2);color:var(--s2);}

.priest-card{border:1.5px solid var(--bd2);border-radius:12px;padding:16px 18px;margin-bottom:12px;position:relative;background:var(--parch);}
.priest-card-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.priest-card-title{font-family:var(--ff-h);font-size:13px;color:var(--inkm);}
.remove-priest{border:1px solid var(--bd2);border-radius:7px;background:var(--white);color:var(--red);cursor:pointer;font-size:12px;padding:4px 10px;}
.remove-priest:hover{background:var(--redl);}

.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:12px;}
.photo-slot{aspect-ratio:1;border:2px dashed var(--bd1);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;background:var(--parch);position:relative;overflow:hidden;}
.photo-slot:hover{border-color:var(--s2);background:var(--sl);}
.photo-slot.has-img{border-style:solid;border-color:var(--bd1);}
.ps-icon{font-size:22px;margin-bottom:5px;opacity:.45;}
.ps-label{font-size:10px;color:var(--inkll);text-align:center;line-height:1.4;padding:0 8px;}
.ps-req{font-size:9px;color:var(--s2);font-weight:500;margin-top:3px;}
.ps-preview{position:absolute;inset:0;background-size:cover!important;background-position:center!important;}
.ps-remove{position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:50%;background:rgba(185,28,28,.8);color:#fff;border:none;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;}

.video-field{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid var(--bd2);border-radius:9px;background:var(--parch);}
.video-field-icon{font-size:18px;flex-shrink:0;}
.video-field input{border:none;background:transparent;padding:0;font-size:13px;flex:1;}
.video-field input:focus{box-shadow:none;border:none;}

.donation-box{background:var(--gl);border:1.5px solid #e0cc8a;border-radius:12px;padding:18px 20px;margin-bottom:14px;}
.donation-box-title{font-family:var(--ff-h);font-size:13px;color:var(--g1);margin-bottom:12px;display:flex;align-items:center;gap:8px;}

.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
.s-item{background:rgba(255,255,255,.08);border-radius:9px;padding:10px 13px;}
.si-l{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.5);margin-bottom:3px;}
.si-v{font-size:12.5px;font-weight:500;color:#fff;}
.si-v.empty{color:rgba(255,255,255,.4);font-style:italic;font-weight:400;}

.review-card{background:linear-gradient(135deg,rgba(24,15,6,.96),rgba(107,58,16,.94));border-radius:16px;padding:26px 30px;color:#fff;margin-bottom:18px;}
.review-card-title{font-family:var(--ff-h);font-size:15px;letter-spacing:.06em;color:#F0C040;margin-bottom:18px;display:flex;align-items:center;gap:8px;}

.consent-title{font-family:var(--ff-h);font-size:15px;font-weight:700;color:var(--ink);margin-bottom:10px;}
.consent-check{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--inkm);line-height:1.55;margin-bottom:8px;cursor:pointer;}
.consent-check input{accent-color:var(--s2);width:14px;height:14px;flex-shrink:0;margin-top:3px;}

.form-nav{display:flex;align-items:center;justify-content:space-between;margin-top:22px;gap:12px;flex-wrap:wrap;}
.step-indicator{font-size:12px;color:var(--inkl);}
.btn-back{padding:11px 22px;border:1.5px solid var(--bd1);border-radius:9px;font-size:13px;color:var(--inkm);background:var(--white);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:6px;}
.btn-back:hover{border-color:var(--s2);color:var(--s2);}
.btn-next{padding:11px 28px;background:var(--s2);color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;box-shadow:0 3px 12px rgba(212,96,10,.28);display:flex;align-items:center;gap:6px;}
.btn-next:hover{background:var(--s1);transform:translateY(-1px);}
.btn-submit{padding:12px 32px;background:var(--green);color:#fff;border:none;border-radius:9px;font-size:13.5px;font-weight:500;cursor:pointer;transition:all .2s;box-shadow:0 3px 12px rgba(26,92,48,.28);display:flex;align-items:center;gap:7px;}
.btn-submit:hover:not(:disabled){background:#145A25;transform:translateY(-1px);}
.btn-submit:disabled{opacity:.6;cursor:not-allowed;}

@keyframes shake{0%,100%{transform:translateX(0);}15%{transform:translateX(-5px);}30%{transform:translateX(5px);}45%{transform:translateX(-4px);}60%{transform:translateX(4px);}75%{transform:translateX(-2px);}90%{transform:translateX(2px);}}
.shake{animation:shake .4s ease;}

.success-page{text-align:center;padding:60px 20px;}
.success-icon{font-size:60px;margin-bottom:16px;}
.success-title{font-family:var(--ff-h);font-size:30px;font-weight:700;color:var(--green);margin-bottom:8px;}
.success-sub{font-family:var(--ff-b);font-style:italic;font-size:17px;color:var(--inkl);margin-bottom:22px;line-height:1.7;max-width:480px;margin-left:auto;margin-right:auto;}
.qr-preview{display:inline-block;background:var(--white);border:2px solid var(--bd2);border-radius:14px;padding:22px 30px;margin-bottom:22px;box-shadow:var(--sh2);}
.qr-box{font-size:56px;margin-bottom:6px;}
.qr-id{font-family:monospace;font-size:17px;font-weight:500;color:var(--s2);}
.qr-note{font-size:11px;color:var(--inkll);margin-top:4px;}
.success-steps{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:26px;}
.ss-item{background:var(--white);border:1px solid var(--bd2);border-radius:11px;padding:13px 16px;text-align:left;max-width:190px;}
.ss-num{font-family:var(--ff-h);font-size:22px;font-weight:700;color:var(--s2);margin-bottom:4px;}
.ss-text{font-size:11.5px;color:var(--inkl);line-height:1.5;}
.btn-home{padding:11px 26px;background:var(--s2);color:#fff;border:none;border-radius:9px;font-size:13.5px;font-weight:500;cursor:pointer;box-shadow:0 3px 12px rgba(212,96,10,.28);transition:all .2s;}
.btn-home:hover{background:var(--s1);}

.sec-label{font-family:var(--ff-h);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--s2);margin-bottom:12px;margin-top:22px;display:flex;align-items:center;gap:8px;}
.sec-label::after{content:'';flex:1;height:1px;background:var(--bd3);}
.sec-label:first-child{margin-top:0;}

.arch-chip{padding:7px 14px;border-radius:50px;border:1.5px solid var(--bd2);background:var(--white);font-family:var(--ff-u);font-size:12.5px;color:var(--inkm);cursor:pointer;transition:all .15s;user-select:none;}
.arch-chip:hover{border-color:var(--s3);color:var(--s2);}
.arch-chip.on{border-color:var(--s2);background:var(--sl);color:var(--s1);font-weight:500;}

.offering-builder{border:1px solid var(--bd2);border-radius:10px;overflow:hidden;margin-top:8px;}
.offering-hdr{background:var(--parch);padding:9px 14px;font-size:10.5px;font-weight:500;color:var(--inkl);text-transform:uppercase;letter-spacing:.06em;display:grid;grid-template-columns:1fr 160px 34px;gap:10px;}
.offering-row{display:grid;grid-template-columns:1fr 160px 34px;gap:10px;padding:8px 14px;border-top:1px solid var(--bd3);align-items:center;}
.offering-row input{padding:6px 10px;border-radius:7px;font-size:12px;}

.info-banner{background:var(--bluel);border:1px solid #93C5FD;border-radius:9px;padding:11px 15px;font-size:12.5px;color:#1e40af;display:flex;align-items:flex-start;gap:9px;margin-bottom:14px;}
.warn-banner{background:#FEF9C3;border:1px solid #FDE047;border-radius:9px;padding:11px 15px;font-size:12.5px;color:#713f12;display:flex;align-items:flex-start;gap:9px;margin-bottom:14px;}

.sub-card{border:1.5px solid var(--bd2);border-radius:10px;padding:14px 16px;margin-bottom:10px;position:relative;}
.festival-major-row{display:flex;align-items:center;gap:10px;padding:9px 13px;border:1.5px solid var(--bd2);border-radius:9px;cursor:pointer;transition:all .15s;user-select:none;margin-top:8px;}
.festival-major-row:hover{border-color:var(--s2);background:var(--sl);}
.festival-major-row.on{border-color:var(--s2);background:var(--sl);}
.festival-major-row input{accent-color:var(--s2);width:14px;height:14px;flex-shrink:0;}

.custom-input-row{display:flex;align-items:center;gap:8px;margin-top:8px;}
.custom-input-row input{flex:1;}
.time-badge{display:inline-flex;align-items:center;gap:4px;background:var(--sl);border:1px solid var(--slm);border-radius:6px;padding:3px 8px;font-size:10px;color:var(--s1);font-weight:500;margin-top:4px;}

@keyframes fadein{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.form-section{animation:fadein .32s ease;}

/* Priest error highlight */
.priest-field-err{font-size:11px;color:var(--red);margin-top:3px;display:flex;align-items:center;gap:4px;}
.priest-field-err::before{content:'⚠';font-size:10px;}
.priest-input-err{border-color:var(--red) !important;background:var(--redl) !important;}

/* Festival error highlight */
.festival-err-banner{background:var(--redl);border:1px solid #FCA5A5;border-radius:8px;padding:8px 12px;font-size:12px;color:var(--red);margin-bottom:8px;display:flex;align-items:center;gap:6px;}

/* Sched error highlight */
.sched-err-row{border-left:3px solid var(--red) !important;}
.sched-err-input{border-color:var(--red) !important;background:var(--redl) !important;}

@media(max-width:700px){
  .fg-2,.fg-3,.fg-4{grid-template-columns:1fr;}
  .page{padding:24px 14px 60px;}
  .fsec{padding:18px 16px;}
  .summary-grid{grid-template-columns:1fr 1fr;}
  .sched-hdr,.sched-row{grid-template-columns:1fr 110px 80px 32px;font-size:11px;}
  .offering-hdr,.offering-row{grid-template-columns:1fr 130px 32px;font-size:11px;}
  .form-nav{gap:8px;}
}
`;

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionCard({ icon, title, sub, children }) {
  return (
    <div className="fsec">
      <div className="fsec-hdr">
        <div className="fsec-icon">{icon}</div>
        <div>
          <div className="fsec-title">{title}</div>
          {sub && <div className="fsec-sub">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, req, opt, hint, err, children }) {
  return (
    <div className={`fg${err ? ' has-error' : ''}`}>
      {label && (
        <label className="fl">
          {label}
          {req && <span className="req"> ✶</span>}
          {opt && <span className="opt"> (optional)</span>}
        </label>
      )}
      {children}
      {hint && !err && <div className="field-hint">{hint}</div>}
      {err  && <div className="field-err">{err}</div>}
    </div>
  );
}

function Inp({ id, value, onChange, ...rest }) {
  return <input id={id} value={value} onChange={e => onChange(e.target.value)} {...rest} />;
}
function Sel({ id, value, onChange, options, children }) {
  return (
    <select id={id} value={value} onChange={e => onChange(e.target.value)}>
      {children || options.map(o => <option key={o} value={o}>{o || 'Select'}</option>)}
    </select>
  );
}
function Txt({ id, value, onChange, rows = 3, ...rest }) {
  return <textarea id={id} value={value} rows={rows} onChange={e => onChange(e.target.value)} {...rest} />;
}
function SecLabel({ children }) {
  return <div className="sec-label">{children}</div>;
}
function CheckGrid({ items, form, toggle, className = 'puja-grid', itemClass = 'puja-item', nameClass = 'puja-name' }) {
  return (
    <div className={className}>
      {items.map(({ key, label }) => (
        <div key={key} className={`${itemClass}${form[key] ? ' on' : ''}`} onClick={() => toggle(key)}>
          <input type="checkbox" checked={form[key]} onChange={() => {}} style={{ accentColor:'var(--s2)', flexShrink:0 }} />
          <span className={nameClass}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function AdminAddTemplePage() {
  const [form, setForm]       = useState(initialForm());
  const [step, setStep]       = useState(1);
  const [errors, setErrors]   = useState({});
  const [priests, setPriests] = useState([initPriest()]);
  const [priestErrors, setPriestErrors] = useState({});
  const [scheds, setScheds]   = useState([initSched(), initSched()]);
  const [schedErrors, setSchedErrors] = useState({});
  const [pujaOfferings, setPujaOfferings] = useState([]);
  const [mantras, setMantras] = useState([initMantra()]);
  const [festivals, setFestivs] = useState([initFestival()]);
  const [festivalErrors, setFestivalErrors] = useState({});
  const [photos, setPhotos]   = useState(Array(6).fill(null));
  const [consents, setConsents] = useState([false,false,false,false,false]);
  const [archStyles, setArchStyles] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [qrId, setQrId]       = useState('');
  const [btnShake, setBtnShake] = useState(false);

  const [showCustomDesignation, setShowCustomDesignation] = useState(false);
  const [customDesignationText, setCustomDesignationText] = useState('');
  const [showCustomFacility, setShowCustomFacility] = useState(false);
  const [customFacilityText, setCustomFacilityText] = useState('');

  const progressRef = useRef(null);

  const set    = (k, v) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(p => ({ ...p, [k]: undefined })); };
  const toggle = k       => setForm(p => ({ ...p, [k]: !p[k] }));
  const toggleArchStyle = s => setArchStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const isCustomAuthority = form.managing_authority === '__custom__';
  const effectiveAuthority = isCustomAuthority ? form.managing_authority_custom : form.managing_authority;
  const isCustomCycle = form.election_cycle === '__custom__';
  const effectiveCycle = isCustomCycle ? form.election_cycle_custom : form.election_cycle;

  // ── Validation ────────────────────────────────────────────────────────────────
  function validate(s) {
    const e = {};

    if (s === 1) {
      if (!form.name.trim())          e.name          = 'This field is required';
      if (!form.primary_deity.trim()) e.primary_deity = 'This field is required';
      // NEW required on step 1
      if (!form.sect)                 e.sect           = 'This field is required';
      if (!form.managing_authority)   e.managing_authority = 'This field is required';
      if (isCustomAuthority && !form.managing_authority_custom.trim())
        e.managing_authority_custom = 'Please enter the custom managing authority';
    }

    if (s === 2) {
      if (!form.address.trim()) e.address = 'This field is required';
      if (!form.city.trim())    e.city    = 'This field is required';
      if (!form.state)          e.state   = 'This field is required';
      // NEW required on step 2
      if (!form.pincode.trim()) e.pincode = 'This field is required';
      if (!form.district.trim()) e.district = 'This field is required';
      if (!form.latitude.trim() || isNaN(parseFloat(form.latitude)))  e.latitude  = 'Valid GPS latitude is required';
      if (!form.longitude.trim() || isNaN(parseFloat(form.longitude))) e.longitude = 'Valid GPS longitude is required';
      if (!form.nearest_railway.trim()) e.nearest_railway = 'This field is required';
      if (!form.nearest_airport.trim()) e.nearest_airport = 'This field is required';
      if (!form.nearest_bus_stand.trim()) e.nearest_bus_stand = 'This field is required';
    }

    if (s === 3) {
      // NEW required on step 3
      if (!form.history.trim())          e.history          = 'This field is required';
      if (!form.history_hindi.trim())    e.history_hindi    = 'This field is required';
      if (!form.sthala_purana.trim())    e.sthala_purana    = 'This field is required';
      if (!form.significance.trim())     e.significance     = 'This field is required';
      if (!form.puranic_stories.trim())  e.puranic_stories  = 'This field is required';
    }

    if (s === 4) {
      // NEW required on step 4
      if (!form.opening_time) e.opening_time = 'This field is required';
      if (!form.closing_time) e.closing_time = 'This field is required';
      if (!form.afternoon_closure_start) e.afternoon_closure_start = 'This field is required';
      if (!form.afternoon_closure_end)   e.afternoon_closure_end   = 'This field is required';
      if (!form.dress_code.trim())       e.dress_code              = 'This field is required';
    }

    if (s === 6) {
      // Priest validation — each priest needs name, phone, sampradaya, appt_type, years
      const pErrs = {};
      priests.forEach(p => {
        const pe = {};
        if (!p.name.trim())       pe.name       = 'This field is required';
        if (!p.phone.trim())      pe.phone      = 'This field is required';
        if (!p.sampradaya)        pe.sampradaya = 'This field is required';
        if (!p.appt_type)         pe.appt_type  = 'This field is required';
        if (p.years === '')       pe.years      = 'This field is required';
        if (Object.keys(pe).length) pErrs[p.id] = pe;
      });
      if (Object.keys(pErrs).length) {
        setPriestErrors(pErrs);
        e._priestErrors = true;
      } else {
        setPriestErrors({});
      }

      // Schedule validation — each schedule needs name and time
      const sErrs = {};
      scheds.forEach(s2 => {
        const se = {};
        if (!s2.name.trim()) se.name = true;
        if (!s2.time.trim()) se.time = true;
        if (Object.keys(se).length) sErrs[s2.id] = se;
      });
      if (Object.keys(sErrs).length) {
        setSchedErrors(sErrs);
        e._schedErrors = true;
      } else {
        setSchedErrors({});
      }
    }

    if (s === 7) {
      // Festival validation — each festival needs name, month, desc, days
      const fErrs = {};
      festivals.forEach(f => {
        const fe = {};
        if (!f.name.trim()) fe.name = 'This field is required';
        if (!f.month)       fe.month = 'This field is required';
        if (!f.desc.trim()) fe.desc  = 'This field is required';
        if (!f.days)        fe.days  = 'This field is required';
        if (Object.keys(fe).length) fErrs[f.id] = fe;
      });
      if (Object.keys(fErrs).length) {
        setFestivalErrors(fErrs);
        e._festivalErrors = true;
      } else {
        setFestivalErrors({});
      }
    }

    if (s === 9) {
      if (!form.submitter_name.trim())  e.submitter_name  = 'This field is required';
      if (!form.submitter_phone.trim()) e.submitter_phone = 'This field is required';
      if (!form.submitter_email.trim()) e.submitter_email = 'This field is required';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function triggerErrorFeedback() {
    setBtnShake(true);
    setTimeout(() => setBtnShake(false), 450);
    setTimeout(() => {
      const firstErr = document.querySelector('.fg.has-error, .priest-input-err, .sched-err-input, .festival-err-banner');
      if (firstErr) firstErr.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 60);
  }

  function nextStep(from) {
    if (!validate(from)) { triggerErrorFeedback(); return; }
    setStep(from + 1);
    setTimeout(() => progressRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
  }
  function prevStep(from) { setStep(from - 1); }
  function goStep(n) { if (n <= step) setStep(n); }

  // ── Photos ────────────────────────────────────────────────────────────────────
  function handlePhotoChange(e, idx) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotos(prev => { const a = [...prev]; a[idx] = url; return a; });
  }
  function removePhoto(idx) { setPhotos(prev => { const a=[...prev]; a[idx]=null; return a; }); }

  // ── Priests ───────────────────────────────────────────────────────────────────
  const addPriest    = () => setPriests(p => [...p, initPriest()]);
  const removePriest = id => { setPriests(p => p.filter(x => x.id !== id)); setPriestErrors(e => { const n={...e}; delete n[id]; return n; }); };
  const setPriest    = (id,k,v) => {
    setPriests(p => p.map(x => x.id===id ? {...x,[k]:v} : x));
    if (priestErrors[id]?.[k]) setPriestErrors(e => ({ ...e, [id]: { ...e[id], [k]: undefined } }));
  };

  // ── Schedule ──────────────────────────────────────────────────────────────────
  const addSched = () => setScheds(p => [...p, initSched()]);
  const delSched = id => { setScheds(p => p.length > 1 ? p.filter(x=>x.id!==id) : p); setSchedErrors(e => { const n={...e}; delete n[id]; return n; }); };
  const setSched = (id,k,v) => {
    setScheds(p => p.map(x => x.id===id ? {...x,[k]:v} : x));
    if (schedErrors[id]?.[k]) setSchedErrors(e => ({ ...e, [id]: { ...e[id], [k]: undefined } }));
  };

  // ── Puja Offerings ────────────────────────────────────────────────────────────
  const addOffering = () => setPujaOfferings(p => [...p, initOffering()]);
  const delOffering = id => setPujaOfferings(p => p.filter(x=>x.id!==id));
  const setOffering = (id,k,v) => setPujaOfferings(p => p.map(x => x.id===id ? {...x,[k]:v} : x));

  // ── Mantras ───────────────────────────────────────────────────────────────────
  const addMantra    = () => setMantras(p => [...p, initMantra()]);
  const removeMantra = id => setMantras(p => p.filter(x=>x.id!==id));
  const setMantra    = (id,k,v) => setMantras(p => p.map(x=>x.id===id ? {...x,[k]:v} : x));

  // ── Festivals ─────────────────────────────────────────────────────────────────
  const addFest    = () => setFestivs(p => [...p, initFestival()]);
  const removeFest = id => { setFestivs(p => p.filter(x=>x.id!==id)); setFestivalErrors(e => { const n={...e}; delete n[id]; return n; }); };
  const setFest    = (id,k,v) => {
    setFestivs(p => p.map(x=>x.id===id ? {...x,[k]:v} : x));
    if (festivalErrors[id]?.[k]) setFestivalErrors(e => ({ ...e, [id]: { ...e[id], [k]: undefined } }));
  };

  const allConsents = consents.every(Boolean);
  const toggleConsent = i => setConsents(c => { const a=[...c]; a[i]=!a[i]; return a; });

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function submitForm() {
    if (!validate(9)) { triggerErrorFeedback(); return; }
    if (!allConsents) return;
    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('city', form.city);
    fd.append('state', form.state);
    fd.append('status', form.status || 'draft');
    fd.append('source', form.source || 'admin_form');
    if (effectiveAuthority) fd.append('managing_authority', effectiveAuthority);
    if (effectiveCycle)     fd.append('election_cycle', effectiveCycle);
    if (archStyles.length)  fd.append('architecture_style', archStyles.join(', '));
    if (customDesignationText) fd.append('custom_designation', customDesignationText);
    if (customFacilityText)    fd.append('custom_facility', customFacilityText);
    const strFields = [
      'name_hindi','name_local','temple_type','sect','trust_name','trust_registration_no',
      'primary_deity','secondary_deities','address','district','pincode','setting_environment',
      'google_maps_link','nearest_railway','nearest_airport','nearest_bus_stand','local_landmark',
      'history','history_hindi','sthala_purana','significance','puranic_stories',
      'estimated_year_built','founded_by','last_renovation_year','building_condition',
      'opening_time','closing_time','afternoon_closure_start','afternoon_closure_end',
      'weekly_special_day','online_puja_available','live_darshan_available','live_stream_url',
      'prasad_type','dress_code','best_time_to_visit','phone','whatsapp_number','official_email',
      'website_url','facebook_page','youtube_channel','instagram_handle','best_time_to_call',
      'video_aarti_url','video_intro_url','video_360_url','upi_id','certificate_80g_no',
      'bank_account_name','bank_name_branch','bank_account_number','bank_ifsc','hero_image_url',
      'submitter_name','submitter_role','submitter_phone','submitter_email',
    ];
    strFields.forEach(k => { if (form[k]) fd.append(k, form[k]); });
    if (form.latitude)  fd.append('latitude',  form.latitude);
    if (form.longitude) fd.append('longitude', form.longitude);
    if (form.entry_fee) fd.append('entry_fee', form.entry_fee);
    const boolFields = [
      ...DESIGNATIONS.map(d=>d.key),...PUJAS.map(p=>p.key),
      ...FACILITIES.map(f=>f.key),...PROGRAMS.map(p=>p.key),
      ...DONATION_CATS.map(d=>d.key),'accept_online_donations',
    ];
    boolFields.forEach(k => fd.append(k, form[k] ? 'true' : 'false'));
    try {
      const res = await adminAPI.createTemple(fd);
      setQrId(res.data.mkt_id);
      setSubmitted(true);
      window.scrollTo({ top:0, behavior:'smooth' });
    } catch (err) {
      alert('Error saving temple: ' + (err.response?.data?.detail || err.message || 'Unknown error'));
    }
  }

  const summaryItems = [
    ['Temple Name', form.name||'—'], ['Name (Hindi)', form.name_hindi||'—'],
    ['City', form.city||'—'], ['State', form.state||'—'],
    ['Primary Deity', form.primary_deity||'—'], ['Temple Type', form.temple_type||'—'],
    ['Sect', form.sect||'—'], ['Managing Auth', effectiveAuthority||'—'],
    ['Architecture', archStyles.join(', ')||'—'],
    ['GPS', form.latitude ? `${form.latitude}, ${form.longitude}` : '—'],
    ['Status', form.status||'—'], ['Online Puja', form.online_puja_available],
    ['Live Darshan', form.live_darshan_available], ['Weekly Special', form.weekly_special_day||'—'],
    ['Opening Time', form.opening_time ? to12h(form.opening_time) : '—'],
    ['Entry Fee', form.entry_fee ? `₹${form.entry_fee}` : '—'],
    ['Donations', form.accept_online_donations ? 'Yes' : 'No'], ['Source', form.source||'—'],
  ];

  // ── Helper: priest field with inline error ────────────────────────────────────
  function PriestField({ priestId, fieldKey, label, children }) {
    const err = priestErrors[priestId]?.[fieldKey];
    return (
      <div className={`fg${err ? ' has-error' : ''}`}>
        <label className="fl">{label} <span className="req"> ✶</span></label>
        {children}
        {err && <div className="field-err">{err}</div>}
      </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <Navbar hideAuth />

      <div className="hero">
        <div className="hero-bg">
          {['🛕','🪔','✨','🔱','🌸'].map((e,i) => <div key={i} className="hero-float">{e}</div>)}
        </div>
        <div className="hero-inner">
          <div className="hero-chip">⚙️ ADMIN PANEL</div>
          <h1>Add New <span>Temple</span></h1>
          <p>मंदिर पंजीकरण — Register a sacred temple to BharatMandir</p>
        </div>
      </div>

      <div className="progress-wrap" ref={progressRef}>
        <div className="progress">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const cls = `step-btn${step===n?' active':step>n?' done':''}`;
            return (
              <Fragment key={n}>
                {i > 0 && <div className="step-div" />}
                <div className="step">
                  <button className={cls} onClick={() => goStep(n)}>
                    <span className="step-num">{step>n ? '✓' : n}</span>
                    {label}
                  </button>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="page">
        {submitted ? (
          <div className="success-page">
            <div className="success-icon">🕉️</div>
            <div className="success-title">Jai Shri Ram! Temple Added!</div>
            <div className="success-sub">The temple has been saved and is pending review. The unique QR code will be generated after verification.</div>
            <div className="qr-preview">
              <div className="qr-box">▦</div>
              <div className="qr-id">{qrId}</div>
              <div className="qr-note">System QR ID (final code after verification)</div>
            </div>
            <div className="success-steps">
              {[['24h','Admin team reviews and verifies'],['QR','Unique QR code generated and sent'],['🔴','Temple profile goes live'],['💰','Donations & bookings enabled']].map(([n,t]) => (
                <div key={n} className="ss-item"><div className="ss-num">{n}</div><div className="ss-text">{t}</div></div>
              ))}
            </div>
            <button className="btn-home" onClick={() => { setSubmitted(false); setForm(initialForm()); setStep(1); setArchStyles([]); setPujaOfferings([]); }}>
              + Add Another Temple
            </button>
          </div>
        ) : (
          <>
            {/* ══ STEP 1 — TEMPLE IDENTITY ══ */}
            {step === 1 && (
              <div className="form-section">
                <SectionCard icon="🏛️" title="Temple Identity" sub="Core identification information">
                  <div className="fg-2">
                    <Field label="Temple Name (English)" req err={errors.name}>
                      <Inp id="name" type="text" value={form.name} onChange={v=>set('name',v)} placeholder="e.g. Mahakaleshwar Mandir" />
                    </Field>
                    <Field label="Name in Hindi" opt>
                      <Inp id="name_hindi" type="text" value={form.name_hindi} onChange={v=>set('name_hindi',v)} placeholder="e.g. महाकालेश्वर मंदिर" />
                    </Field>
                  </div>
                  <div className="fg-2">
                    <Field label="Local Language Name" opt>
                      <Inp id="name_local" type="text" value={form.name_local} onChange={v=>set('name_local',v)} placeholder="Name in regional language" />
                    </Field>
                    <Field label="Temple Type">
                      <Sel id="temple_type" value={form.temple_type} onChange={v=>set('temple_type',v)}>
                        <option value="">Select</option>
                        <option value="Mandir">Mandir</option>
                        <option value="Devasthan">Devasthan</option>
                        <option value="Peeth">Peeth</option>
                        <option value="Mutt">Mutt</option>
                        <option value="Shrine">Shrine</option>
                        <option value="Other">Other / Custom</option>
                      </Sel>
                    </Field>
                  </div>
                  <div className="fg-2">
                    <Field label="Sect / Tradition" req err={errors.sect}>
                      <Sel id="sect" value={form.sect} onChange={v=>set('sect',v)} options={SECTS} />
                    </Field>
                    <Field label="Managing Authority" req err={errors.managing_authority}>
                      <Sel id="managing_authority" value={form.managing_authority} onChange={v=>set('managing_authority',v)}>
                        <option value="">Select</option>
                        <option value="Private / Family Trust">Private / Family Trust</option>
                        <option value="Community / Village Trust">Community / Village Trust</option>
                        <option value="State Govt Endowment Board">State Govt Endowment Board</option>
                        <option value="Archaeological Survey of India (ASI)">Archaeological Survey of India (ASI)</option>
                        <option value="__custom__">✏️ Other / Custom…</option>
                      </Sel>
                      {isCustomAuthority && (
                        <div className="custom-input-row">
                          <Field label="" err={errors.managing_authority_custom}>
                            <Inp type="text" value={form.managing_authority_custom} onChange={v=>set('managing_authority_custom',v)} placeholder="Enter custom managing authority…" />
                          </Field>
                        </div>
                      )}
                    </Field>
                  </div>
                  <div className="fg-2">
                    <Field label="Trust / Society Name" opt>
                      <Inp id="trust_name" type="text" value={form.trust_name} onChange={v=>set('trust_name',v)} placeholder="e.g. Shri Mahakaleshwar Temple Trust" />
                    </Field>
                    <Field label="Trust Registration No." opt>
                      <Inp id="trust_registration_no" type="text" value={form.trust_registration_no} onChange={v=>set('trust_registration_no',v)} placeholder="e.g. MP/2020/12345" />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard icon="🪷" title="Deity & Religion" sub="Who is worshipped here">
                  <div className="fg-2">
                    <Field label="Primary Deity" req err={errors.primary_deity}>
                      <Inp id="primary_deity" type="text" value={form.primary_deity} onChange={v=>set('primary_deity',v)} placeholder="e.g. Lord Shiva / Mahakaal" />
                    </Field>
                    <Field label="Secondary Deities" opt hint="Separate multiple deities with | (pipe)">
                      <Inp id="secondary_deities" type="text" value={form.secondary_deities} onChange={v=>set('secondary_deities',v)} placeholder="e.g. Parvati|Ganesha|Kartikeya" />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard icon="⭐" title="Special Designations" sub="Sacred classifications this temple belongs to">
                  <div className="chip-group">
                    {DESIGNATIONS.map(({ key, label }) => (
                      <span key={key} className={`chip${form[key]?' on':''}`} onClick={() => toggle(key)}>{label}</span>
                    ))}
                    <span className={`chip${showCustomDesignation?' on':''}`} onClick={() => setShowCustomDesignation(p=>!p)}>✏️ Custom…</span>
                  </div>
                  {showCustomDesignation && (
                    <div className="custom-input-row" style={{ marginTop:12 }}>
                      <Inp type="text" value={customDesignationText} onChange={setCustomDesignationText} placeholder="Enter custom designation…" />
                    </div>
                  )}
                </SectionCard>

                <SectionCard icon="🏷️" title="Category Tags & External IDs" sub="For discovery and data linking">
                  <Field label="Category Tags" opt hint="Separate tags with | (pipe).">
                    <Inp id="category_tags" type="text" value={form.category_tags} onChange={v=>set('category_tags',v)} placeholder="e.g. ancient|riverside|pilgrimage|shiva" />
                  </Field>
                  <div className="fg-3">
                    <Field label="Google Place ID" opt><Inp type="text" value={form.google_place_id} onChange={v=>set('google_place_id',v)} placeholder="ChIJ..." /></Field>
                    <Field label="Wikidata ID" opt><Inp type="text" value={form.wikidata_id} onChange={v=>set('wikidata_id',v)} placeholder="Q12345" /></Field>
                    <Field label="OSM ID" opt><Inp type="text" value={form.osm_id} onChange={v=>set('osm_id',v)} placeholder="node/12345678" /></Field>
                  </div>
                  <Field label="Wikipedia URL" opt>
                    <Inp type="url" value={form.wikipedia_url} onChange={v=>set('wikipedia_url',v)} placeholder="https://en.wikipedia.org/wiki/..." />
                  </Field>
                  <div className="fg-2">
                    <Field label="Status">
                      <Sel id="status" value={form.status} onChange={v=>set('status',v)}>
                        {STATUS_OPTS.map(o=><option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
                      </Sel>
                    </Field>
                    <Field label="Data Source">
                      <Sel id="source" value={form.source} onChange={v=>set('source',v)}>
                        {SOURCE_OPTS.map(o=><option key={o} value={o}>{o.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                      </Sel>
                    </Field>
                  </div>
                </SectionCard>

                <div className="form-nav">
                  <div className="step-indicator">Step 1 of 9</div>
                  <button className={`btn-next${btnShake?' shake':''}`} onClick={() => nextStep(1)}>Next: Location →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 2 — LOCATION ══ */}
            {step === 2 && (
              <div className="form-section">
                <SectionCard icon="📍" title="Address & Location" sub="Physical location for maps and pilgrims">
                  <Field label="Full Address" req err={errors.address}>
                    <Txt id="address" value={form.address} onChange={v=>set('address',v)} rows={2} placeholder="Street, locality, landmark…" />
                  </Field>
                  <div className="fg-3">
                    <Field label="City / Town" req err={errors.city}>
                      <Inp id="city" type="text" value={form.city} onChange={v=>set('city',v)} placeholder="e.g. Ujjain" />
                    </Field>
                    <Field label="District" req err={errors.district}>
                      <Inp type="text" value={form.district} onChange={v=>set('district',v)} placeholder="e.g. Ujjain" />
                    </Field>
                    <Field label="PIN Code" req err={errors.pincode}>
                      <Inp type="text" value={form.pincode} onChange={v=>set('pincode',v)} placeholder="e.g. 456010" maxLength={6} />
                    </Field>
                  </div>
                  <div className="fg-2">
                    <Field label="State" req err={errors.state}>
                      <Sel id="state" value={form.state} onChange={v=>set('state',v)}>
                        <option value="">Select state</option>
                        {STATES_IN.map(s=><option key={s} value={s}>{s}</option>)}
                      </Sel>
                    </Field>
                    <Field label="Setting / Environment">
                      <Sel value={form.setting_environment} onChange={v=>set('setting_environment',v)} options={SETTINGS} />
                    </Field>
                  </div>
                  <div className="fg-2">
                    <Field label="GPS Latitude" req err={errors.latitude} hint="💡 Google Maps → Long press on temple → copy coordinates">
                      <Inp type="number" step="any" value={form.latitude} onChange={v=>set('latitude',v)} placeholder="e.g. 23.1828" />
                    </Field>
                    <Field label="GPS Longitude" req err={errors.longitude}>
                      <Inp type="number" step="any" value={form.longitude} onChange={v=>set('longitude',v)} placeholder="e.g. 75.7682" />
                    </Field>
                  </div>
                  <Field label="Google Maps Link" opt>
                    <Inp type="url" value={form.google_maps_link} onChange={v=>set('google_maps_link',v)} placeholder="https://maps.google.com/..." />
                  </Field>
                  <div className="fg-3">
                    <Field label="Nearest Railway Station" req err={errors.nearest_railway}>
                      <Inp type="text" value={form.nearest_railway} onChange={v=>set('nearest_railway',v)} placeholder="Name — distance e.g. 3 km" />
                    </Field>
                    <Field label="Nearest Airport" req err={errors.nearest_airport}>
                      <Inp type="text" value={form.nearest_airport} onChange={v=>set('nearest_airport',v)} placeholder="Name — distance e.g. 55 km" />
                    </Field>
                    <Field label="Nearest Bus Stand" req err={errors.nearest_bus_stand}>
                      <Inp type="text" value={form.nearest_bus_stand} onChange={v=>set('nearest_bus_stand',v)} placeholder="Name — distance e.g. 1 km" />
                    </Field>
                  </div>
                  <Field label="Local Landmark / Directions" opt>
                    <Inp type="text" value={form.local_landmark} onChange={v=>set('local_landmark',v)} placeholder="e.g. Near Dashashwamedh Ghat, opposite State Bank" />
                  </Field>
                </SectionCard>
                <div className="form-nav">
                  <button className="btn-back" onClick={() => prevStep(2)}>← Back</button>
                  <div className="step-indicator">Step 2 of 9</div>
                  <button className={`btn-next${btnShake?' shake':''}`} onClick={() => nextStep(2)}>Next: History →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 3 — HISTORY ══ */}
            {step === 3 && (
              <div className="form-section">
                <SectionCard icon="📜" title="History & Significance" sub="Cultural and religious background">
                  <SecLabel>History</SecLabel>
                  <Field label="History (English)" req err={errors.history}>
                    <Txt value={form.history} onChange={v=>set('history',v)} rows={4} placeholder="Brief history of the temple…" />
                  </Field>
                  <Field label="History (Hindi)" req err={errors.history_hindi}>
                    <Txt value={form.history_hindi} onChange={v=>set('history_hindi',v)} rows={3} placeholder="इस मंदिर का इतिहास हिंदी में लिखें…" />
                  </Field>
                  <SecLabel>Spiritual Context</SecLabel>
                  <Field label="Sthala Purana" req err={errors.sthala_purana}>
                    <Txt value={form.sthala_purana} onChange={v=>set('sthala_purana',v)} rows={3} placeholder="The divine legend or story associated with this sacred place…" />
                  </Field>
                  <Field label="Significance" req err={errors.significance}>
                    <Txt value={form.significance} onChange={v=>set('significance',v)} rows={3} placeholder="Why is this temple important?" />
                  </Field>
                  <Field label="Puranic Stories" req err={errors.puranic_stories}>
                    <Txt value={form.puranic_stories} onChange={v=>set('puranic_stories',v)} rows={3} placeholder="Relevant stories from the Puranas or scriptures…" />
                  </Field>
                  <SecLabel>Architecture & Construction</SecLabel>
                  <Field label="Architecture Style" hint="Click to select — multiple styles can be chosen">
                    <div className="chip-group" style={{ marginTop:4 }}>
                      {ARCH_STYLES.map(s => (
                        <span key={s} className={`arch-chip${archStyles.includes(s)?' on':''}`} onClick={() => toggleArchStyle(s)}>
                          {archStyles.includes(s)?'✓ ':''}{s}
                        </span>
                      ))}
                    </div>
                    {archStyles.length > 0 && <div className="field-hint" style={{ marginTop:8 }}>✅ Selected: {archStyles.join(' · ')}</div>}
                  </Field>
                  <div className="fg-3" style={{ marginTop:14 }}>
                    <Field label="Estimated Year Built">
                      <Inp type="text" value={form.estimated_year_built} onChange={v=>set('estimated_year_built',v)} placeholder="e.g. 7th century, 1234 AD" />
                    </Field>
                    <Field label="Founded By" opt>
                      <Inp type="text" value={form.founded_by} onChange={v=>set('founded_by',v)} placeholder="e.g. King Vikramaditya" />
                    </Field>
                    <Field label="Last Renovation Year" opt>
                      <Inp type="text" value={form.last_renovation_year} onChange={v=>set('last_renovation_year',v)} placeholder="e.g. 2018" />
                    </Field>
                  </div>
                  <Field label="Building Condition">
                    <Sel value={form.building_condition} onChange={v=>set('building_condition',v)} options={BUILDING_CONDITIONS} />
                  </Field>
                </SectionCard>
                <div className="form-nav">
                  <button className="btn-back" onClick={() => prevStep(3)}>← Back</button>
                  <div className="step-indicator">Step 3 of 9</div>
                  <button className={`btn-next${btnShake?' shake':''}`} onClick={() => nextStep(3)}>Next: Visit Info →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 4 — VISIT INFO ══ */}
            {step === 4 && (
              <div className="form-section">
                <SectionCard icon="🕐" title="Timings & Entry" sub="When and how pilgrims can visit">
                  <div className="info-banner">
                    <span>🕐</span>
                    <span>Enter times in <strong>AM / PM format</strong> — e.g. <strong>5:30 AM</strong>, <strong>9:00 PM</strong>.</span>
                  </div>
                  <div className="fg-2" style={{ marginBottom:14 }}>
                    <Field label="Opening Time" req err={errors.opening_time} hint="e.g. 5:30 AM">
                      <TimeInput value={form.opening_time} onChange={v=>set('opening_time',v)} placeholder="5:30 AM" />
                      {form.opening_time && <div className="time-badge">🕐 {to12h(form.opening_time)}</div>}
                    </Field>
                    <Field label="Closing Time" req err={errors.closing_time} hint="e.g. 9:00 PM">
                      <TimeInput value={form.closing_time} onChange={v=>set('closing_time',v)} placeholder="9:00 PM" />
                      {form.closing_time && <div className="time-badge">🕐 {to12h(form.closing_time)}</div>}
                    </Field>
                  </div>
                  <SecLabel>Afternoon Closure</SecLabel>
                  <div className="fg-2" style={{ marginBottom:14 }}>
                    <Field label="Closure Start" req err={errors.afternoon_closure_start} hint="e.g. 12:00 PM">
                      <TimeInput value={form.afternoon_closure_start} onChange={v=>set('afternoon_closure_start',v)} placeholder="12:00 PM" />
                      {form.afternoon_closure_start && <div className="time-badge">🕐 {to12h(form.afternoon_closure_start)}</div>}
                    </Field>
                    <Field label="Closure End" req err={errors.afternoon_closure_end} hint="e.g. 4:00 PM">
                      <TimeInput value={form.afternoon_closure_end} onChange={v=>set('afternoon_closure_end',v)} placeholder="4:00 PM" />
                      {form.afternoon_closure_end && <div className="time-badge">🕐 {to12h(form.afternoon_closure_end)}</div>}
                    </Field>
                  </div>
                  <div className="fg-3">
                    <Field label="Entry Fee (₹)">
                      <Inp type="number" min={0} step={0.5} value={form.entry_fee} onChange={v=>set('entry_fee',v)} placeholder="0 = Free" />
                    </Field>
                    <Field label="Weekly Special Day">
                      <Sel value={form.weekly_special_day} onChange={v=>set('weekly_special_day',v)} options={WEEKDAYS} />
                    </Field>
                    <Field label="Prasad Type" opt>
                      <Inp type="text" value={form.prasad_type} onChange={v=>set('prasad_type',v)} placeholder="e.g. Ladoo, Panchamrit" />
                    </Field>
                  </div>
                  <Field label="Dress Code" req err={errors.dress_code}>
                    <Inp type="text" value={form.dress_code} onChange={v=>set('dress_code',v)} placeholder="e.g. Traditional attire required, no leather" />
                  </Field>
                  <Field label="Best Time to Visit" opt>
                    <Inp type="text" value={form.best_time_to_visit} onChange={v=>set('best_time_to_visit',v)} placeholder="e.g. October to March, during Mahashivratri" />
                  </Field>
                </SectionCard>

                <SectionCard icon="📞" title="Contact & Social Media" sub="How pilgrims and devotees can reach the temple">
                  <div className="fg-2">
                    <Field label="Temple Phone"><Inp type="tel" value={form.phone} onChange={v=>set('phone',v)} placeholder="+91 XXXXX XXXXX" /></Field>
                    <Field label="WhatsApp Number" opt><Inp type="tel" value={form.whatsapp_number} onChange={v=>set('whatsapp_number',v)} placeholder="+91 XXXXX XXXXX" /></Field>
                  </div>
                  <div className="fg-2">
                    <Field label="Official Email" opt><Inp type="email" value={form.official_email} onChange={v=>set('official_email',v)} placeholder="temple@example.com" /></Field>
                    <Field label="Best Time to Call" opt><Inp type="text" value={form.best_time_to_call} onChange={v=>set('best_time_to_call',v)} placeholder="e.g. 9 AM – 1 PM" /></Field>
                  </div>
                  <div className="fg-2">
                    <Field label="Official Website" opt><Inp type="url" value={form.website_url} onChange={v=>set('website_url',v)} placeholder="https://..." /></Field>
                    <Field label="Facebook Page" opt><Inp type="url" value={form.facebook_page} onChange={v=>set('facebook_page',v)} placeholder="https://facebook.com/..." /></Field>
                  </div>
                  <div className="fg-3">
                    <Field label="YouTube Channel" opt><Inp type="url" value={form.youtube_channel} onChange={v=>set('youtube_channel',v)} placeholder="https://youtube.com/..." /></Field>
                    <Field label="Instagram Handle" opt><Inp type="text" value={form.instagram_handle} onChange={v=>set('instagram_handle',v)} placeholder="@templename" /></Field>
                    <Field label="Hero Image URL" opt><Inp type="url" value={form.hero_image_url} onChange={v=>set('hero_image_url',v)} placeholder="https://..." /></Field>
                  </div>
                </SectionCard>

                <SectionCard icon="🙏" title="Puja Offerings Available" sub="Select offered pujas, then optionally set timings">
                  <CheckGrid items={PUJAS} form={form} toggle={toggle} />
                  <div style={{ marginTop:22 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <span style={{ fontFamily:'var(--ff-h)', fontSize:13, color:'var(--inkm)', fontWeight:600 }}>Custom Puja Timings <span style={{ fontWeight:400, fontSize:11, color:'var(--inkll)' }}>(optional)</span></span>
                      <button className="add-btn" style={{ margin:0 }} onClick={addOffering}>+ Add Puja Timing</button>
                    </div>
                    {pujaOfferings.length > 0 ? (
                      <div className="offering-builder">
                        <div className="offering-hdr"><span>Puja / Seva Name</span><span>Timing (e.g. 6:00 AM)</span><span></span></div>
                        {pujaOfferings.map(o => (
                          <div className="offering-row" key={o.id}>
                            <input type="text" value={o.name} onChange={e=>setOffering(o.id,'name',e.target.value)} placeholder="e.g. Rudrabhishek" />
                            <input type="text" value={o.timing} onChange={e=>setOffering(o.id,'timing',e.target.value)} placeholder="e.g. 6:00 AM" />
                            <button className="sched-del" onClick={()=>delOffering(o.id)}>×</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding:'12px 14px', background:'var(--parch)', borderRadius:9, border:'1px dashed var(--bd1)', fontSize:12, color:'var(--inkll)', textAlign:'center' }}>
                        Click "+ Add Puja Timing" to specify timings for individual pujas
                      </div>
                    )}
                  </div>
                </SectionCard>

                <SectionCard icon="✅" title="Facilities Available" sub="Click anywhere on a box to toggle">
                  <CheckGrid items={FACILITIES} form={form} toggle={toggle} className="fac-grid" itemClass="fac-item" nameClass="fac-name" />
                  <div style={{ marginTop:10 }}>
                    <div className={`fac-item${showCustomFacility?' on':''}`} style={{ display:'inline-flex', cursor:'pointer', minWidth:200 }} onClick={()=>setShowCustomFacility(p=>!p)}>
                      <input type="checkbox" checked={showCustomFacility} onChange={()=>{}} style={{ accentColor:'var(--s2)', flexShrink:0 }} />
                      <span className="fac-name">✏️ Other / Custom Facility</span>
                    </div>
                    {showCustomFacility && (
                      <div className="custom-input-row">
                        <Inp type="text" value={customFacilityText} onChange={setCustomFacilityText} placeholder="Describe the custom facility…" />
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop:24 }}>
                    <SecLabel>Community Programs</SecLabel>
                    <CheckGrid items={PROGRAMS} form={form} toggle={toggle} className="fac-grid" itemClass="fac-item" nameClass="fac-name" />
                  </div>
                </SectionCard>

                <div className="form-nav">
                  <button className="btn-back" onClick={()=>prevStep(4)}>← Back</button>
                  <div className="step-indicator">Step 4 of 9</div>
                  <button className={`btn-next${btnShake?' shake':''}`} onClick={()=>nextStep(4)}>Next: Digital & Seva →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 5 — DIGITAL & SEVA ══ */}
            {step === 5 && (
              <div className="form-section">
                <SectionCard icon="📺" title="Digital & Live Services" sub="Online puja, live darshan and streaming">
                  <div className="fg-2">
                    <Field label="Online Puja Available">
                      <Sel value={form.online_puja_available} onChange={v=>set('online_puja_available',v)}>
                        <option value="no">No</option><option value="yes">Yes</option><option value="soon">Coming Soon</option>
                      </Sel>
                    </Field>
                    <Field label="Live Darshan Available">
                      <Sel value={form.live_darshan_available} onChange={v=>set('live_darshan_available',v)}>
                        <option value="no">No</option><option value="yes">Yes</option><option value="planning">Planning</option>
                      </Sel>
                    </Field>
                  </div>
                  <Field label="Live Stream URL" opt>
                    <Inp type="url" value={form.live_stream_url} onChange={v=>set('live_stream_url',v)} placeholder="https://youtube.com/live/..." />
                  </Field>
                </SectionCard>
                <SectionCard icon="🎬" title="Video Content" sub="Aarti, intro, and 360° videos">
                  {[
                    { icon:'🪔', label:'Aarti Video URL', key:'video_aarti_url', ph:'YouTube / Vimeo URL for Aarti video' },
                    { icon:'🎥', label:'Intro / Overview Video URL', key:'video_intro_url', ph:'YouTube / Vimeo URL for temple intro' },
                    { icon:'🔄', label:'360° Tour Video URL', key:'video_360_url', ph:'YouTube 360° URL for virtual darshan' },
                  ].map(({ icon, label, key, ph }) => (
                    <Field key={key} label={label} opt>
                      <div className="video-field">
                        <span className="video-field-icon">{icon}</span>
                        <input type="url" value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={ph} />
                      </div>
                    </Field>
                  ))}
                </SectionCard>
                <div className="form-nav">
                  <button className="btn-back" onClick={()=>prevStep(5)}>← Back</button>
                  <div className="step-indicator">Step 5 of 9</div>
                  <button className={`btn-next${btnShake?' shake':''}`} onClick={()=>nextStep(5)}>Next: Priests & Schedule →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 6 — PRIESTS & SCHEDULE ══ */}
            {step === 6 && (
              <div className="form-section">
                <SectionCard icon="👳" title="Temple Priests" sub="Priests serving at this temple — all fields required">
                  {priests.map((p, idx) => {
                    const pe = priestErrors[p.id] || {};
                    return (
                      <div className="priest-card" key={p.id} style={{ borderColor: Object.keys(pe).length ? 'var(--red)' : 'var(--bd2)' }}>
                        <div className="priest-card-hdr">
                          <div className="priest-card-title">👳 Priest #{idx+1}</div>
                          {idx > 0 && <button className="remove-priest" onClick={()=>removePriest(p.id)}>× Remove</button>}
                        </div>
                        {Object.keys(pe).length > 0 && (
                          <div className="festival-err-banner">⚠ Please fill in all required priest fields</div>
                        )}
                        <div className="fg-3">
                          <div className={`fg${pe.name ? ' has-error' : ''}`}>
                            <label className="fl">Full Name <span className="req"> ✶</span></label>
                            <input type="text" value={p.name} onChange={e=>setPriest(p.id,'name',e.target.value)} placeholder="e.g. Pandit Ram Sharma" className={pe.name ? 'priest-input-err' : ''} />
                            {pe.name && <div className="field-err">{pe.name}</div>}
                          </div>
                          <div className="fg">
                            <label className="fl">Title / Designation</label>
                            <input type="text" value={p.title} onChange={e=>setPriest(p.id,'title',e.target.value)} placeholder="e.g. Head Priest, Pujari" />
                          </div>
                          <div className={`fg${pe.phone ? ' has-error' : ''}`}>
                            <label className="fl">Phone <span className="req"> ✶</span></label>
                            <input type="tel" value={p.phone} onChange={e=>setPriest(p.id,'phone',e.target.value)} placeholder="+91 XXXXX XXXXX" className={pe.phone ? 'priest-input-err' : ''} />
                            {pe.phone && <div className="field-err">{pe.phone}</div>}
                          </div>
                        </div>
                        <div className="fg-3">
                          <div className={`fg${pe.sampradaya ? ' has-error' : ''}`}>
                            <label className="fl">Sampradaya <span className="req"> ✶</span></label>
                            <select value={p.sampradaya} onChange={e=>setPriest(p.id,'sampradaya',e.target.value)} className={pe.sampradaya ? 'priest-input-err' : ''}>
                              {SAMPRADAYAS.map(s=><option key={s} value={s}>{s||'Select'}</option>)}
                            </select>
                            {pe.sampradaya && <div className="field-err">{pe.sampradaya}</div>}
                          </div>
                          <div className={`fg${pe.appt_type ? ' has-error' : ''}`}>
                            <label className="fl">Appointment Type <span className="req"> ✶</span></label>
                            <select value={p.appt_type} onChange={e=>setPriest(p.id,'appt_type',e.target.value)} className={pe.appt_type ? 'priest-input-err' : ''}>
                              {APPT_TYPES.map(a=><option key={a} value={a}>{a||'Select'}</option>)}
                            </select>
                            {pe.appt_type && <div className="field-err">{pe.appt_type}</div>}
                          </div>
                          <div className={`fg${pe.years ? ' has-error' : ''}`}>
                            <label className="fl">Years Serving <span className="req"> ✶</span></label>
                            <input type="number" min={0} max={100} value={p.years}
                              onChange={e => {
                                const v = e.target.value;
                                if (v==='') { setPriest(p.id,'years',''); return; }
                                const n=parseInt(v,10);
                                if (!isNaN(n)&&n>=0&&n<=100) setPriest(p.id,'years',String(n));
                              }}
                              onBlur={e => {
                                const n=parseInt(e.target.value,10);
                                if (isNaN(n)||n<0) setPriest(p.id,'years','0');
                                else if (n>100) setPriest(p.id,'years','100');
                              }}
                              placeholder="e.g. 15"
                              className={pe.years ? 'priest-input-err' : ''}
                            />
                            {pe.years && <div className="field-err">{pe.years}</div>}
                          </div>
                        </div>
                        <div className={`fac-item${p.is_head?' on':''}`} style={{ display:'inline-flex', cursor:'pointer', minWidth:200 }} onClick={()=>setPriest(p.id,'is_head',!p.is_head)}>
                          <input type="checkbox" checked={p.is_head} onChange={()=>{}} style={{ accentColor:'var(--s2)', marginRight:6 }} />
                          Head / Chief Priest
                        </div>
                      </div>
                    );
                  })}
                  <button className="add-btn" onClick={addPriest}>+ Add Another Priest</button>
                </SectionCard>

                <SectionCard icon="⏰" title="Daily Puja Schedule" sub="Timings of regular pujas and aartis — Name and Time required">
                  <div className="info-banner" style={{ marginBottom:14 }}>
                    <span>🕐</span>
                    <span>Enter times in <strong>AM / PM format</strong> — e.g. <strong>5:30 AM</strong>, <strong>12:00 PM</strong>, <strong>7:30 PM</strong></span>
                  </div>
                  <div className="sched-builder">
                    <div className="sched-hdr"><span>Puja / Aarti Name ✶</span><span>Time (AM / PM) ✶</span><span>Type</span><span></span></div>
                    {scheds.map(s => {
                      const se = schedErrors[s.id] || {};
                      return (
                        <div className={`sched-row${Object.keys(se).length?' sched-err-row':''}`} key={s.id}>
                          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                            <input type="text" value={s.name} onChange={e=>setSched(s.id,'name',e.target.value)} placeholder="e.g. Mangal Aarti" className={se.name ? 'sched-err-input' : ''} />
                            {se.name && <span style={{ fontSize:10, color:'var(--red)' }}>⚠ Required</span>}
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                            <input type="text" value={s.time} onChange={e=>setSched(s.id,'time',e.target.value)} placeholder="5:30 AM" className={se.time ? 'sched-err-input' : ''} />
                            {se.time && <span style={{ fontSize:10, color:'var(--red)' }}>⚠ Required</span>}
                          </div>
                          <select value={s.type} onChange={e=>setSched(s.id,'type',e.target.value)}>
                            {['Aarti','Puja','Abhishek','Bhog','Other'].map(t=><option key={t}>{t}</option>)}
                          </select>
                          <button className="sched-del" onClick={()=>delSched(s.id)}>×</button>
                        </div>
                      );
                    })}
                  </div>
                  <button className="add-sched-btn" onClick={addSched}>+ Add Puja Row</button>
                </SectionCard>

                <SectionCard icon="🎉" title="Temple Committee" sub="Governing committee details">
                  <div className="fg-2">
                    <Field label="Chairman Name" opt>
                      <Inp type="text" value={form.chairman_name} onChange={v=>set('chairman_name',v)} placeholder="e.g. Sri Ramesh Gupta" />
                    </Field>
                    <Field label="Chairman Contact" opt>
                      <Inp type="tel" value={form.chairman_contact} onChange={v=>set('chairman_contact',v)} placeholder="+91 XXXXX XXXXX" />
                    </Field>
                  </div>
                  <div className="fg-2">
                    <Field label="Committee Member Count" opt>
                      <Inp type="number" min={1} value={form.committee_count} onChange={v=>set('committee_count',v)} placeholder="e.g. 11" />
                    </Field>
                    <Field label="Election Cycle">
                      <Sel value={form.election_cycle} onChange={v=>set('election_cycle',v)}>
                        <option value="">Select</option>
                        <option value="Annual">Annual</option>
                        <option value="Every 2 years">Every 2 years</option>
                        <option value="Every 3 years">Every 3 years</option>
                        <option value="Permanent / No election">Permanent / No election</option>
                        <option value="Government appointed">Government appointed</option>
                        <option value="__custom__">✏️ Custom…</option>
                      </Sel>
                      {isCustomCycle && (
                        <div className="custom-input-row">
                          <Inp type="text" value={form.election_cycle_custom} onChange={v=>set('election_cycle_custom',v)} placeholder="Enter custom election cycle…" />
                        </div>
                      )}
                    </Field>
                  </div>
                </SectionCard>

                <div className="form-nav">
                  <button className="btn-back" onClick={()=>prevStep(6)}>← Back</button>
                  <div className="step-indicator">Step 6 of 9</div>
                  <button className={`btn-next${btnShake?' shake':''}`} onClick={()=>nextStep(6)}>Next: Media →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 7 — MEDIA ══ */}
            {step === 7 && (
              <div className="form-section">
                <SectionCard icon="🖼️" title="Temple Photos" sub="Upload photos for the temple gallery">
                  <div className="info-banner">
                    <span>ℹ️</span>
                    <span>First photo will be set as the <strong>hero/cover image</strong>. Upload high-quality JPG or PNG photos (max 10MB each).</span>
                  </div>
                  <div className="photo-grid">
                    {photos.map((url, idx) => (
                      <div key={idx} className={`photo-slot${url?' has-img':''}`}>
                        {url ? (
                          <>
                            <div className="ps-preview" style={{ background:`url(${url}) center/cover` }} />
                            <button className="ps-remove" onClick={()=>removePhoto(idx)}>×</button>
                          </>
                        ) : (
                          <>
                            <div className="ps-icon">📸</div>
                            <div className="ps-label">{idx===0 ? 'Hero Image' : `Gallery Photo ${idx+1}`}</div>
                            {idx===0 && <div className="ps-req">Required</div>}
                            <input type="file" accept="image/*" style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }} onChange={e=>handlePhotoChange(e,idx)} />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="field-hint" style={{ marginTop:10 }}>Accepted: JPG, PNG, WebP · Max 10MB per photo</div>
                </SectionCard>

                <SectionCard icon="🎵" title="Mantras" sub="Add mantras associated with this temple's deity">
                  {mantras.map((m, idx) => (
                    <div className="sub-card" key={m.id}>
                      {idx > 0 && <button className="remove-priest" style={{ position:'absolute', top:10, right:12 }} onClick={()=>removeMantra(m.id)}>× Remove</button>}
                      <div className="fg-2">
                        <Field label="Mantra Title"><Inp type="text" value={m.title} onChange={v=>setMantra(m.id,'title',v)} placeholder="e.g. Maha Mrityunjaya Mantra" /></Field>
                        <Field label="Deity"><Inp type="text" value={m.deity} onChange={v=>setMantra(m.id,'deity',v)} placeholder="e.g. Lord Shiva" /></Field>
                      </div>
                      <Field label="Sanskrit Text"><Txt value={m.sanskrit} onChange={v=>setMantra(m.id,'sanskrit',v)} rows={2} placeholder="ॐ त्र्यम्बकं यजामहे…" /></Field>
                      <Field label="Transliteration"><Inp type="text" value={m.transliteration} onChange={v=>setMantra(m.id,'transliteration',v)} placeholder="Om Tryambakam Yajamahe…" /></Field>
                      <Field label="Meaning / Benefits"><Txt value={m.meaning} onChange={v=>setMantra(m.id,'meaning',v)} rows={2} placeholder="Meaning and spiritual benefits…" /></Field>
                      <Field label="Audio URL" opt><Inp type="url" value={m.audio} onChange={v=>setMantra(m.id,'audio',v)} placeholder="https://...mp3" /></Field>
                    </div>
                  ))}
                  <button className="add-btn" onClick={addMantra}>+ Add Another Mantra</button>
                </SectionCard>

                <SectionCard icon="🎊" title="Festivals" sub="Major festivals celebrated at this temple — Name, Month, Description and Duration are required">
                  {festivals.map((f, idx) => {
                    const fe = festivalErrors[f.id] || {};
                    return (
                      <div className="sub-card" key={f.id} style={{ borderColor: Object.keys(fe).length ? 'var(--red)' : 'var(--bd2)' }}>
                        {idx > 0 && <button className="remove-priest" style={{ position:'absolute', top:10, right:12 }} onClick={()=>removeFest(f.id)}>× Remove</button>}
                        {Object.keys(fe).length > 0 && (
                          <div className="festival-err-banner">⚠ Please fill in all required festival fields</div>
                        )}
                        <div className="fg-3">
                          <div className={`fg${fe.name ? ' has-error' : ''}`}>
                            <label className="fl">Festival Name <span className="req"> ✶</span></label>
                            <input type="text" value={f.name} onChange={e=>setFest(f.id,'name',e.target.value)} placeholder="e.g. Mahashivratri" />
                            {fe.name && <div className="field-err">{fe.name}</div>}
                          </div>
                          <Field label="Hindu Month" opt>
                            <Inp type="text" value={f.hmonth} onChange={v=>setFest(f.id,'hmonth',v)} placeholder="e.g. Phalguna" />
                          </Field>
                          <div className={`fg${fe.month ? ' has-error' : ''}`}>
                            <label className="fl">Calendar Month <span className="req"> ✶</span></label>
                            <select value={f.month} onChange={e=>setFest(f.id,'month',e.target.value)}>
                              <option value="">Select</option>
                              {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
                            </select>
                            {fe.month && <div className="field-err">{fe.month}</div>}
                          </div>
                        </div>
                        <div className="fg-2">
                          <div className={`fg${fe.desc ? ' has-error' : ''}`}>
                            <label className="fl">Description <span className="req"> ✶</span></label>
                            <textarea rows={2} value={f.desc} onChange={e=>setFest(f.id,'desc',e.target.value)} placeholder="How is this festival celebrated here?" />
                            {fe.desc && <div className="field-err">{fe.desc}</div>}
                          </div>
                          <div>
                            <div className={`fg${fe.days ? ' has-error' : ''}`}>
                              <label className="fl">Duration (days) <span className="req"> ✶</span></label>
                              <input type="number" min={1} value={f.days} onChange={e=>setFest(f.id,'days',e.target.value)} placeholder="e.g. 3" />
                              {fe.days && <div className="field-err">{fe.days}</div>}
                            </div>
                            <div className={`festival-major-row${f.major?' on':''}`} onClick={()=>setFest(f.id,'major',!f.major)}>
                              <input type="checkbox" checked={f.major} onChange={()=>{}} style={{ accentColor:'var(--s2)' }} />
                              <span style={{ fontSize:13, color:'var(--inkm)', fontWeight:f.major?600:400 }}>⭐ Mark as Major Festival</span>
                              {f.major && <span style={{ marginLeft:'auto', fontSize:11, color:'var(--s2)', fontWeight:600, background:'var(--slm)', padding:'2px 8px', borderRadius:20 }}>MAJOR ✓</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button className="add-btn" onClick={addFest}>+ Add Another Festival</button>
                </SectionCard>

                <div className="form-nav">
                  <button className="btn-back" onClick={()=>prevStep(7)}>← Back</button>
                  <div className="step-indicator">Step 7 of 9</div>
                  <button className={`btn-next${btnShake?' shake':''}`} onClick={()=>nextStep(7)}>Next: Donations →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 8 — DONATIONS ══ */}
            {step === 8 && (
              <div className="form-section">
                <SectionCard icon="💰" title="Online Donations" sub="Payment details for accepting donations">
                  <div className="warn-banner">
                    <span>⚠️</span>
                    <span><strong>Security Notice:</strong> Bank account number will be encrypted in production. Ensure HTTPS is enabled before collecting banking data.</span>
                  </div>
                  <div className={`fac-item${form.accept_online_donations?' on':''}`} style={{ display:'inline-flex', cursor:'pointer', minWidth:300 }} onClick={()=>set('accept_online_donations',!form.accept_online_donations)}>
                    <input type="checkbox" checked={form.accept_online_donations} onChange={()=>{}} style={{ accentColor:'var(--s2)', marginRight:6 }} />
                    ✅ &nbsp; This temple accepts online donations
                  </div>
                  {form.accept_online_donations && (
                    <div style={{ marginTop:16 }}>
                      <div className="fg-2">
                        <Field label="UPI ID" opt><Inp type="text" value={form.upi_id} onChange={v=>set('upi_id',v)} placeholder="e.g. temple@upi" /></Field>
                        <Field label="80G Certificate No." opt><Inp type="text" value={form.certificate_80g_no} onChange={v=>set('certificate_80g_no',v)} placeholder="e.g. AAACT1234C2024001" /></Field>
                      </div>
                      <SecLabel>Bank Details</SecLabel>
                      <div className="fg-2">
                        <Field label="Account Holder Name"><Inp type="text" value={form.bank_account_name} onChange={v=>set('bank_account_name',v)} placeholder="e.g. Shri Mahakaleshwar Temple Trust" /></Field>
                        <Field label="Bank & Branch Name"><Inp type="text" value={form.bank_name_branch} onChange={v=>set('bank_name_branch',v)} placeholder="e.g. SBI, Ujjain Main Branch" /></Field>
                      </div>
                      <div className="fg-2">
                        <Field label="Account Number"><Inp type="text" value={form.bank_account_number} onChange={v=>set('bank_account_number',v)} placeholder="XXXXXXXXXXXX" /></Field>
                        <Field label="IFSC Code"><Inp type="text" value={form.bank_ifsc} onChange={v=>set('bank_ifsc',v)} placeholder="e.g. SBIN0001234" maxLength={11} /></Field>
                      </div>
                      <SecLabel>Donation Categories</SecLabel>
                      <div className="donation-box">
                        <div className="donation-box-title">📋 What can devotees donate for?</div>
                        <CheckGrid items={DONATION_CATS} form={form} toggle={toggle} className="fac-grid" itemClass="fac-item" nameClass="fac-name" />
                      </div>
                    </div>
                  )}
                </SectionCard>
                <div className="form-nav">
                  <button className="btn-back" onClick={()=>prevStep(8)}>← Back</button>
                  <div className="step-indicator">Step 8 of 9</div>
                  <button className={`btn-next${btnShake?' shake':''}`} onClick={()=>nextStep(8)}>Review & Submit →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 9 — REVIEW & SUBMIT ══ */}
            {step === 9 && (
              <div className="form-section">
                <div className="review-card">
                  <div className="review-card-title">🕉️ Review Before Submitting</div>
                  <div className="summary-grid">
                    {summaryItems.map(([label, val]) => (
                      <div key={label} className="s-item">
                        <div className="si-l">{label}</div>
                        <div className={`si-v${val==='—'?' empty':''}`}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <SectionCard icon="✍️" title="Admin Confirmation" sub="All fields are required to submit">
                  <div className="fg-3">
                    <Field label="Submitted By" req err={errors.submitter_name}>
                      <Inp type="text" value={form.submitter_name} onChange={v=>set('submitter_name',v)} placeholder="Admin name" />
                    </Field>
                    <Field label="Role">
                      <Sel value={form.submitter_role} onChange={v=>set('submitter_role',v)}>
                        {ROLES.map(r=><option key={r} value={r}>{r.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                      </Sel>
                    </Field>
                    <Field label="Contact Phone" req err={errors.submitter_phone}>
                      <Inp type="tel" value={form.submitter_phone} onChange={v=>set('submitter_phone',v)} placeholder="+91 XXXXX XXXXX" />
                    </Field>
                  </div>
                  <Field label="Contact Email" req err={errors.submitter_email}>
                    <Inp type="email" value={form.submitter_email} onChange={v=>set('submitter_email',v)} placeholder="admin@example.com" />
                  </Field>
                  <div style={{ marginTop:12 }}>
                    <div className="consent-title">Consent & Compliance</div>
                    {[
                      "I confirm I am authorised to submit this temple's information to BharatMandir.",
                      'All information provided is accurate and verified to the best of my knowledge.',
                      'I grant BharatMandir permission to publish this temple\'s profile publicly.',
                      'The temple agrees to comply with BharatMandir\'s listing guidelines and bylaws.',
                      'Donation and financial information disclosed will be maintained transparently.',
                    ].map((text, i) => (
                      <label key={i} className="consent-check" onClick={()=>toggleConsent(i)}>
                        <input type="checkbox" checked={consents[i]} onChange={()=>{}} style={{ accentColor:'var(--s2)' }} />
                        {text}
                      </label>
                    ))}
                    {!allConsents && (
                      <div style={{ fontSize:12, color:'var(--inkll)', marginTop:8, fontStyle:'italic' }}>
                        ☝️ Please check all consent boxes above to enable submission.
                      </div>
                    )}
                  </div>
                </SectionCard>

                <div className="form-nav">
                  <button className="btn-back" onClick={()=>prevStep(9)}>← Back</button>
                  <div className="step-indicator">Step 9 of 9</div>
                  <button className={`btn-submit${btnShake?' shake':''}`} disabled={!allConsents} onClick={submitForm}>
                    🕉️ Save Temple to BharatMandir
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </>
  );
}