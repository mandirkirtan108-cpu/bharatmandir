import { useEffect, useRef } from 'react';
import i18n from '../i18n';
import { useLang } from '../LangContext';
import { translateStaticText } from '../services/siteTranslations';
import { translateTextBatch } from '../services/translationApi';

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'TEXTAREA',
  'OPTION',
]);

const ATTRS = ['placeholder', 'title', 'aria-label'];
const originalText = new WeakMap();
const originalAttrs = new WeakMap();

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function shouldSkipText(text) {
  const value = normalize(text);
  if (!value || value.length < 2 || value.length > 1500) return true;
  if (/^[\d\s:.,/+()₹$%-]+$/.test(value)) return true;
  if (/^https?:\/\/\S+|\S+@\S+\.\S+$/.test(value)) return true;
  return !/[A-Za-z]/.test(value);
}

function shouldSkipNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.closest('[data-no-auto-translate="true"]')) return true;
  if (parent.closest('input, textarea, select')) return true;
  return false;
}

function getOriginalText(node) {
  if (!originalText.has(node)) originalText.set(node, node.nodeValue);
  return originalText.get(node);
}

function getOriginalAttr(el, attr) {
  let store = originalAttrs.get(el);
  if (!store) {
    store = {};
    originalAttrs.set(el, store);
  }
  if (!store[attr]) store[attr] = el.getAttribute(attr);
  return store[attr];
}

function collectTextNodes(root) {
  if (!root) return [];
  if (root.nodeType === Node.TEXT_NODE) return shouldSkipNode(root) ? [] : [root];
  if (root.nodeType !== Node.ELEMENT_NODE && root !== document.body) return [];

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return shouldSkipNode(node)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

function collectAttrElements(root) {
  if (!root || (root.nodeType !== Node.ELEMENT_NODE && root !== document.body)) return [];
  const elements = [];
  if (root.nodeType === Node.ELEMENT_NODE) elements.push(root);
  root.querySelectorAll?.('[placeholder], [title], [aria-label]').forEach(el => elements.push(el));
  return elements.filter(el => !SKIP_TAGS.has(el.tagName) && !el.closest('[data-no-auto-translate="true"]'));
}

function applyImmediate(root, lang) {
  const remoteItems = [];

  for (const node of collectTextNodes(root)) {
    const source = getOriginalText(node);
    if (lang === 'en') {
      if (node.nodeValue !== source) node.nodeValue = source;
      continue;
    }

    const local = translateStaticText(source, lang);
    if (node.nodeValue !== local) node.nodeValue = local;
    if (local === source && !shouldSkipText(source)) {
      remoteItems.push({ type: 'text', target: node, source: normalize(source) });
    }
  }

  for (const el of collectAttrElements(root)) {
    for (const attr of ATTRS) {
      if (!el.hasAttribute(attr)) continue;
      const source = getOriginalAttr(el, attr);
      if (lang === 'en') {
        if (el.getAttribute(attr) !== source) el.setAttribute(attr, source);
        continue;
      }

      const local = translateStaticText(source, lang);
      if (el.getAttribute(attr) !== local) el.setAttribute(attr, local);
      if (local === source && !shouldSkipText(source)) {
        remoteItems.push({ type: 'attr', target: el, attr, source: normalize(source) });
      }
    }
  }

  return remoteItems;
}

export default function LanguageBridge() {
  const { lang } = useLang();
  const queueRef = useRef([]);
  const timerRef = useRef(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    const safeLang = lang === 'hi' ? 'hi' : 'en';
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    document.documentElement.lang = safeLang;
    document.documentElement.dir = 'ltr';
    if (i18n.language !== safeLang) i18n.changeLanguage(safeLang);

    const flushQueue = async () => {
      const items = queueRef.current.splice(0, 80);
      if (items.length === 0 || safeLang !== 'hi' || runIdRef.current !== runId) return;

      const texts = [...new Set(items.map(item => item.source))];
      let translations = {};
      try {
        translations = await translateTextBatch(texts, safeLang);
      } catch {
        return;
      }

      if (runIdRef.current !== runId) return;
      for (const item of items) {
        const translated = translations[item.source];
        if (!translated || translated === item.source) continue;

        if (item.type === 'text') {
          if (originalText.get(item.target) && normalize(originalText.get(item.target)) === item.source) {
            item.target.nodeValue = translated;
          }
        } else if (item.type === 'attr') {
          const source = getOriginalAttr(item.target, item.attr);
          if (normalize(source) === item.source) item.target.setAttribute(item.attr, translated);
        }
      }

      if (queueRef.current.length > 0) {
        timerRef.current = setTimeout(flushQueue, 120);
      }
    };

    const enqueue = (items) => {
      if (safeLang !== 'hi') return;
      queueRef.current.push(...items);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flushQueue, 220);
    };

    queueRef.current = [];
    enqueue(applyImmediate(document.body, safeLang));

    const observer = new MutationObserver((mutations) => {
      const items = [];
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          items.push(...applyImmediate(mutation.target, safeLang));
        }
        if (mutation.type === 'attributes') {
          items.push(...applyImmediate(mutation.target, safeLang));
        }
        mutation.addedNodes.forEach(node => {
          items.push(...applyImmediate(node, safeLang));
        });
      }
      enqueue(items);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });

    const rerunNow = () => {
      queueRef.current = [];
      enqueue(applyImmediate(document.body, safeLang));
    };
    window.addEventListener('bharatmandir:language-change', rerunNow);

    return () => {
      observer.disconnect();
      window.removeEventListener('bharatmandir:language-change', rerunNow);
      clearTimeout(timerRef.current);
      queueRef.current = [];
    };
  }, [lang]);

  return null;
}
