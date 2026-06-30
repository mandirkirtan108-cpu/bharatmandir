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
  'Lord Ram': 'भगवान राम',
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
  'ISKCON / Vaishnava': 'इस्कॉन / वैष्णव',
  'Ramanandi': 'रामानंदी',
  'Madhva': 'माध्व',
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
  Gandhinagar: 'गांधीनगर',
  Ahmedabad: 'अहमदाबाद',
  Surat: 'सूरत',
  Vadodara: 'वडोदरा',
  Mumbai: 'मुंबई',
  Pune: 'पुणे',
  Nagpur: 'नागपुर',
  Indore: 'इंदौर',
  Bhopal: 'भोपाल',
  'Urban / City': 'शहरी / नगर क्षेत्र',
  'Riverbank / Ghats': 'नदी तट / घाट',
  'Hilltop / Mountain': 'पहाड़ी / पर्वतीय क्षेत्र',
  'Forest / Jungle': 'वन / जंगल क्षेत्र',
  'Cave / Underground': 'गुफा / भूमिगत',
  Island: 'द्वीप',
  'Roadside / Highway': 'सड़क किनारे / राजमार्ग',
  'Village common': 'ग्राम सार्वजनिक क्षेत्र',
  'Contemporary Indian Solanki': 'समकालीन भारतीय सोलंकी शैली',
  'Traditional modest attire; no shorts or sleeveless': 'पारंपरिक शालीन वस्त्र; शॉर्ट्स या बिना आस्तीन के वस्त्र नहीं',
  'Panchajiri Prasad': 'पंचजीरी प्रसाद',
  'Morning': 'सुबह',
  'Evening': 'शाम',
  'Afternoon': 'दोपहर',
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
