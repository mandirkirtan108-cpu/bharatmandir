import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

/* ─── Book Data ──────────────────────────────────────────────── */
const BOOKS = [
  {
    id: 'bhagavad-gita',
    title: 'Bhagavad Gita',
    sanskrit: 'श्रीमद्भगवद्गीता',
    deity: 'Lord Krishna',
    icon: '🦚',
    tradition: 'Vaishnava',
    chapters: 18,
    verses: 700,
    language: 'Sanskrit',
    description:
      'The Song of God — a 700-verse Hindu scripture that is part of the epic Mahabharata. Lord Krishna imparts spiritual wisdom to Arjuna on the battlefield of Kurukshetra.',
    color: '#1A6B3A',
    accentColor: '#EBF7F0',
    chapters_data: [
      { num: 1,  title: "Arjuna's Dilemma',              verses: 47,  summary: 'Arjuna, overcome with grief and moral confusion, refuses to fight his own kin.'" },
      { num: 2,  title: 'Transcendental Knowledge',       verses: 72,  summary: 'Krishna imparts foundational teachings on the eternal soul and duty (dharma).' },
      { num: 3,  title: 'Karma Yoga',                     verses: 43,  summary: 'The path of selfless action — doing one\'s duty without attachment to results.' },
      { num: 4,  title: 'Jnana Yoga',                     verses: 42,  summary: 'The path of knowledge; Krishna reveals his divine nature and the cycle of ages.' },
      { num: 5,  title: 'Karma-Sannyasa Yoga',            verses: 29,  summary: 'Renunciation of action vs. yoga of action — Krishna reconciles both paths.' },
      { num: 6,  title: 'Dhyana Yoga',                    verses: 47,  summary: 'The yoga of meditation and self-discipline for attaining liberation.' },
      { num: 7,  title: 'Knowledge of the Absolute',      verses: 30,  summary: 'Krishna describes his divine nature and how rare it is to truly know him.' },
      { num: 8,  title: 'Attaining the Supreme',          verses: 28,  summary: 'The imperishable Brahman, the cosmic self, and the path to liberation at death.' },
      { num: 9,  title: 'Royal Knowledge',                verses: 34,  summary: 'The most confidential knowledge — sovereign yoga and devotion to Krishna.' },
      { num: 10, title: 'Divine Manifestations',          verses: 42,  summary: 'Krishna reveals his divine opulences and supreme manifestations.' },
      { num: 11, title: 'The Universal Form',             verses: 55,  summary: 'Krishna grants Arjuna divine vision to behold his awe-inspiring cosmic form.' },
      { num: 12, title: 'Devotional Service',             verses: 20,  summary: 'The path of loving devotion (bhakti) as the highest path to the Supreme.' },
      { num: 13, title: 'Nature, Enjoyer & Consciousness',verses: 35,  summary: 'The distinction between body (field) and the knower of the field (soul).' },
      { num: 14, title: 'Three Modes of Nature',          verses: 27,  summary: 'The three qualities of material nature — goodness, passion, and ignorance.' },
      { num: 15, title: 'The Supreme Person',             verses: 20,  summary: 'The cosmic Ashvattha tree of existence; Krishna as the supreme person.' },
      { num: 16, title: 'Divine & Demoniac Natures',      verses: 24,  summary: 'The qualities that lead toward liberation or bondage.' },
      { num: 17, title: 'Divisions of Faith',             verses: 28,  summary: 'Three types of faith corresponding to the three modes of nature.' },
      { num: 18, title: 'Liberation through Renunciation',verses: 78,  summary: 'Synthesis of all teachings — ultimate renunciation and surrender to Krishna.' },
    ],
    verses_sample: [
      { chapter: 2, verse: 47, sanskrit: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥', translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions. Never consider yourself the cause of the results of your activities, and never be attached to not doing your duty.', significance: 'The most quoted verse of the Gita — the foundation of Karma Yoga.' },
      { chapter: 2, verse: 20, sanskrit: 'न जायते म्रियते वा कदाचिन्\nनायं भूत्वा भविता वा न भूयः।\nअजो नित्यः शाश्वतोऽयं पुराणो\nन हन्यते हन्यमाने शरीरे॥', translation: 'The soul is never born nor dies at any time. It has not come into being, does not come into being, and will not come into being. It is unborn, eternal, ever-existing, and primeval. It is not slain when the body is slain.', significance: 'The immortality of the Atman — the eternal soul.' },
      { chapter: 18, verse: 66, sanskrit: 'सर्वधर्मान्परित्यज्य मामेकं शरणं व्रज।\nअहं त्वां सर्वपापेभ्यो मोक्षयिष्यामि मा शुचः॥', translation: 'Abandon all varieties of dharma and simply surrender unto Me. I shall deliver you from all sinful reactions; do not fear.', significance: 'The Charama Shloka — Krishna\'s ultimate promise of liberation.' },
    ],
  },
  {
    id: 'ramayana',
    title: 'Ramayana',
    sanskrit: 'रामायण',
    deity: 'Lord Rama',
    icon: '🏹',
    tradition: 'Vaishnava',
    chapters: 7,
    verses: 24000,
    language: 'Sanskrit',
    description:
      'The Journey of Rama — an ancient Indian epic composed by Valmiki. It narrates the life of Rama, his exile, the abduction of Sita by Ravana, and ultimate victory of dharma.',
    color: '#C8520A',
    accentColor: '#FFF3EB',
    chapters_data: [
      { num: 1, title: 'Bala Kanda — Boyhood',       verses: 2005, summary: 'Birth of Rama and his brothers in Ayodhya; education, early adventures with sage Vishwamitra.' },
      { num: 2, title: 'Ayodhya Kanda — Ayodhya',    verses: 4012, summary: 'Rama\'s planned coronation is thwarted; he goes into 14 years of exile with Sita and Lakshmana.' },
      { num: 3, title: 'Aranya Kanda — The Forest',   verses: 2555, summary: 'Life in the forest; Sita is abducted by the demon king Ravana.' },
      { num: 4, title: 'Kishkindha Kanda — Vanaras',  verses: 2665, summary: 'Rama befriends Sugriva and the monkey army; Hanuman is sent to search for Sita.' },
      { num: 5, title: 'Sundara Kanda — Beautiful',   verses: 2885, summary: 'Hanuman\'s heroic journey to Lanka; he finds Sita and delivers Rama\'s message.' },
      { num: 6, title: 'Yuddha Kanda — War',          verses: 5765, summary: 'The great battle; Ravana is slain, Sita rescued, Rama returns to Ayodhya in triumph.' },
      { num: 7, title: 'Uttara Kanda — Epilogue',     verses: 3113, summary: 'Reign of Rama, Sita\'s exile, Lava and Kusha, and Rama\'s final ascension.' },
    ],
    verses_sample: [
      { chapter: 1, verse: 1, sanskrit: 'तपःस्वाध्यायनिरतां तपस्वी वाग्विदां वरम्।\nनारदं परिपप्रच्छ वाल्मीकिर्मुनिपुङ्गवम्॥', translation: 'Valmiki, the sage devoted to austerity and sacred study, asked the revered Narada, foremost among those versed in words.', significance: 'The very first verse of the Ramayana — Valmiki seeking the ideal man.' },
      { chapter: 5, verse: 1, sanskrit: 'ततो रावणनीतायाः सीतायाः शत्रुकर्शनः।\nईयेष पदमन्वेष्टुं चारणाचरिते पथि॥', translation: 'Then Hanuman, the crusher of enemies, desired to find the footsteps of Sita who was carried away by Ravana, along the path frequented by the Charanas.', significance: 'Beginning of Sundara Kanda — Hanuman\'s legendary journey begins.' },
      { chapter: 6, verse: 128, sanskrit: 'एते देवाः सगन्धर्वाः सिद्धाश्च परमर्षयः।\nन जानन्ति परं रामं सर्वे क्ल्लृप्तबुद्धयः॥', translation: 'These gods, gandharvas, siddhas and great sages — even they with their profound wisdom do not fully know the Supreme Rama.', significance: 'The divine mystery of Rama\'s supreme nature.' },
    ],
  },
  {
    id: 'mahabharata',
    title: 'Mahabharata',
    sanskrit: 'महाभारत',
    deity: 'Lord Vishnu / Krishna',
    icon: '⚔️',
    tradition: 'Vaishnava',
    chapters: 18,
    verses: 100000,
    language: 'Sanskrit',
    description:
      'The longest epic in world literature — a monumental saga of the Kuru dynasty, dharma, war, and cosmic truth. It contains within it the Bhagavad Gita, Harivamsha, and immense philosophical discourses.',
    color: '#B07D12',
    accentColor: '#FDF8EC',
    chapters_data: [
      { num: 1,  title: 'Adi Parva — Origins',         verses: 8929,  summary: 'Origins of the Kuru dynasty; birth of the Pandavas and Kauravas; early life and rivalry.' },
      { num: 2,  title: 'Sabha Parva — The Court',      verses: 2511,  summary: 'The dice game; Draupadi\'s humiliation; the Pandavas\' exile.' },
      { num: 3,  title: 'Vana Parva — The Forest',      verses: 11664, summary: 'Twelve years of forest exile; many sub-stories including Nala-Damayanti.' },
      { num: 4,  title: 'Virata Parva — Incognito',     verses: 2050,  summary: 'The Pandavas spend their 13th year in disguise at King Virata\'s court.' },
      { num: 5,  title: 'Udyoga Parva — Preparation',   verses: 6698,  summary: 'Diplomatic attempts for peace fail; Krishna\'s peace mission to Hastinapura.' },
      { num: 6,  title: 'Bhishma Parva — Bhishma',      verses: 5884,  summary: 'First 10 days of battle; the Bhagavad Gita is revealed; Bhishma is felled.' },
      { num: 7,  title: 'Drona Parva — Drona',          verses: 8208,  summary: 'Days 11–15 of the war; death of Abhimanyu; Drona\'s death.' },
      { num: 8,  title: 'Karna Parva — Karna',          verses: 4964,  summary: 'Karna becomes commander; the tragic duel between Arjuna and Karna.' },
      { num: 9,  title: 'Shalya Parva — Shalya',        verses: 3220,  summary: 'Last day of battle; the fall of Duryodhana.' },
      { num: 10, title: 'Sauptika Parva — Night Raid',  verses: 870,   summary: 'Ashwatthama\'s night massacre of the sleeping Pandava camp.' },
      { num: 11, title: 'Stri Parva — Women',           verses: 775,   summary: 'The lament of the women; Gandhari\'s grief and curse on Krishna.' },
      { num: 12, title: 'Shanti Parva — Peace',         verses: 14525, summary: 'Bhishma on his deathbed teaches Yudhishthira dharma, statecraft, and moksha.' },
      { num: 13, title: 'Anushasana Parva — Discipline',verses: 6700,  summary: 'Bhishma\'s final teachings on gifts, duties, and liberation.' },
      { num: 14, title: 'Ashvamedha Parva — Horse Sacrifice', verses: 2100, summary: 'Yudhishthira performs the Ashvamedha yagna to purify himself.' },
      { num: 15, title: 'Ashramavasika Parva',          verses: 1506,  summary: 'Dhritarashtra, Gandhari, and Kunti retire to the forest.' },
      { num: 16, title: 'Mausala Parva — Clubs',        verses: 320,   summary: 'Destruction of the Yadava clan; Krishna\'s departure from the world.' },
      { num: 17, title: 'Mahaprasthanika Parva',        verses: 120,   summary: 'The Pandavas begin their final journey; one by one they fall.' },
      { num: 18, title: 'Svargarohana Parva — Heaven',  verses: 209,   summary: 'Yudhishthira\'s trial in hell and final ascension to heaven.' },
    ],
    verses_sample: [
      { chapter: 1, verse: 1, sanskrit: 'नारायणं नमस्कृत्य नरं चैव नरोत्तमम्।\nदेवीं सरस्वतीं चैव ततो जयमुदीरयेत्॥', translation: 'Having bowed to Narayana, to Nara the most exalted of men, and to the Goddess Saraswati, let the word "Jaya" (victory) be uttered.', significance: 'The auspicious opening invocation of the Mahabharata.' },
      { chapter: 6, verse: 1, sanskrit: 'धृतराष्ट्र उवाच |\nधर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।\nमामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय॥', translation: 'Dhritarashtra said: O Sanjaya, after assembling in the holy land of Kurukshetra, eager to fight, what did my sons and the sons of Pandu do?', significance: 'The opening verse of the Bhagavad Gita, within the Bhishma Parva.' },
    ],
  },
  {
    id: 'shiva-purana',
    title: 'Shiva Purana',
    sanskrit: 'शिव पुराण',
    deity: 'Lord Shiva',
    icon: '🔱',
    tradition: 'Shaiva',
    chapters: 7,
    verses: 24000,
    language: 'Sanskrit',
    description:
      'One of the 18 major Puranas, dedicated to the glory of Lord Shiva. It describes Shiva\'s divine manifestations, his cosmic functions as creator, preserver, and destroyer.',
    color: '#4A1C6B',
    accentColor: '#F5EEF8',
    chapters_data: [
      { num: 1, title: 'Vidyeshvara Samhita',    verses: 10000, summary: 'The glory of Shiva Linga worship; the nature of Brahman and liberation.' },
      { num: 2, title: 'Rudra Samhita',          verses: 8000,  summary: 'Five sections covering creation, Sati, Parvati, war with Tarakasura, and Kumar (Kartikeya).' },
      { num: 3, title: 'Shatrudra Samhita',      verses: 3000,  summary: 'The manifestations of Rudra — Shiva\'s fierce and benign aspects.' },
      { num: 4, title: 'Koti Rudra Samhita',     verses: 9000,  summary: 'Stories of the twelve Jyotirlingas — the sacred self-manifested lingas of Shiva.' },
      { num: 5, title: 'Uma Samhita',            verses: 8000,  summary: 'The glory of Parvati (Uma); devotion, liberation, and Shiva\'s consort.' },
      { num: 6, title: 'Kailasa Samhita',        verses: 6000,  summary: 'Shiva\'s abode on Kailasa; yoga, karma, and the nature of liberation.' },
      { num: 7, title: 'Vayaviya Samhita',       verses: 4000,  summary: 'Shiva as Vayu (wind); philosophical discourses on Shaiva theology.' },
    ],
    verses_sample: [
      { chapter: 1, verse: 1, sanskrit: 'ॐ नमः शिवाय\nशिवाय नमः ॐ\nनमः शम्भवाय च मयोभवाय च\nनमः शंकराय च मयस्कराय च', translation: 'Om, salutations to Shiva. Salutations to the one who is auspicious, the source of all bliss. Salutations to the peaceful one, the bestower of joy, the destroyer of sorrow.', significance: 'The Panchakshara mantra — Om Namah Shivaya — the heart of Shaiva devotion.' },
      { chapter: 2, verse: 1, sanskrit: 'त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम्।\nउर्वारुकमिव बन्धनान् मृत्योर्मुक्षीय माऽमृतात्॥', translation: 'We meditate on the three-eyed Lord who is fragrant and who nourishes all. May He liberate us from the bondage of death, just as the cucumber is severed from its vine, but not from immortality.', significance: 'The Maha Mrityunjaya Mantra — the great death-conquering mantra of Shiva.' },
    ],
  },
  {
    id: 'devi-mahatmya',
    title: 'Devi Mahatmya',
    sanskrit: 'देवी माहात्म्य',
    deity: 'Goddess Durga',
    icon: '🌺',
    tradition: 'Shakta',
    chapters: 13,
    verses: 700,
    language: 'Sanskrit',
    description:
      'Also called Durga Saptashati or Chandi Path — 700 verses celebrating the supreme power of the Goddess. Recited during Navaratri, it describes Devi\'s cosmic battles against demonic forces.',
    color: '#8B0000',
    accentColor: '#FEF2F2',
    chapters_data: [
      { num: 1,  title: 'Madhu-Kaitabha Slaying',    verses: 103, summary: 'Brahma awakens Vishnu by praising the Goddess; she helps slay the demons Madhu and Kaitabha.' },
      { num: 2,  title: 'Mahishasura\'s Army Slain',  verses: 37,  summary: 'The gods create Devi from their combined energies; she defeats Mahishasura\'s vast army.' },
      { num: 3,  title: 'Mahishasura Slain',          verses: 43,  summary: 'Devi slays the great buffalo demon Mahishasura — her most famous victory.' },
      { num: 4,  title: 'The Gods Praise Devi',       verses: 42,  summary: 'The gods celebrate Devi\'s victory; she promises to protect them whenever evil arises.' },
      { num: 5,  title: 'Shumbha & Nishumbha',        verses: 87,  summary: 'Two powerful asuras — Shumbha and Nishumbha — terrorize heaven and earth.' },
      { num: 6,  title: 'Dhumralochana Slain',        verses: 23,  summary: 'Devi as Ambika destroys the demon Dhumralochana with a single breath.' },
      { num: 7,  title: 'Chanda-Munda Slain',         verses: 28,  summary: 'The fierce form of Kali emerges from Devi\'s forehead and slays Chanda and Munda.' },
      { num: 8,  title: 'Raktabija Slain',            verses: 63,  summary: 'The fearsome Raktabija whose every drop of blood creates a new demon is slain by Kali.' },
      { num: 9,  title: 'Nishumbha Slain',            verses: 40,  summary: 'Nishumbha is destroyed by the Goddess in battle.' },
      { num: 10, title: 'Shumbha Slain',              verses: 33,  summary: 'Devi\'s final battle and victory over Shumbha, the lord of the asuras.' },
      { num: 11, title: 'Hymn to the Goddess',        verses: 55,  summary: 'The great hymn Narayani Stuti — praising all forms of the Goddess.' },
      { num: 12, title: 'Phalashruti',                verses: 45,  summary: 'The fruits of reading or hearing the Devi Mahatmya; protection promised.' },
      { num: 13, title: 'Suratha & Samadhi Blessed',  verses: 27,  summary: 'King Suratha and merchant Samadhi receive blessings; the Devi appears to them.' },
    ],
    verses_sample: [
      { chapter: 1, verse: 73, sanskrit: 'या देवी सर्वभूतेषु शक्तिरूपेण संस्थिता।\nनमस्तस्यै नमस्तस्यै नमस्तस्यै नमो नमः॥', translation: 'To the Goddess who resides in all beings in the form of power — salutations to her, salutations to her, salutations to her, salutations again and again.', significance: 'The most celebrated verse of Devi Mahatmya — repeated for each of Devi\'s nine forms.' },
      { chapter: 11, verse: 10, sanskrit: 'सर्वमंगलमांगल्ये शिवे सर्वार्थसाधिके।\nशरण्ये त्र्यम्बके गौरि नारायणि नमोऽस्तुते॥', translation: 'O Narayani, you are the auspiciousness of all that is auspicious, the embodiment of Shiva, the fulfiller of all objectives, the refuge of all, the three-eyed Gauri — salutations to you.', significance: 'Part of the sacred Narayani Stuti — the great hymn to the Goddess.' },
    ],
  },
  {
    id: 'hanuman-chalisa',
    title: 'Hanuman Chalisa',
    sanskrit: 'हनुमान चालीसा',
    deity: 'Lord Hanuman',
    icon: '🐒',
    tradition: 'Vaishnava',
    chapters: 1,
    verses: 40,
    language: 'Awadhi Hindi',
    description:
      'A devotional hymn composed by Tulsidas in 40 chaupais (quatrains) praising Hanuman. One of the most widely recited texts in the Hindu world, believed to grant protection and strength.',
    color: '#FF6B00',
    accentColor: '#FFF5EB',
    chapters_data: [
      { num: 1, title: 'Complete Hanuman Chalisa', verses: 40, summary: 'The 40 verses of the Chalisa cover Hanuman\'s birth, attributes, deeds in the Ramayana, and the blessings he bestows on devotees who recite it with faith.' },
    ],
    verses_sample: [
      { chapter: 1, verse: 1, sanskrit: 'श्री गुरु चरन सरोज रज, निज मनु मुकुरु सुधारि।\nबरनउँ रघुबर बिमल जसु, जो दायकु फल चारि॥', translation: 'Having cleansed the mirror of my mind with the pollen-dust of the holy Guru\'s lotus feet, I proclaim the pure glory of Raghuvir (Rama) which bestows the four fruits of life.', significance: 'The opening doha (couplet) of Hanuman Chalisa — Tulsidas\'s invocation.' },
      { chapter: 1, verse: 2, sanskrit: 'जय हनुमान ज्ञान गुन सागर।\nजय कपीस तिहुँ लोक उजागर॥', translation: 'Victory to Hanuman, the ocean of wisdom and virtue! Victory to the lord of monkeys who illumines the three worlds!', significance: 'The first chaupai — the opening salutation to Hanuman.' },
      { chapter: 1, verse: 40, sanskrit: 'पवन तनय संकट हरन, मंगल मूरति रूप।\nराम लखन सीता सहित, हृदय बसहु सुर भूप॥', translation: 'O son of Pavanadeva, remover of all afflictions, embodiment of auspiciousness — dwell in my heart together with Rama, Lakshmana, and Sita.', significance: 'The closing doha — a prayer for Hanuman to reside in one\'s heart.' },
    ],
  },
];

/* ─── Sub-components ─────────────────────────────────────────── */

function BookCard({ book, onSelect, isSelected }) {
  return (
    <button
      onClick={() => onSelect(book)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '22px 20px',
        background: isSelected ? book.accentColor : 'white',
        border: `2px solid ${isSelected ? book.color : 'var(--cream-dark)'}`,
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: isSelected ? `0 4px 20px ${book.color}22` : 'var(--shadow-xs)',
        transform: isSelected ? 'translateY(-2px)' : 'none',
        width: '100%',
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = book.color;
          e.currentTarget.style.boxShadow = `0 4px 16px ${book.color}18`;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--cream-dark)';
          e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
          e.currentTarget.style.transform = 'none';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 26 }}>{book.icon}</span>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            color: isSelected ? book.color : 'var(--brown)',
            lineHeight: 1.2,
          }}>{book.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{book.sanskrit}</div>
        </div>
      </div>
      <div style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: 10,
          padding: '3px 8px',
          borderRadius: 99,
          background: `${book.color}18`,
          color: book.color,
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}>{book.tradition}</span>
        <span style={{
          fontSize: 10,
          padding: '3px 8px',
          borderRadius: 99,
          background: 'var(--cream-mid)',
          color: 'var(--text-light)',
          fontWeight: 600,
        }}>{book.verses.toLocaleString()} verses</span>
      </div>
    </button>
  );
}

function ChapterRow({ ch, isOpen, onClick, bookColor }) {
  return (
    <div style={{
      border: `1px solid ${isOpen ? bookColor + '44' : 'var(--cream-dark)'}`,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
      marginBottom: 8,
    }}>
      <button
        onClick={onClick}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          background: isOpen ? `${bookColor}08` : 'white',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          minWidth: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          background: isOpen ? bookColor : 'var(--cream-mid)',
          color: isOpen ? 'white' : 'var(--text-light)',
          fontSize: 12,
          fontWeight: 700,
          transition: 'all 0.2s',
        }}>{ch.num}</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 600,
            color: isOpen ? bookColor : 'var(--brown)',
          }}>{ch.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {ch.verses.toLocaleString()} verses
          </div>
        </div>
        <span style={{
          fontSize: 18,
          color: bookColor,
          transform: isOpen ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.2s',
          opacity: isOpen ? 1 : 0.4,
        }}>›</span>
      </button>
      {isOpen && (
        <div style={{
          padding: '14px 18px 16px',
          background: `${bookColor}05`,
          borderTop: `1px solid ${bookColor}20`,
          fontSize: 14,
          color: 'var(--text-mid)',
          lineHeight: 1.7,
          animation: 'fadeDown 0.2s ease',
        }}>
          {ch.summary}
        </div>
      )}
    </div>
  );
}

function VerseCard({ v, bookColor, accent }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{
      background: accent,
      border: `1px solid ${bookColor}22`,
      borderRadius: 'var(--radius-lg)',
      padding: '20px 22px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: 10,
        right: 14,
        fontSize: 32,
        opacity: 0.06,
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        color: bookColor,
        userSelect: 'none',
        pointerEvents: 'none',
      }}>❝</div>
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: bookColor,
        letterSpacing: '0.08em',
        marginBottom: 10,
      }}>CHAPTER {v.chapter} · VERSE {v.verse}</div>
      {show ? (
        <div style={{
          fontFamily: 'var(--font-hindi)',
          fontSize: 16,
          color: 'var(--brown)',
          lineHeight: 1.9,
          marginBottom: 12,
          whiteSpace: 'pre-line',
          animation: 'fadeIn 0.3s ease',
        }}>{v.sanskrit}</div>
      ) : (
        <button
          onClick={() => setShow(true)}
          style={{
            marginBottom: 12,
            padding: '7px 14px',
            borderRadius: 8,
            border: `1px dashed ${bookColor}55`,
            background: 'transparent',
            color: bookColor,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >Show Sanskrit ›</button>
      )}
      <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.75, fontStyle: 'italic', marginBottom: 10 }}>
        "{v.translation}"
      </p>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: bookColor,
        fontWeight: 600,
        background: `${bookColor}12`,
        padding: '4px 10px',
        borderRadius: 99,
      }}>
        ✦ {v.significance}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function SacredBooksPage() {
  const [selectedBook, setSelectedBook] = useState(BOOKS[0]);
  const [openChapter, setOpenChapter] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');  // overview | chapters | verses
  const [searchQ, setSearchQ] = useState('');
  const detailRef = useRef(null);

  const filteredBooks = searchQ.trim()
    ? BOOKS.filter(b =>
        b.title.toLowerCase().includes(searchQ.toLowerCase()) ||
        b.deity.toLowerCase().includes(searchQ.toLowerCase()) ||
        b.tradition.toLowerCase().includes(searchQ.toLowerCase())
      )
    : BOOKS;

  const handleSelect = (book) => {
    setSelectedBook(book);
    setActiveTab('overview');
    setOpenChapter(null);
    // Scroll into view on mobile
    if (window.innerWidth < 768 && detailRef.current) {
      setTimeout(() => detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const bk = selectedBook;

  return (
    <>
      <Navbar />
      <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingTop: 80 }}>

        {/* ── Hero ──────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, var(--brown) 0%, #5C3010 100%)',
          padding: '48px 28px 52px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative Sanskrit watermark */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            fontSize: 'clamp(80px, 20vw, 160px)',
            opacity: 0.04,
            fontFamily: 'var(--font-hindi)',
            color: 'white',
            userSelect: 'none',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>ॐ</div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.12)',
            color: 'var(--gold-light)',
            borderRadius: 99,
            padding: '6px 16px',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.06em',
            marginBottom: 16,
          }}>📖 Sacred Scriptures of Bharat</div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            color: 'white',
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 12,
          }}>
            Read the<br />
            <span style={{ color: 'var(--gold-light)' }}>Sacred Books</span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 16,
            maxWidth: 500,
            margin: '0 auto',
            lineHeight: 1.7,
          }}>
            Explore the timeless wisdom of ancient scriptures — Gita, Ramayana,
            Mahabharata, and more — with translations and verse-by-verse study.
          </p>
        </div>

        {/* ── Layout ────────────────────────────────────── */}
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '32px 20px 60px',
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 300px) 1fr',
          gap: 24,
          alignItems: 'start',
        }}>

          {/* ── Sidebar ── */}
          <aside>
            <div style={{ marginBottom: 14 }}>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search books…"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '2px solid var(--cream-dark)',
                  borderRadius: 'var(--radius)',
                  background: 'white',
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--text-dark)',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredBooks.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  isSelected={selectedBook.id === book.id}
                  onSelect={handleSelect}
                />
              ))}
              {filteredBooks.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: 20 }}>
                  No books found
                </div>
              )}
            </div>
          </aside>

          {/* ── Detail Panel ── */}
          <main ref={detailRef} style={{
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--cream-dark)',
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
          }}>
            {/* Book header */}
            <div style={{
              background: `linear-gradient(135deg, ${bk.color}EE, ${bk.color}CC)`,
              padding: '32px 32px 28px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                right: 24, top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 72,
                opacity: 0.15,
                pointerEvents: 'none',
                userSelect: 'none',
              }}>{bk.icon}</div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                borderRadius: 99,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 12,
                letterSpacing: '0.05em',
              }}>{bk.tradition} · {bk.language}</div>

              <h2 style={{
                fontFamily: 'var(--font-display)',
                color: 'white',
                fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
                fontWeight: 700,
                lineHeight: 1.15,
                marginBottom: 4,
              }}>{bk.title}</h2>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, marginBottom: 16, fontFamily: 'var(--font-hindi)' }}>{bk.sanskrit}</div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Deity', value: bk.deity },
                  { label: 'Kandas/Parvas', value: bk.chapters },
                  { label: 'Verses', value: bk.verses.toLocaleString() },
                ].map(s => (
                  <div key={s.label} style={{
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: 'var(--radius)',
                    padding: '8px 14px',
                    backdropFilter: 'blur(6px)',
                  }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.07em', fontWeight: 600 }}>{s.label.toUpperCase()}</div>
                    <div style={{ fontSize: 15, color: 'white', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--cream-dark)',
              padding: '0 24px',
            }}>
              {[
                { id: 'overview',  label: '📜 Overview' },
                { id: 'chapters', label: '📖 Chapters' },
                { id: 'verses',   label: '✨ Key Verses' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '14px 16px',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? `3px solid ${bk.color}` : '3px solid transparent',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    color: activeTab === tab.id ? bk.color : 'var(--text-light)',
                    fontFamily: 'var(--font-body)',
                    transition: 'all 0.18s',
                    whiteSpace: 'nowrap',
                  }}
                >{tab.label}</button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ padding: '28px 32px 36px' }}>

              {/* OVERVIEW */}
              {activeTab === 'overview' && (
                <div style={{ animation: 'fadeUp 0.25s ease' }}>
                  <p style={{
                    fontSize: 16,
                    color: 'var(--text-mid)',
                    lineHeight: 1.85,
                    marginBottom: 28,
                    borderLeft: `4px solid ${bk.color}`,
                    paddingLeft: 16,
                  }}>{bk.description}</p>

                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    color: 'var(--brown)',
                    marginBottom: 16,
                  }}>At a Glance</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
                    {[
                      { label: 'Scripture Type', value: 'Purana / Itihasa' },
                      { label: 'Language',        value: bk.language },
                      { label: 'Tradition',       value: bk.tradition },
                      { label: 'Deity',           value: bk.deity },
                      { label: 'Chapters',        value: bk.chapters },
                      { label: 'Total Verses',    value: bk.verses.toLocaleString() },
                    ].map(s => (
                      <div key={s.label} style={{
                        background: bk.accentColor,
                        border: `1px solid ${bk.color}22`,
                        borderRadius: 'var(--radius)',
                        padding: '12px 14px',
                      }}>
                        <div style={{ fontSize: 10, color: bk.color, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>{s.label.toUpperCase()}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brown)' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    background: 'linear-gradient(135deg, var(--cream-mid), var(--parchment))',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px 22px',
                    border: '1px solid var(--cream-dark)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                  }}>
                    <span style={{ fontSize: 28 }}>🙏</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--brown)', marginBottom: 6, fontSize: 16 }}>How to Read</div>
                      <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.7, margin: 0 }}>
                        Begin with the <strong>Chapters</strong> tab to explore the structure of this scripture.
                        Then visit <strong>Key Verses</strong> to discover celebrated shlokas with their translations
                        and significance. Recite with devotion — even one verse read sincerely is considered sacred.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* CHAPTERS */}
              {activeTab === 'chapters' && (
                <div style={{ animation: 'fadeUp 0.25s ease' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 20,
                  }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--brown)' }}>
                      {bk.chapters} {bk.id === 'ramayana' ? 'Kandas' : bk.id === 'mahabharata' ? 'Parvas' : 'Chapters'}
                    </h3>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click to expand</span>
                  </div>
                  {bk.chapters_data.map(ch => (
                    <ChapterRow
                      key={ch.num}
                      ch={ch}
                      isOpen={openChapter === ch.num}
                      onClick={() => setOpenChapter(openChapter === ch.num ? null : ch.num)}
                      bookColor={bk.color}
                    />
                  ))}
                </div>
              )}

              {/* KEY VERSES */}
              {activeTab === 'verses' && (
                <div style={{ animation: 'fadeUp 0.25s ease' }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--brown)', marginBottom: 4 }}>
                      Featured Shlokas
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Celebrated verses with English translation. Click "Show Sanskrit" to reveal the original.
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {bk.verses_sample.map((v, i) => (
                      <VerseCard key={i} v={v} bookColor={bk.color} accent={bk.accentColor} />
                    ))}
                  </div>
                  <div style={{
                    marginTop: 24,
                    padding: '16px 18px',
                    background: 'var(--cream-mid)',
                    borderRadius: 'var(--radius)',
                    fontSize: 13,
                    color: 'var(--text-light)',
                    lineHeight: 1.6,
                    textAlign: 'center',
                  }}>
                    These are curated key verses for study. Full text of all {bk.verses.toLocaleString()} verses
                    is available in traditional printed editions and through Gitapress, Gita.org, and Vedabase.
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
      <Footer />

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: minmax(220px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}