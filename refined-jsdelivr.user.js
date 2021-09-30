// ==UserScript==
// @name        Refined jsDelivr
// @namespace   hyrious.jsdelivr.refined
// @match       *://cdn.jsdelivr.net/*
// @require     https://cdn.jsdelivr.net/npm/marked@latest/marked.min.js
// @require     https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/highlight.min.js
// @require     https://cdn.jsdelivr.net/npm/terser@latest/dist/bundle.min.js
// @grant       none
// @version     0.1.0
// @author      hyrious
// @description Adds syntax highlight and markdown rendering to jsDelivr CDN links.
// ==/UserScript==
;(async () => {
  const Features = {
    markdown: true,
    highlight: true,
    terser: true,
  };

  const _ = document;
  const $ = e => _.querySelector(e);
  const $$ = e => [..._.querySelectorAll(e)];
  const h = (t, a = {}) => Object.assign(document.createElement(t), a);
  Array.prototype.last = function() { return this[this.length - 1]; };
  const terser = (s) => (new TextEncoder().encode(Terser.minify(s).code)).byteLength;
  const { default: prettyBytes } = await import("https://jspm.dev/pretty-bytes");
  let ext = location.pathname.match(/\.([^.]+)$/);
  ext && (ext = ext[1]);

  let executed = new Map()
  function once(fn) {
    if (executed.has(fn)) return executed.get(fn);
    const result = fn();
    executed.set(fn, result);
    return result;
  }

  if (Features.markdown) {
    applyMarkdown();
  }
  if (Features.highlight) {
    applyHighlight();
  }
  if (Features.terser) {
    applyTerser();
  }

  function applyMarkdown() {
    const pre = once(ensurePRE);
    if (!pre) return;

    if (!['md', 'markdown'].includes(ext)) return;

    const href = 'https://cdn.jsdelivr.net/gh/hyrious/github-markdown-css@main/github-markdown.css';
    _.head.append(h('link', { rel: 'stylesheet', href }));

    marked.setOptions({
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      }
    });

    const article = h('article', { innerHTML: marked(pre.textContent) });
    article.classList.add('markdown-body');
    article.style.cssText = `
      padding: 1em;
      max-width: 42em;
      margin: 0 auto;
    `;
    pre.style.display = 'none';
    _.body.append(article);
  }

  function applyHighlight() {
    const pre = once(ensurePRE);
    if (!pre) return;

    // if the code is larger than 10 KB, don't render
    if (pre.textContent.length > 10 * 1000) return;

    const href = matchMedia('(prefers-color-scheme: dark)').matches
      ? 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/github-dark.min.css'
      : 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/github.min.css';
    _.head.append(h('link', { rel: 'stylesheet', href }));

    pre.classList.add(`language-${ext}`);
    hljs.highlightElement(pre);
  }

  function applyTerser() {
    let count = 0;
    for (const tr of $$('tbody tr')) {
      if (count++ >= 10) break;

      let name = tr.querySelector('td.name');
      let size = tr.querySelector('td.size');
      let exts = '.js .mjs .cjs'.split(' ');

      if (exts.some(e => name.textContent.trimEnd().endsWith(e))) {
        const url = name.querySelector('a').href;

        (async () => {
          try {
            let code =  await fetch(url).then(r => r.text());
            let min = await Terser.minify(code);
            size.append(` (terser: ${prettyBytes(min.code.length)})`);
          } catch {}
        })();
      }
    }
  }

  function ensurePRE() {
    // make sure it is in source code page, i.e. there's <pre>
    const pre = $('pre');
    if (!pre || !pre.textContent) return;
    pre.style.margin = '0';
    pre.style.padding = '1em';
    _.head.append(h('meta', { name: 'color-scheme', content: 'light dark' }));
    _.body.style.margin = '0';
    return pre;
  }
})();
