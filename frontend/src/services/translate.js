import i18n from '../i18n';
import { translateStaticText } from './siteTranslations';

export default i18n;

const VALUE_HI = {
  India: 'भारत',
  Shiva: 'शिव',
  'Lord Shiva': 'भगवान शिव',
  Mahadev: 'महादेव',
  Vishnu: 'विष्णु',
  'Lord Vishnu': 'भगवान विष्णु',
  Krishna: 'कृष्ण',
  'Lord Krishna': 'भगवान कृष्ण',
  Rama: 'राम',
  'Lord Rama': 'भगवान राम',
  Hanuman: 'हनुमान',
  Ganesha: 'गणेश',
  Ganesh: 'गणेश',
  Devi: 'देवी',
  Durga: 'दुर्गा',
  Kali: 'काली',
  Lakshmi: 'लक्ष्मी',
  Parvati: 'पार्वती',
  Kartikeya: 'कार्तिकेय',
  Shaiva: 'शैव',
  Vaishnava: 'वैष्णव',
  Shakta: 'शाक्त',
  Smarta: 'स्मार्त',
  Other: 'अन्य',
  Published: 'प्रकाशित',
  Draft: 'ड्राफ्ट',
  Review: 'समीक्षा',
  Flagged: 'चिह्नित',
  Archived: 'संग्रहित',
  Maharashtra: 'महाराष्ट्र',
  Gujarat: 'गुजरात',
  Rajasthan: 'राजस्थान',
  'Madhya Pradesh': 'मध्य प्रदेश',
  'Uttar Pradesh': 'उत्तर प्रदेश',
  Uttarakhand: 'उत्तराखंड',
  Bihar: 'बिहार',
  Jharkhand: 'झारखंड',
  Odisha: 'ओडिशा',
  Karnataka: 'कर्नाटक',
  Kerala: 'केरल',
  'Tamil Nadu': 'तमिलनाडु',
  Telangana: 'तेलंगाना',
  'Andhra Pradesh': 'आंध्र प्रदेश',
  Delhi: 'दिल्ली',
  Haryana: 'हरियाणा',
  Punjab: 'पंजाब',
  Ujjain: 'उज्जैन',
  Varanasi: 'वाराणसी',
  Ayodhya: 'अयोध्या',
  Mathura: 'मथुरा',
  Haridwar: 'हरिद्वार',
  Rishikesh: 'ऋषिकेश',
  Dwarka: 'द्वारका',
  Somnath: 'सोमनाथ',
  Nashik: 'नाशिक',
};

const FIELD_ALIASES = {
  name: ['name_hindi', 'name_hi'],
  history: ['history_hindi', 'history_hi'],
  description: ['description_hindi', 'description_hi'],
  significance: ['significance_hindi', 'significance_hi'],
  address: ['address_hindi', 'address_hi'],
  primary_deity: ['primary_deity_hindi', 'primary_deity_hi'],
  city: ['city_hindi', 'city_hi'],
  state: ['state_hindi', 'state_hi'],
};

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function translateValue(value, lang) {
  if (lang !== 'hi' || value == null) return value;
  if (Array.isArray(value)) return value.map(item => translateValue(item, lang));
  if (typeof value !== 'string') return value;

  const exact = VALUE_HI[normalize(value)];
  if (exact) return exact;

  const bridged = translateStaticText(value, lang);
  return bridged;
}

export function localizeRecord(record, lang) {
  if (!record || lang === 'en') return record;

  const localized = { ...record };

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const source = aliases.find(alias => record[alias]);
    if (source) localized[field] = record[source];
  }

  for (const [key, value] of Object.entries(localized)) {
    localized[key] = translateValue(value, lang);
  }

  return localized;
}

export async function translateTemple(temple, lang) {
  return localizeRecord(temple, lang);
}

export async function translateTemples(temples, lang) {
  if (!Array.isArray(temples)) return temples;
  return temples.map(temple => localizeRecord(temple, lang));
}
