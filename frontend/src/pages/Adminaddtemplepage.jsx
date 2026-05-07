import { useState, useRef, useEffect, Fragment } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────
const SECTS = ['','Shaiva','Vaishnava','Shakta','Smartha','Jain','Buddhist','Sikh','Other'];
const TYPES = ['','Temple','Mandir','Devasthan','Peeth','Mutt','Shrine','Other'];
const MANAGING_AUTHORITIES = ['','Private / Family Trust','Community / Village Trust','State Govt Endowment Board','Archaeological Survey of India (ASI)'];
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
const ELECTION_CYCLES = ['','Annual','Every 2 years','Every 3 years','Permanent / No election','Government appointed'];
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
  { key:'prog_womens_selfhelp', label:'👩 Women\'s Self-Help' },
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

// ── Helper: initial form state ────────────────────────────────────────────────
function initialForm() {
  const bools = [...DESIGNATIONS.map(d=>d.key), ...PUJAS.map(p=>p.key), ...FACILITIES.map(f=>f.key), ...PROGRAMS.map(p=>p.key), ...DONATION_CATS.map(d=>d.key)];
  const base = {
    name:'', name_hindi:'', name_local:'', temple_type:'', sect:'', managing_authority:'',
    trust_name:'', trust_registration_no:'', primary_deity:'', secondary_deities:'',
    category_tags:'', google_place_id:'', wikidata_id:'', osm_id:'', wikipedia_url:'',
    status:'draft', source:'manual',
    address:'', city:'', district:'', pincode:'', state:'', setting_environment:'',
    latitude:'', longitude:'', google_maps_link:'', nearest_railway:'', nearest_airport:'',
    nearest_bus_stand:'', local_landmark:'',
    history:'', history_hindi:'', sthala_purana:'', significance:'', puranic_stories:'',
    architecture_style:'', estimated_year_built:'', founded_by:'', last_renovation_year:'',
    building_condition:'',
    opening_time:'', closing_time:'', afternoon_closure_start:'', afternoon_closure_end:'',
    entry_fee:'', weekly_special_day:'None / All days equal', prasad_type:'', dress_code:'',
    best_time_to_visit:'', phone:'', whatsapp_number:'', official_email:'', best_time_to_call:'',
    website_url:'', facebook_page:'', youtube_channel:'', instagram_handle:'', hero_image_url:'',
    online_puja_available:'no', live_darshan_available:'no', live_stream_url:'',
    video_aarti_url:'', video_intro_url:'', video_360_url:'',
    chairman_name:'', chairman_contact:'', committee_count:'', election_cycle:'',
    accept_online_donations:false, upi_id:'', certificate_80g_no:'',
    bank_account_name:'', bank_name_branch:'', bank_account_number:'', bank_ifsc:'',
    submitter_name:'', submitter_role:'admin', submitter_phone:'',
  };
  bools.forEach(k => base[k] = false);
  return base;
}

function initPriest() {
  return { name:'', title:'', phone:'', sampradaya:'', appt_type:'', years:'', is_head:false, id: Math.random().toString(36).slice(2) };
}
function initSched() {
  return { name:'', time:'', type:'Aarti', id: Math.random().toString(36).slice(2) };
}
function initMantra() {
  return { title:'', deity:'', sanskrit:'', transliteration:'', meaning:'', audio:'', id: Math.random().toString(36).slice(2) };
}
function initFestival() {
  return { name:'', hmonth:'', month:'', desc:'', days:'', major:false, id: Math.random().toString(36).slice(2) };
}

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
  --sh1:0 1px 12px rgba(100,50,10,.07);
  --sh2:0 4px 28px rgba(100,50,10,.11);
  --ff-h:'Cinzel',Georgia,serif;
  --ff-b:'Crimson Pro',Georgia,serif;
  --ff-u:'DM Sans',system-ui,sans-serif;
  --ff-hi:'Noto Sans Devanagari',sans-serif;
}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{font-family:var(--ff-u);background:var(--cream);color:var(--ink);-webkit-font-smoothing:antialiased;}

/* TICKER */
.ticker{background:var(--ink);padding:7px 0;overflow:hidden;position:relative;}
.ticker::before,.ticker::after{content:'';position:absolute;top:0;bottom:0;width:60px;z-index:2;}
.ticker::before{left:0;background:linear-gradient(90deg,var(--ink),transparent);}
.ticker::after{right:0;background:linear-gradient(270deg,var(--ink),transparent);}
.ticker-t{display:flex;align-items:center;width:max-content;animation:tick 30s linear infinite;}
@keyframes tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.tm{font-family:var(--ff-b);font-style:italic;font-size:12px;color:#D4A828;letter-spacing:.14em;text-transform:uppercase;padding:0 6px;white-space:nowrap;}
.tm.h{color:rgba(212,168,40,.55);font-family:var(--ff-hi);font-style:normal;letter-spacing:.04em;text-transform:none;}
.ts{color:rgba(212,168,40,.3);padding:0 10px;font-size:12px;}
.sacred-line{height:3px;background:linear-gradient(90deg,var(--s1),var(--s2) 25%,var(--g3) 50%,var(--s2) 75%,var(--s1));}

/* HEADER */
.hdr{background:rgba(253,250,243,.97);backdrop-filter:blur(20px);border-bottom:1px solid var(--bd2);box-shadow:var(--sh1);position:sticky;top:0;z-index:200;}
.hdr-w{max-width:1100px;margin:0 auto;padding:0 32px;height:60px;display:flex;align-items:center;justify-content:space-between;}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;}
.logo-d{font-size:20px;animation:diya 3s ease-in-out infinite;}
@keyframes diya{0%,100%{filter:drop-shadow(0 0 4px rgba(212,96,10,.3));}50%{filter:drop-shadow(0 0 11px rgba(212,96,10,.7));}}
.logo-n{font-family:var(--ff-h);font-size:18px;font-weight:700;color:var(--ink);}
.logo-n b{color:var(--s2);}
.logo-s{font-size:10px;color:var(--inkll);letter-spacing:.03em;margin-top:1px;}
.admin-badge{background:linear-gradient(135deg,var(--s1),var(--g2));color:#fff;font-family:var(--ff-h);font-size:10px;letter-spacing:.1em;padding:4px 12px;border-radius:50px;}

/* HERO */
.hero{background:linear-gradient(180deg,rgba(24,15,6,.93) 0%,rgba(184,77,0,.72) 55%,rgba(253,250,243,1) 100%),url('https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Mahakaleshwar_Temple_Ujjain.jpg/1280px-Mahakaleshwar_Temple_Ujjain.jpg') center/cover no-repeat;padding:52px 24px 70px;text-align:center;position:relative;overflow:hidden;}
.hero-om{position:absolute;font-size:280px;color:rgba(255,255,255,.035);font-family:var(--ff-hi);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;line-height:1;animation:pom 8s ease-in-out infinite;}
@keyframes pom{0%,100%{opacity:.035;transform:translate(-50%,-50%) scale(1);}50%{opacity:.07;transform:translate(-50%,-50%) scale(1.04);}}
.hero-inner{position:relative;z-index:1;}
.hero-chip{display:inline-flex;align-items:center;gap:7px;background:rgba(200,150,12,.18);border:1px solid rgba(240,192,64,.35);backdrop-filter:blur(8px);color:#F0C040;padding:5px 18px;border-radius:50px;font-family:var(--ff-h);font-size:11px;letter-spacing:.12em;margin-bottom:16px;}
.hero h1{font-family:var(--ff-h);font-weight:900;color:#fff;font-size:clamp(28px,4.5vw,50px);line-height:1.1;margin-bottom:10px;text-shadow:0 2px 20px rgba(0,0,0,.4);}
.hero h1 span{color:#F0C040;}
.hero p{font-family:var(--ff-b);font-size:16px;color:rgba(255,255,255,.72);}

/* PROGRESS */
.progress-wrap{background:var(--white);border-bottom:2px solid var(--bd2);position:sticky;top:60px;z-index:100;box-shadow:0 2px 8px rgba(100,50,10,.07);}
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

/* LAYOUT */
.page{max-width:900px;margin:0 auto;padding:36px 24px 80px;}

/* SECTION CARD */
.fsec{background:var(--white);border:1px solid var(--bd2);border-radius:16px;padding:26px 30px;margin-bottom:18px;box-shadow:var(--sh1);}
.fsec-hdr{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--bd3);}
.fsec-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;background:var(--sl);}
.fsec-title{font-family:var(--ff-h);font-size:16px;font-weight:700;color:var(--ink);}
.fsec-sub{font-size:11.5px;color:var(--inkl);margin-top:2px;}

/* FORM FIELDS */
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
  outline:none;transition:border-color .18s,background .18s;appearance:none;-webkit-appearance:none;
}
input:focus,select:focus,textarea:focus{border-color:var(--s2);background:var(--white);box-shadow:0 0 0 3px rgba(212,96,10,.08);}
input::placeholder,textarea::placeholder{color:var(--inkx);}
textarea{resize:vertical;min-height:90px;line-height:1.65;}
select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23B09070' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center;padding-right:30px;}
.field-hint{font-size:11px;color:var(--inkll);margin-top:4px;font-style:italic;}
.field-err{font-size:11px;color:var(--red);margin-top:4px;}

/* CHIP TOGGLE */
.chip-group{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;}
.chip{padding:7px 15px;border-radius:50px;border:1.5px solid var(--bd2);background:var(--white);font-family:var(--ff-u);font-size:12.5px;color:var(--inkm);cursor:pointer;transition:all .15s;user-select:none;}
.chip:hover{border-color:var(--s3);color:var(--s2);}
.chip.on{border-color:var(--s2);background:var(--sl);color:var(--s1);font-weight:500;}

/* PUJA / FACILITY GRID */
.puja-grid,.fac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:8px;}
.fac-grid{grid-template-columns:repeat(auto-fill,minmax(185px,1fr));}
.puja-item,.fac-item{border:1.5px solid var(--bd2);border-radius:9px;padding:9px 12px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:8px;}
.puja-item:hover,.fac-item:hover{border-color:var(--s2);background:var(--sl);}
.puja-item.on,.fac-item.on{border-color:var(--s2);background:var(--sl);}
.puja-name,.fac-name{font-size:12.5px;color:var(--inkm);}

/* SCHEDULE BUILDER */
.sched-builder{border:1px solid var(--bd2);border-radius:10px;overflow:hidden;}
.sched-hdr{background:var(--parch);padding:10px 14px;font-size:10.5px;font-weight:500;color:var(--inkl);text-transform:uppercase;letter-spacing:.06em;display:grid;grid-template-columns:1fr 115px 100px 34px;gap:10px;}
.sched-row{display:grid;grid-template-columns:1fr 115px 100px 34px;gap:10px;padding:8px 14px;border-top:1px solid var(--bd3);align-items:center;}
.sched-row input,.sched-row select{padding:6px 10px;border-radius:7px;font-size:12px;}
.sched-del{width:28px;height:28px;border:1px solid var(--bd2);border-radius:7px;background:var(--white);color:var(--red);cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
.sched-del:hover{background:var(--redl);border-color:var(--red);}
.add-sched-btn,.add-btn{padding:8px 16px;border:1px dashed var(--bd1);border-radius:8px;background:transparent;font-size:12px;color:var(--inkl);cursor:pointer;transition:all .15s;margin-top:8px;display:flex;align-items:center;gap:6px;}
.add-sched-btn:hover,.add-btn:hover{border-color:var(--s2);color:var(--s2);}

/* PRIEST CARD */
.priest-card{border:1.5px solid var(--bd2);border-radius:12px;padding:16px 18px;margin-bottom:12px;position:relative;background:var(--parch);}
.priest-card-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.priest-card-title{font-family:var(--ff-h);font-size:13px;color:var(--inkm);}
.remove-priest{border:1px solid var(--bd2);border-radius:7px;background:var(--white);color:var(--red);cursor:pointer;font-size:12px;padding:4px 10px;}
.remove-priest:hover{background:var(--redl);}

/* PHOTO UPLOAD */
.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:12px;}
.photo-slot{aspect-ratio:1;border:2px dashed var(--bd1);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;background:var(--parch);position:relative;overflow:hidden;}
.photo-slot:hover{border-color:var(--s2);background:var(--sl);}
.photo-slot.has-img{border-style:solid;border-color:var(--bd1);}
.ps-icon{font-size:22px;margin-bottom:5px;opacity:.45;}
.ps-label{font-size:10px;color:var(--inkll);text-align:center;line-height:1.4;padding:0 8px;}
.ps-req{font-size:9px;color:var(--s2);font-weight:500;margin-top:3px;}
.ps-preview{position:absolute;inset:0;background-size:cover!important;background-position:center!important;}
.ps-remove{position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:50%;background:rgba(185,28,28,.8);color:#fff;border:none;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;}

/* VIDEO FIELD */
.video-field{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid var(--bd2);border-radius:9px;background:var(--parch);}
.video-field-icon{font-size:18px;flex-shrink:0;}
.video-field input{border:none;background:transparent;padding:0;font-size:13px;flex:1;}
.video-field input:focus{box-shadow:none;border:none;}

/* DONATION BOX */
.donation-box{background:var(--gl);border:1.5px solid #e0cc8a;border-radius:12px;padding:18px 20px;margin-bottom:14px;}
.donation-box-title{font-family:var(--ff-h);font-size:13px;color:var(--g1);margin-bottom:12px;display:flex;align-items:center;gap:8px;}

/* SUMMARY */
.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
.s-item{background:rgba(255,255,255,.08);border-radius:9px;padding:10px 13px;}
.si-l{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.5);margin-bottom:3px;}
.si-v{font-size:12.5px;font-weight:500;color:#fff;}
.si-v.empty{color:rgba(255,255,255,.4);font-style:italic;font-weight:400;}

/* REVIEW CARD */
.review-card{background:linear-gradient(135deg,rgba(24,15,6,.96),rgba(107,58,16,.94));border-radius:16px;padding:26px 30px;color:#fff;margin-bottom:18px;}
.review-card-title{font-family:var(--ff-h);font-size:15px;letter-spacing:.06em;color:#F0C040;margin-bottom:18px;display:flex;align-items:center;gap:8px;}

/* CONSENT */
.consent-box{background:var(--parch);border:1px solid var(--bd2);border-radius:12px;padding:18px 20px;}
.consent-title{font-family:var(--ff-h);font-size:15px;font-weight:700;color:var(--ink);margin-bottom:10px;}
.consent-check{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--inkm);line-height:1.55;margin-bottom:8px;cursor:pointer;}
.consent-check input{accent-color:var(--s2);width:14px;height:14px;flex-shrink:0;margin-top:3px;}

/* NAV BUTTONS */
.form-nav{display:flex;align-items:center;justify-content:space-between;margin-top:22px;gap:12px;flex-wrap:wrap;}
.step-indicator{font-size:12px;color:var(--inkl);}
.btn-back{padding:11px 22px;border:1.5px solid var(--bd1);border-radius:9px;font-size:13px;color:var(--inkm);background:var(--white);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:6px;}
.btn-back:hover{border-color:var(--s2);color:var(--s2);}
.btn-next{padding:11px 28px;background:var(--s2);color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;box-shadow:0 3px 12px rgba(212,96,10,.28);display:flex;align-items:center;gap:6px;}
.btn-next:hover{background:var(--s1);transform:translateY(-1px);}
.btn-submit{padding:12px 32px;background:var(--green);color:#fff;border:none;border-radius:9px;font-size:13.5px;font-weight:500;cursor:pointer;transition:all .2s;box-shadow:0 3px 12px rgba(26,92,48,.28);display:flex;align-items:center;gap:7px;}
.btn-submit:hover:not(:disabled){background:#145A25;transform:translateY(-1px);}
.btn-submit:disabled{opacity:.6;cursor:not-allowed;}

/* SUCCESS */
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

/* SECTION LABEL */
.sec-label{font-family:var(--ff-h);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--s2);margin-bottom:12px;margin-top:22px;display:flex;align-items:center;gap:8px;}
.sec-label::after{content:'';flex:1;height:1px;background:var(--bd3);}
.sec-label:first-child{margin-top:0;}

/* RADIO GROUP */
.radio-group{display:flex;flex-wrap:wrap;gap:8px;}
.radio-opt{display:flex;align-items:center;gap:6px;padding:7px 13px;border:1.5px solid var(--bd2);border-radius:9px;cursor:pointer;font-size:12.5px;color:var(--inkm);transition:all .15s;user-select:none;}
.radio-opt:hover{border-color:var(--s2);color:var(--s2);background:var(--sl);}
.radio-opt.selected{border-color:var(--s2);background:var(--sl);color:var(--s2);}
.radio-opt input{accent-color:var(--s2);width:13px;height:13px;flex-shrink:0;}

/* BANNERS */
.info-banner{background:var(--bluel);border:1px solid #93C5FD;border-radius:9px;padding:11px 15px;font-size:12.5px;color:#1e40af;display:flex;align-items:flex-start;gap:9px;margin-bottom:14px;}
.warn-banner{background:#FEF9C3;border:1px solid #FDE047;border-radius:9px;padding:11px 15px;font-size:12.5px;color:#713f12;display:flex;align-items:flex-start;gap:9px;margin-bottom:14px;}

/* MANTRA / FESTIVAL CARDS */
.sub-card{border:1.5px solid var(--bd2);border-radius:10px;padding:14px 16px;margin-bottom:10px;position:relative;}

@keyframes fadein{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.form-section{animation:fadein .32s ease;}

@media(max-width:700px){
  .fg-2,.fg-3,.fg-4{grid-template-columns:1fr;}
  .page{padding:24px 14px 60px;}
  .fsec{padding:18px 16px;}
  .summary-grid{grid-template-columns:1fr 1fr;}
  .hdr-w{padding:0 16px;}
  .sched-hdr,.sched-row{grid-template-columns:1fr 90px 80px 32px;font-size:11px;}
  .form-nav{gap:8px;}
}
`;

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ icon, title, sub, children }) {
  return (
    <div className="fsec">
      <div className="fsec-hdr">
        <div className="fsec-icon">{icon}</div>
        <div><div className="fsec-title">{title}</div>{sub && <div className="fsec-sub">{sub}</div>}</div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, req, opt, hint, err, children }) {
  return (
    <div className="fg">
      {label && <label className="fl">{label}{req && <span className="req"> ✶</span>}{opt && <span className="opt"> (optional)</span>}</label>}
      {children}
      {hint && <div className="field-hint">{hint}</div>}
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
        <label key={key} className={`${itemClass}${form[key] ? ' on' : ''}`} onClick={() => toggle(key)}>
          <input type="checkbox" checked={form[key]} onChange={() => {}} style={{ accentColor: 'var(--s2)', flexShrink: 0 }} />
          <span className={nameClass}>{label}</span>
        </label>
      ))}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function AdminAddTemplePage() {
  const [form, setForm]     = useState(initialForm());
  const [step, setStep]     = useState(1);
  const [errors, setErrors] = useState({});
  const [priests, setPriests]   = useState([initPriest()]);
  const [scheds, setScheds]     = useState([initSched(), initSched()]);
  const [mantras, setMantras]   = useState([initMantra()]);
  const [festivals, setFestivs] = useState([initFestival()]);
  const [photos, setPhotos]     = useState(Array(6).fill(null));
  const [consents, setConsents] = useState([false,false,false,false,false]);
  const [archStyle, setArchStyle] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [qrId, setQrId]         = useState('');
  const progressRef = useRef(null);

  const set    = (k, v) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(p => ({ ...p, [k]: undefined })); };
  const toggle = k       => setForm(p => ({ ...p, [k]: !p[k] }));

  function validate(s) {
    const e = {};
    if (s === 1) {
      if (!form.name.trim())         e.name = 'Temple name is required';
      if (!form.primary_deity.trim()) e.primary_deity = 'Primary deity is required';
    }
    if (s === 2) {
      if (!form.address.trim()) e.address = 'Address is required';
      if (!form.city.trim())    e.city    = 'City is required';
      if (!form.state)          e.state   = 'State is required';
      if (form.latitude  && isNaN(parseFloat(form.latitude)))  e.latitude  = 'Invalid latitude';
      if (form.longitude && isNaN(parseFloat(form.longitude))) e.longitude = 'Invalid longitude';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function nextStep(from) {
    if (!validate(from)) return;
    const next = from + 1;
    setStep(next);
    setTimeout(() => progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
  function prevStep(from) { setStep(from - 1); }
  function goStep(n) { if (n <= step) setStep(n); }

  function handlePhotoChange(e, idx) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotos(prev => { const a = [...prev]; a[idx] = url; return a; });
  }
  function removePhoto(idx) { setPhotos(prev => { const a=[...prev]; a[idx]=null; return a; }); }

  // Priests
  const addPriest    = () => setPriests(p => [...p, initPriest()]);
  const removePriest = id => setPriests(p => p.filter(x => x.id !== id));
  const setPriest    = (id, k, v) => setPriests(p => p.map(x => x.id===id ? {...x,[k]:v} : x));

  // Schedule
  const addSched    = () => setScheds(p => [...p, initSched()]);
  const delSched    = id => setScheds(p => p.length > 1 ? p.filter(x=>x.id!==id) : p);
  const setSched    = (id,k,v) => setScheds(p => p.map(x => x.id===id ? {...x,[k]:v} : x));

  // Mantras
  const addMantra    = () => setMantras(p => [...p, initMantra()]);
  const removeMantra = id => setMantras(p => p.filter(x=>x.id!==id));
  const setMantra    = (id,k,v) => setMantras(p => p.map(x=>x.id===id ? {...x,[k]:v} : x));

  // Festivals
  const addFest    = () => setFestivs(p => [...p, initFestival()]);
  const removeFest = id => setFestivs(p => p.filter(x=>x.id!==id));
  const setFest    = (id,k,v) => setFestivs(p => p.map(x=>x.id===id ? {...x,[k]:v} : x));

  function submitForm() {
    const stateAbbr = (form.state || 'XX').substring(0,2).toUpperCase();
    const rand = Math.floor(Math.random() * 9000 + 1000);
    setQrId(`MKT-${stateAbbr}-${rand}`);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const allConsents = consents.every(Boolean);
  const toggleConsent = i => setConsents(c => { const a=[...c]; a[i]=!a[i]; return a; });

  // ── SUMMARY DATA ──────────────────────────────────────────────────────────
  const summaryItems = [
    ['Temple Name',    form.name || '—'],
    ['Name (Hindi)',   form.name_hindi || '—'],
    ['City',          form.city || '—'],
    ['State',         form.state || '—'],
    ['Primary Deity', form.primary_deity || '—'],
    ['Temple Type',   form.temple_type || '—'],
    ['Sect',          form.sect || '—'],
    ['Managing Auth', form.managing_authority || '—'],
    ['Architecture',  archStyle || '—'],
    ['GPS',           form.latitude ? `${form.latitude}, ${form.longitude}` : '—'],
    ['Status',        form.status || '—'],
    ['Online Puja',   form.online_puja_available],
    ['Live Darshan',  form.live_darshan_available],
    ['Weekly Special',form.weekly_special_day || '—'],
    ['Opening Time',  form.opening_time || '—'],
    ['Entry Fee',     form.entry_fee ? `₹${form.entry_fee}` : '—'],
    ['Donations',     form.accept_online_donations ? 'Yes' : 'No'],
    ['Source',        form.source || '—'],
  ];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>

      {/* TICKER */}
      <div className="ticker">
        <div className="ticker-t">
          {['OM NAMAH SHIVAYA','ॐ नमः शिवाय','JAI SHRI RAM','जय श्री राम','HARE KRISHNA','हरे कृष्ण हरे राम','BHARAT MANDIR','भारत मंदिर',
            'OM NAMAH SHIVAYA','ॐ नमः शिवाय','JAI SHRI RAM','जय श्री राम','HARE KRISHNA','हरे कृष्ण हरे राम','BHARAT MANDIR','भारत मंदिर'].map((t,i) => (
            <span key={i} className={`tm${/[\u0900-\u097F]/.test(t) ? ' h' : ''}`}>{t}</span>
          ))}
        </div>
      </div>
      <div className="sacred-line" />

      {/* HEADER */}
      <header className="hdr">
        <div className="hdr-w">
          <a className="logo" href="#">
            <span className="logo-d">🪔</span>
            <div>
              <div className="logo-n">Bharat<b>Mandir</b></div>
              <div className="logo-s">Sacred Temples of India</div>
            </div>
          </a>
          <div className="admin-badge">ADMIN PANEL</div>
        </div>
      </header>

      {/* HERO */}
      <div className="hero">
        <div className="hero-om">ॐ</div>
        <div className="hero-inner">
          <div className="hero-chip">🕉️ &nbsp; ADD NEW TEMPLE</div>
          <h1>Register a <span>Sacred Temple</span></h1>
          <p>Complete all sections to add the temple to BharatMandir's directory</p>
        </div>
      </div>

      {/* PROGRESS */}
      <div className="progress-wrap" ref={progressRef}>
        <div className="progress">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const cls = `step-btn${step === n ? ' active' : step > n ? ' done' : ''}`;
            return (
              <Fragment key={n}>
                {i > 0 && <div className="step-div" />}
                <div className="step">
                  <button className={cls} onClick={() => goStep(n)}>
                    <span className="step-num">{step > n ? '✓' : n}</span>
                    {label}
                  </button>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* PAGE */}
      <div className="page">

        {submitted ? (
          /* SUCCESS */
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
              {[['24h','Admin team reviews and verifies'],['QR','Unique QR code generated and sent'],['🔴','Temple profile goes live'],['💰','Donations & bookings enabled']].map(([n,t])=>(
                <div key={n} className="ss-item"><div className="ss-num">{n}</div><div className="ss-text">{t}</div></div>
              ))}
            </div>
            <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
              <button className="btn-home" onClick={() => { setSubmitted(false); setForm(initialForm()); setStep(1); }}>+ Add Another Temple</button>
            </div>
          </div>

        ) : (
          <>
            {/* ══ STEP 1: TEMPLE IDENTITY ══ */}
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
                      <Sel id="temple_type" value={form.temple_type} onChange={v=>set('temple_type',v)} options={TYPES} />
                    </Field>
                  </div>
                  <div className="fg-2">
                    <Field label="Sect / Tradition">
                      <Sel id="sect" value={form.sect} onChange={v=>set('sect',v)} options={SECTS} />
                    </Field>
                    <Field label="Managing Authority">
                      <Sel id="managing_authority" value={form.managing_authority} onChange={v=>set('managing_authority',v)} options={MANAGING_AUTHORITIES} />
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
                      <span key={key} className={`chip${form[key] ? ' on' : ''}`} onClick={() => toggle(key)}>{label}</span>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard icon="🏷️" title="Category Tags & External IDs" sub="For discovery and data linking">
                  <Field label="Category Tags" opt hint="Separate tags with | (pipe). Used for filtering and discovery.">
                    <Inp id="category_tags" type="text" value={form.category_tags} onChange={v=>set('category_tags',v)} placeholder="e.g. ancient|riverside|pilgrimage|shiva" />
                  </Field>
                  <div className="fg-3">
                    <Field label="Google Place ID" opt><Inp id="google_place_id" type="text" value={form.google_place_id} onChange={v=>set('google_place_id',v)} placeholder="ChIJ..." /></Field>
                    <Field label="Wikidata ID" opt><Inp id="wikidata_id" type="text" value={form.wikidata_id} onChange={v=>set('wikidata_id',v)} placeholder="Q12345" /></Field>
                    <Field label="OSM ID" opt><Inp id="osm_id" type="text" value={form.osm_id} onChange={v=>set('osm_id',v)} placeholder="node/12345678" /></Field>
                  </div>
                  <Field label="Wikipedia URL" opt>
                    <Inp id="wikipedia_url" type="url" value={form.wikipedia_url} onChange={v=>set('wikipedia_url',v)} placeholder="https://en.wikipedia.org/wiki/..." />
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
                  <button className="btn-next" onClick={() => nextStep(1)}>Next: Location →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 2: LOCATION ══ */}
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
                    <Field label="District">
                      <Inp id="district" type="text" value={form.district} onChange={v=>set('district',v)} placeholder="e.g. Ujjain" />
                    </Field>
                    <Field label="PIN Code">
                      <Inp id="pincode" type="text" value={form.pincode} onChange={v=>set('pincode',v)} placeholder="e.g. 456010" maxLength={6} />
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
                      <Sel id="setting_environment" value={form.setting_environment} onChange={v=>set('setting_environment',v)} options={SETTINGS} />
                    </Field>
                  </div>
                  <div className="fg-2">
                    <Field label="GPS Latitude" err={errors.latitude} hint="💡 Google Maps → Long press on temple → copy coordinates">
                      <Inp id="latitude" type="number" step="any" value={form.latitude} onChange={v=>set('latitude',v)} placeholder="e.g. 23.1828" />
                    </Field>
                    <Field label="GPS Longitude" err={errors.longitude}>
                      <Inp id="longitude" type="number" step="any" value={form.longitude} onChange={v=>set('longitude',v)} placeholder="e.g. 75.7682" />
                    </Field>
                  </div>
                  <Field label="Google Maps Link" opt>
                    <Inp id="google_maps_link" type="url" value={form.google_maps_link} onChange={v=>set('google_maps_link',v)} placeholder="https://maps.google.com/..." />
                  </Field>
                  <div className="fg-3">
                    <Field label="Nearest Railway Station">
                      <Inp type="text" value={form.nearest_railway} onChange={v=>set('nearest_railway',v)} placeholder="Name — distance e.g. 3 km" />
                    </Field>
                    <Field label="Nearest Airport">
                      <Inp type="text" value={form.nearest_airport} onChange={v=>set('nearest_airport',v)} placeholder="Name — distance e.g. 55 km" />
                    </Field>
                    <Field label="Nearest Bus Stand">
                      <Inp type="text" value={form.nearest_bus_stand} onChange={v=>set('nearest_bus_stand',v)} placeholder="Name — distance e.g. 1 km" />
                    </Field>
                  </div>
                  <Field label="Local Landmark / Directions">
                    <Inp type="text" value={form.local_landmark} onChange={v=>set('local_landmark',v)} placeholder="e.g. Near Dashashwamedh Ghat, opposite State Bank" />
                  </Field>
                </SectionCard>
                <div className="form-nav">
                  <button className="btn-back" onClick={() => prevStep(2)}>← Back</button>
                  <div className="step-indicator">Step 2 of 9</div>
                  <button className="btn-next" onClick={() => nextStep(2)}>Next: History →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 3: HISTORY ══ */}
            {step === 3 && (
              <div className="form-section">
                <SectionCard icon="📜" title="History & Significance" sub="Cultural and religious background">
                  <SecLabel>History</SecLabel>
                  <Field label="History (English)">
                    <Txt id="history" value={form.history} onChange={v=>set('history',v)} rows={4} placeholder="Brief history of the temple — founding, major events, renovations…" />
                  </Field>
                  <Field label="History (Hindi)" opt>
                    <Txt id="history_hindi" value={form.history_hindi} onChange={v=>set('history_hindi',v)} rows={3} placeholder="इस मंदिर का इतिहास हिंदी में लिखें…" />
                  </Field>
                  <SecLabel>Spiritual Context</SecLabel>
                  <Field label="Sthala Purana" opt>
                    <Txt id="sthala_purana" value={form.sthala_purana} onChange={v=>set('sthala_purana',v)} rows={3} placeholder="The divine legend or story associated with this sacred place…" />
                  </Field>
                  <Field label="Significance">
                    <Txt id="significance" value={form.significance} onChange={v=>set('significance',v)} rows={3} placeholder="Why is this temple important?" />
                  </Field>
                  <Field label="Puranic Stories" opt>
                    <Txt id="puranic_stories" value={form.puranic_stories} onChange={v=>set('puranic_stories',v)} rows={3} placeholder="Relevant stories from the Puranas or scriptures…" />
                  </Field>
                  <SecLabel>Architecture & Construction</SecLabel>
                  <Field label="Architecture Style">
                    <div className="radio-group">
                      {ARCH_STYLES.map(s => (
                        <label key={s} className={`radio-opt${archStyle===s?' selected':''}`} onClick={() => setArchStyle(s)}>
                          <input type="radio" name="arch" value={s} checked={archStyle===s} onChange={()=>setArchStyle(s)} />{s}
                        </label>
                      ))}
                    </div>
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
                  <button className="btn-next" onClick={() => nextStep(3)}>Next: Visit Info →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 4: VISIT INFO ══ */}
            {step === 4 && (
              <div className="form-section">
                <SectionCard icon="🕐" title="Timings & Entry" sub="When and how pilgrims can visit">
                  <div className="fg-4">
                    <Field label="Opening Time"><Inp type="time" value={form.opening_time} onChange={v=>set('opening_time',v)} /></Field>
                    <Field label="Closing Time"><Inp type="time" value={form.closing_time} onChange={v=>set('closing_time',v)} /></Field>
                    <Field label="Afternoon Closure Start"><Inp type="time" value={form.afternoon_closure_start} onChange={v=>set('afternoon_closure_start',v)} /></Field>
                    <Field label="Afternoon Closure End"><Inp type="time" value={form.afternoon_closure_end} onChange={v=>set('afternoon_closure_end',v)} /></Field>
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
                  <Field label="Dress Code" opt>
                    <Inp type="text" value={form.dress_code} onChange={v=>set('dress_code',v)} placeholder="e.g. Traditional attire required, no leather" />
                  </Field>
                  <Field label="Best Time to Visit">
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

                <SectionCard icon="🙏" title="Puja Offerings Available" sub="Select all puja types offered at this temple">
                  <CheckGrid items={PUJAS} form={form} toggle={toggle} className="puja-grid" itemClass="puja-item" nameClass="puja-name" />
                </SectionCard>

                <SectionCard icon="✅" title="Facilities Available" sub="Infrastructure and amenities at the temple">
                  <CheckGrid items={FACILITIES} form={form} toggle={toggle} className="fac-grid" itemClass="fac-item" nameClass="fac-name" />
                  <div style={{ marginTop:18 }}>
                    <SecLabel>Community Programs</SecLabel>
                    <CheckGrid items={PROGRAMS} form={form} toggle={toggle} className="fac-grid" itemClass="fac-item" nameClass="fac-name" />
                  </div>
                </SectionCard>

                <div className="form-nav">
                  <button className="btn-back" onClick={() => prevStep(4)}>← Back</button>
                  <div className="step-indicator">Step 4 of 9</div>
                  <button className="btn-next" onClick={() => nextStep(4)}>Next: Digital & Seva →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 5: DIGITAL & SEVA ══ */}
            {step === 5 && (
              <div className="form-section">
                <SectionCard icon="📺" title="Digital & Live Services" sub="Online puja, live darshan and streaming">
                  <div className="fg-2">
                    <Field label="Online Puja Available">
                      <Sel value={form.online_puja_available} onChange={v=>set('online_puja_available',v)}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                        <option value="soon">Coming Soon</option>
                      </Sel>
                    </Field>
                    <Field label="Live Darshan Available">
                      <Sel value={form.live_darshan_available} onChange={v=>set('live_darshan_available',v)}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                        <option value="planning">Planning</option>
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
                  <button className="btn-back" onClick={() => prevStep(5)}>← Back</button>
                  <div className="step-indicator">Step 5 of 9</div>
                  <button className="btn-next" onClick={() => nextStep(5)}>Next: Priests & Schedule →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 6: PRIESTS & SCHEDULE ══ */}
            {step === 6 && (
              <div className="form-section">
                <SectionCard icon="👳" title="Temple Priests" sub="Priests serving at this temple">
                  {priests.map((p, idx) => (
                    <div className="priest-card" key={p.id}>
                      <div className="priest-card-hdr">
                        <div className="priest-card-title">👳 Priest #{idx + 1}</div>
                        {idx > 0 && <button className="remove-priest" onClick={() => removePriest(p.id)}>× Remove</button>}
                      </div>
                      <div className="fg-3">
                        <Field label="Full Name" req><Inp type="text" value={p.name} onChange={v=>setPriest(p.id,'name',v)} placeholder="e.g. Pandit Ram Sharma" /></Field>
                        <Field label="Title / Designation"><Inp type="text" value={p.title} onChange={v=>setPriest(p.id,'title',v)} placeholder="e.g. Head Priest, Pujari" /></Field>
                        <Field label="Phone" req><Inp type="tel" value={p.phone} onChange={v=>setPriest(p.id,'phone',v)} placeholder="+91 XXXXX XXXXX" /></Field>
                      </div>
                      <div className="fg-3">
                        <Field label="Sampradaya">
                          <select value={p.sampradaya} onChange={e=>setPriest(p.id,'sampradaya',e.target.value)}>
                            {SAMPRADAYAS.map(s=><option key={s} value={s}>{s||'Select'}</option>)}
                          </select>
                        </Field>
                        <Field label="Appointment Type">
                          <select value={p.appt_type} onChange={e=>setPriest(p.id,'appt_type',e.target.value)}>
                            {APPT_TYPES.map(a=><option key={a} value={a}>{a||'Select'}</option>)}
                          </select>
                        </Field>
                        <Field label="Years Serving"><Inp type="number" min={0} value={p.years} onChange={v=>setPriest(p.id,'years',v)} placeholder="e.g. 15" /></Field>
                      </div>
                      <label className="chip" style={{ display:'inline-flex', width:'auto' }} onClick={() => setPriest(p.id,'is_head',!p.is_head)}>
                        <input type="checkbox" checked={p.is_head} onChange={()=>{}} style={{ accentColor:'var(--s2)', marginRight:6 }} />
                        Head / Chief Priest
                      </label>
                    </div>
                  ))}
                  <button className="add-btn" onClick={addPriest}>+ Add Another Priest</button>
                </SectionCard>

                <SectionCard icon="⏰" title="Daily Puja Schedule" sub="Timings of regular pujas and aartis">
                  <div className="sched-builder">
                    <div className="sched-hdr"><span>Puja Name</span><span>Time</span><span>Type</span><span></span></div>
                    {scheds.map(s => (
                      <div className="sched-row" key={s.id}>
                        <input type="text" value={s.name} onChange={e=>setSched(s.id,'name',e.target.value)} placeholder="e.g. Mangal Aarti" />
                        <input type="time" value={s.time} onChange={e=>setSched(s.id,'time',e.target.value)} />
                        <select value={s.type} onChange={e=>setSched(s.id,'type',e.target.value)}>
                          {['Aarti','Puja','Abhishek','Bhog','Other'].map(t=><option key={t}>{t}</option>)}
                        </select>
                        <button className="sched-del" onClick={() => delSched(s.id)}>×</button>
                      </div>
                    ))}
                  </div>
                  <button className="add-sched-btn" onClick={addSched}>+ Add Puja Row</button>
                </SectionCard>

                <SectionCard icon="🎉" title="Temple Committee" sub="Governing committee details">
                  <div className="fg-2">
                    <Field label="Chairman Name" opt><Inp type="text" value={form.chairman_name} onChange={v=>set('chairman_name',v)} placeholder="e.g. Sri Ramesh Gupta" /></Field>
                    <Field label="Chairman Contact" opt><Inp type="tel" value={form.chairman_contact} onChange={v=>set('chairman_contact',v)} placeholder="+91 XXXXX XXXXX" /></Field>
                  </div>
                  <div className="fg-2">
                    <Field label="Committee Member Count" opt><Inp type="number" min={1} value={form.committee_count} onChange={v=>set('committee_count',v)} placeholder="e.g. 11" /></Field>
                    <Field label="Election Cycle">
                      <Sel value={form.election_cycle} onChange={v=>set('election_cycle',v)} options={ELECTION_CYCLES} />
                    </Field>
                  </div>
                </SectionCard>

                <div className="form-nav">
                  <button className="btn-back" onClick={() => prevStep(6)}>← Back</button>
                  <div className="step-indicator">Step 6 of 9</div>
                  <button className="btn-next" onClick={() => nextStep(6)}>Next: Media →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 7: MEDIA ══ */}
            {step === 7 && (
              <div className="form-section">
                <SectionCard icon="🖼️" title="Temple Photos" sub="Upload photos for the temple gallery">
                  <div className="info-banner">
                    <span>ℹ️</span>
                    <span>First photo will be set as the <strong>hero/cover image</strong>. Upload high-quality JPG or PNG photos (max 10MB each). Minimum 1 photo required.</span>
                  </div>
                  <div className="photo-grid">
                    {photos.map((url, idx) => (
                      <div key={idx} className={`photo-slot${url ? ' has-img' : ''}`} style={{ position:'relative' }}>
                        {url ? (
                          <>
                            <div className="ps-preview" style={{ background:`url(${url}) center/cover` }} />
                            <button className="ps-remove" onClick={() => removePhoto(idx)}>×</button>
                          </>
                        ) : (
                          <>
                            <div className="ps-icon">📸</div>
                            <div className="ps-label">{idx === 0 ? 'Hero Image' : `Gallery Photo ${idx+1}`}</div>
                            {idx === 0 && <div className="ps-req">Required</div>}
                            <input type="file" accept="image/*" style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }} onChange={e => handlePhotoChange(e, idx)} />
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
                      {idx > 0 && <button className="remove-priest" style={{ position:'absolute', top:10, right:12 }} onClick={() => removeMantra(m.id)}>× Remove</button>}
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

                <SectionCard icon="🎊" title="Festivals" sub="Major festivals celebrated at this temple">
                  {festivals.map((f, idx) => (
                    <div className="sub-card" key={f.id}>
                      {idx > 0 && <button className="remove-priest" style={{ position:'absolute', top:10, right:12 }} onClick={() => removeFest(f.id)}>× Remove</button>}
                      <div className="fg-3">
                        <Field label="Festival Name" req><Inp type="text" value={f.name} onChange={v=>setFest(f.id,'name',v)} placeholder="e.g. Mahashivratri" /></Field>
                        <Field label="Hindu Month"><Inp type="text" value={f.hmonth} onChange={v=>setFest(f.id,'hmonth',v)} placeholder="e.g. Phalguna" /></Field>
                        <Field label="Calendar Month">
                          <select value={f.month} onChange={e=>setFest(f.id,'month',e.target.value)}>
                            <option value="">Select</option>
                            {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
                          </select>
                        </Field>
                      </div>
                      <div className="fg-2">
                        <Field label="Description"><Txt value={f.desc} onChange={v=>setFest(f.id,'desc',v)} rows={2} placeholder="How is this festival celebrated here?" /></Field>
                        <Field label="Duration (days)">
                          <Inp type="number" min={1} value={f.days} onChange={v=>setFest(f.id,'days',v)} placeholder="e.g. 3" />
                          <label className="fac-item" style={{ marginTop:8 }} onClick={() => setFest(f.id,'major',!f.major)}>
                            <input type="checkbox" checked={f.major} onChange={()=>{}} style={{ accentColor:'var(--s2)' }} />
                            <span className="fac-name">Major Festival</span>
                          </label>
                        </Field>
                      </div>
                    </div>
                  ))}
                  <button className="add-btn" onClick={addFest}>+ Add Another Festival</button>
                </SectionCard>

                <div className="form-nav">
                  <button className="btn-back" onClick={() => prevStep(7)}>← Back</button>
                  <div className="step-indicator">Step 7 of 9</div>
                  <button className="btn-next" onClick={() => nextStep(7)}>Next: Donations →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 8: DONATIONS ══ */}
            {step === 8 && (
              <div className="form-section">
                <SectionCard icon="💰" title="Online Donations" sub="Payment details for accepting donations">
                  <div className="warn-banner">
                    <span>⚠️</span>
                    <span><strong>Security Notice:</strong> Bank account number will be encrypted in production. Ensure HTTPS is enabled before collecting banking data.</span>
                  </div>
                  <label className="chip" style={{ display:'inline-flex', width:'auto' }} onClick={() => set('accept_online_donations', !form.accept_online_donations)}>
                    <input type="checkbox" checked={form.accept_online_donations} onChange={()=>{}} style={{ accentColor:'var(--s2)', marginRight:6 }} />
                    ✅ &nbsp; This temple accepts online donations
                  </label>

                  {form.accept_online_donations && (
                    <div style={{ marginTop:16 }}>
                      <div className="fg-2">
                        <Field label="UPI ID" opt><Inp type="text" value={form.upi_id} onChange={v=>set('upi_id',v)} placeholder="e.g. temple@upi or 9876543210@paytm" /></Field>
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
                  <button className="btn-back" onClick={() => prevStep(8)}>← Back</button>
                  <div className="step-indicator">Step 8 of 9</div>
                  <button className="btn-next" onClick={() => nextStep(8)}>Review & Submit →</button>
                </div>
              </div>
            )}

            {/* ══ STEP 9: REVIEW & SUBMIT ══ */}
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

                <SectionCard icon="✍️" title="Admin Confirmation" sub="Confirm the submission details">
                  <div className="fg-3">
                    <Field label="Submitted By" req>
                      <Inp type="text" value={form.submitter_name} onChange={v=>set('submitter_name',v)} placeholder="Admin name" />
                    </Field>
                    <Field label="Role">
                      <Sel value={form.submitter_role} onChange={v=>set('submitter_role',v)}>
                        {ROLES.map(r=><option key={r} value={r}>{r.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                      </Sel>
                    </Field>
                    <Field label="Contact Phone">
                      <Inp type="tel" value={form.submitter_phone} onChange={v=>set('submitter_phone',v)} placeholder="+91 XXXXX XXXXX" />
                    </Field>
                  </div>

                  <div style={{ marginTop:6 }}>
                    <div className="consent-title">Consent & Compliance</div>
                    {[
                      'I confirm I am authorised to submit this temple\'s information to BharatMandir.',
                      'All information provided is accurate and verified to the best of my knowledge.',
                      'I grant BharatMandir permission to publish this temple\'s profile publicly.',
                      'The temple agrees to comply with BharatMandir\'s listing guidelines and bylaws.',
                      'Donation and financial information disclosed will be maintained transparently.',
                    ].map((text, i) => (
                      <label key={i} className="consent-check" onClick={() => toggleConsent(i)}>
                        <input type="checkbox" checked={consents[i]} onChange={()=>{}} style={{ accentColor:'var(--s2)' }} />
                        {text}
                      </label>
                    ))}
                  </div>
                </SectionCard>

                <div className="form-nav">
                  <button className="btn-back" onClick={() => prevStep(9)}>← Back</button>
                  <div className="step-indicator">Step 9 of 9</div>
                  <button className="btn-submit" disabled={!allConsents} onClick={submitForm}>
                    🕉️ Save Temple to BharatMandir
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
