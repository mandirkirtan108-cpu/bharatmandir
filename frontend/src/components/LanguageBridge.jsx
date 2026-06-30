import { useEffect } from 'react';
import i18n from '../i18n';
import { useLang } from '../LangContext';
import { translateStaticText } from '../services/siteTranslations';

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

function shouldSkipNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.closest('[data-no-auto-translate="true"]')) return true;
  return false;
}

function translateTextNode(node, lang) {
  if (shouldSkipNode(node)) return;

  if (!originalText.has(node)) originalText.set(node, node.nodeValue);
  const source = originalText.get(node);
  const translated = translateStaticText(source, lang);
  if (node.nodeValue !== translated) node.nodeValue = translated;
}

function translateAttributes(el, lang) {
  if (!el || SKIP_TAGS.has(el.tagName)) return;
  if (el.closest?.('[data-no-auto-translate="true"]')) return;

  let attrStore = originalAttrs.get(el);
  if (!attrStore) {
    attrStore = {};
    originalAttrs.set(el, attrStore);
  }

  for (const attr of ATTRS) {
    if (!el.hasAttribute(attr)) continue;
    if (!attrStore[attr]) attrStore[attr] = el.getAttribute(attr);
    const translated = translateStaticText(attrStore[attr], lang);
    if (el.getAttribute(attr) !== translated) el.setAttribute(attr, translated);
  }
}

function translateTree(root, lang) {
  if (!root) return;

  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, lang);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root !== document.body) return;

  translateAttributes(root, lang);

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

  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(node => translateTextNode(node, lang));

  root.querySelectorAll?.('[placeholder], [title], [aria-label]').forEach(el => {
    translateAttributes(el, lang);
  });
}

export default function LanguageBridge() {
  const { lang } = useLang();

  useEffect(() => {
    const safeLang = lang === 'hi' ? 'hi' : 'en';
    document.documentElement.lang = safeLang;
    document.documentElement.dir = 'ltr';
    if (i18n.language !== safeLang) i18n.changeLanguage(safeLang);

    translateTree(document.body, safeLang);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target, safeLang);
        }
        if (mutation.type === 'attributes') {
          translateAttributes(mutation.target, safeLang);
        }
        mutation.addedNodes.forEach(node => translateTree(node, safeLang));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });

    return () => observer.disconnect();
  }, [lang]);

  return null;
}
