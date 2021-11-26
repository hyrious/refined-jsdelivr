// ==UserScript==
// @name        Refined jsDelivr
// @namespace   hyrious.jsdelivr.refined
// @downloadURL https://cdn.jsdelivr.net/gh/hyrious/refined-jsdelivr@main/refined-jsdelivr.user.js
// @match       *://cdn.jsdelivr.net/*
// @require     https://cdn.jsdelivr.net/npm/marked@latest/marked.min.js
// @require     https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/highlight.min.js
// @require     https://cdn.jsdelivr.net/npm/terser@latest/dist/bundle.min.js
// @grant       none
// @version     0.1.5
// @author      hyrious
// @run-at      document-start
// @description Adds syntax highlight and markdown rendering to jsDelivr CDN links.
// ==/UserScript==
;(async () => {
  const Features = {
    markdown: true,
    highlight: true,
    terser: false, // TODO: move to worker
  };

  const _ = document;
  const $ = e => _.querySelector(e);
  const $$ = e => [..._.querySelectorAll(e)];
  const h = (t, a = {}) => Object.assign(document.createElement(t), a);
  const byteLength = s => new TextEncoder().encode(s).byteLength;
  const loaded = new Promise((resolve) => {
    if (document.readyState === "loading") {
      document.addEventListener('DOMContentLoaded', resolve)
    } else {
      resolve()
    }
  })

  let ext = location.pathname.match(/\.([^.]+)$/);
  ext && (ext = ext[1]);

  if (ext === 'map') ext = 'json';

  let executed = new Map()
  function once(fn) {
    if (executed.has(fn)) return executed.get(fn);
    const result = fn();
    executed.set(fn, result);
    return result;
  }

  Features.markdown  && applyMarkdown();
  Features.highlight && applyHighlight();
  Features.terser    && applyTerser();

  async function applyMarkdown() {
    if (!['md', 'markdown'].includes(ext)) return;

    const href = 'https://cdn.jsdelivr.net/gh/hyrious/github-markdown-css@main/github-markdown.css';
    _.head.append(h('link', { rel: 'stylesheet', href }));

    await loaded;
    const pre = once(ensurePRE);
    if (!pre) return;

    marked.setOptions({
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      }
    });

    const article = h('article', { innerHTML: marked.marked(pre.textContent) });
    article.classList.add('markdown-body');
    article.style.cssText = `
      padding: 1em;
      max-width: 42em;
      margin: 0 auto;
    `;
    pre.style.display = 'none';
    _.body.classList.add('markdown-body');
    _.body.append(article);
  }

  async function applyHighlight() {
    await loaded;
    const pre = once(ensurePRE);
    if (!pre) return;

    // if the code is larger than 50 KB, don't render
    if (pre.textContent.length > 50 * 1000) return;

    const href = matchMedia('(prefers-color-scheme: dark)').matches
      ? 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/github-dark.min.css'
      : 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.2.0/build/styles/github.min.css';
    _.head.append(h('link', { rel: 'stylesheet', href }));

    pre.classList.add(`language-${ext}`);
    hljs.highlightElement(pre);
  }

  async function applyTerser() {
    await loaded;

    let count = 0;
    const { default: prettyBytes } = await import("https://jspm.dev/pretty-bytes");
    for (const tr of $$('tbody tr')) {

      let name = tr.querySelector('td.name');
      let size = tr.querySelector('td.size');
      let exts = '.js .mjs .cjs'.split(' ');

      if (exts.some(e => name.textContent.trimEnd().endsWith(e))) {
        const url = name.querySelector('a').href;

        (async () => {
          try {
            let code =  await fetch(url).then(r => r.text());
            // if the code is larger than 1 MB, don't calc
            if (code.length > 1000 * 1000) return;
            let min = await Terser.minify(code);
            size.append(` (terser: ${prettyBytes(byteLength(min.code))})`);
          } catch {}
        })();

        if (count++ >= 10) break;
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
