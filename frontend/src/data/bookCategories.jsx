/* ═══════════════════════════════════════════════════════════════
   SACRED BOOK CATEGORIES
   Maps each book's `api_source` (returned by the backend) into a
   folder/category. Add a new source string to the right array when
   a new scripture is added to the backend registry.
═══════════════════════════════════════════════════════════════ */

export const CATEGORIES = [
  {
    key: 'gita',
    label: 'Bhagavad Gita',
    sanskrit: 'गीता',
    icon: '📖',
    description: 'The song of God — 700 verses of divine wisdom spoken by Krishna to Arjuna.',
    sources: ['bhagavad_gita_api'],
  },
  {
    key: 'itihasa',
    label: 'Itihasa (Epics)',
    sanskrit: 'इतिहास',
    icon: '🏹',
    description: 'The great epics — Ramayana, Mahabharata, and Ramcharitmanas.',
    sources: ['valmiki_ramayana', 'mahabharata', 'ramcharitmanas'],
  },
  {
    key: 'purana',
    label: 'Puranas',
    sanskrit: 'पुराण',
    icon: '📜',
    description: 'Ancient cosmological and devotional texts of Bharat.',
    sources: ['shiva_purana', 'devi_mahatmya', 'vishnu_purana', 'bhagavata_purana'],
  },
  {
    key: 'chalisa',
    label: 'Chalisa',
    sanskrit: 'चालीसा',
    icon: '🙏',
    description: 'Devotional 40-verse hymns of praise.',
    sources: ['hanuman_chalisa'],
  },
  {
    key: 'veda',
    label: 'Vedas',
    sanskrit: 'वेद',
    icon: '🔥',
    description: 'The four foundational scriptures — Rig, Yajur, Sama, Atharva.',
    sources: ['rigveda', 'yajurveda', 'atharvaveda'],
  },
  {
    key: 'upanishad',
    label: 'Upanishads',
    sanskrit: 'उपनिषद्',
    icon: '🕉️',
    description: 'The philosophical core of the Vedas — Atman, Brahman, and liberation.',
    sources: ['upanishads'],
  },
  {
    key: 'dharmashastra',
    label: 'Dharmashastra',
    sanskrit: 'धर्मशास्त्र',
    icon: '⚖️',
    description: 'Ancient legal and ethical treatises.',
    sources: ['manusmriti'],
  },
  {
    key: 'yoga',
    label: 'Yoga',
    sanskrit: 'योग',
    icon: '🧘',
    description: "Patanjali's foundational treatise on the theory and practice of yoga.",
    sources: ['yoga_sutras'],
  },
  {
    key: 'community',
    label: 'New Publications',
    sanskrit: 'नव प्रकाशन',
    icon: '📚',
    description: 'Recently published books and translations from the BharatMandir library.',
    sources: [],
  },
];

export function getCategoryByKey(key) {
  return CATEGORIES.find(c => c.key === key) || null;
}

export function getCategoryForBook(book) {
  if (!book) return null;
  const explicitCategory = book.category || book.category_key;
  if (explicitCategory) {
    const category = CATEGORIES.find(c => c.key === explicitCategory);
    if (category) return category;
  }

  return CATEGORIES.find(c => c.sources.includes(book.api_source))
    || CATEGORIES.find(c => c.key === 'community');
}

/** Builds { categoryKey: [books...] } from a flat book list. */
export function groupBooksByCategory(books) {
  const grouped = {};
  for (const cat of CATEGORIES) grouped[cat.key] = [];
  for (const book of books) {
    const cat = getCategoryForBook(book);
    if (cat) grouped[cat.key].push(book);
  }
  return grouped;
}
