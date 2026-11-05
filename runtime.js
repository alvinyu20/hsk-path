/* A tiny template runtime for Shanlu.
 *
 * The screens are written as HTML in index.html with {{holes}}, <sc-if> and <sc-for>.
 * A component class provides state, setState and renderVals(); this file turns the template plus
 * those values into HTML and patches the page with morphdom, so inputs keep focus and CSS transitions
 * (like the card flip) keep playing between updates.
 */
(function () {
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    const parts = path.split('.');
    let v = scope[parts[0]];
    for (let i = 1; i < parts.length; i++) {
      if (v === null || v === undefined) return undefined;
      v = v[parts[i]];
    }
    return v;
  }

  function holeValue(str, scope) {
    const m = WHOLE.exec(str || '');
    return m ? lookup(m[1], scope) : undefined;
  }

  function interp(str, scope) {
    return str.replace(HOLE, (m, p) => {
      const v = lookup(p, scope);
      return v === null || v === undefined || v === false ? '' : String(v);
    });
  }

  function renderNodes(nodes, scope, ctx, out) {
    for (const n of nodes) {
      if (n.nodeType === 3) { out.push(esc(interp(n.nodeValue, scope))); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toLowerCase();
      if (tag === 'sc-if') {
        if (holeValue(n.getAttribute('value'), scope)) renderNodes(n.childNodes, scope, ctx, out);
        continue;
      }
      if (tag === 'sc-for') {
        const list = holeValue(n.getAttribute('list'), scope) || [];
        const as = n.getAttribute('as');
        list.forEach((item, i) => {
          const sc = Object.create(scope);
          sc[as] = item;
          sc.$index = i;
          renderNodes(n.childNodes, sc, ctx, out);
        });
        continue;
      }
      out.push('<' + tag);
      for (const a of Array.from(n.attributes)) {
        const name = a.name;
        if (name.indexOf('hint-') === 0) continue;
        // handlers are written as data-on-click="{{fn}}" (not onClick=): a real on* attribute counts as an inline script, which the
        // page's security policy forbids and newer Chrome reports for every one of them, even inside a <template>
        if (name.indexOf('data-on-') === 0) {
          const fn = holeValue(a.value, scope);
          if (typeof fn === 'function') {
            ctx.handlers.push(fn);
            out.push(' ' + name + '="' + (ctx.handlers.length - 1) + '"');
          }
          continue;
        }
        const whole = WHOLE.exec(a.value);
        let val;
        if (whole) {
          const v = lookup(whole[1], scope);
          if (v === null || v === undefined || v === false) continue;
          val = String(v);
        } else {
          val = interp(a.value, scope);
        }
        out.push(' ' + name + '="' + esc(val) + '"');
      }
      out.push('>');
      if (!VOID.has(tag)) {
        renderNodes(n.childNodes, scope, ctx, out);
        out.push('</' + tag + '>');
      }
    }
  }

  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
      this._queued = false;
      this._mount = null;
    }
    setState(patch) {
      if (typeof patch === 'function') patch = patch(this.state);
      this.state = Object.assign({}, this.state, patch);
      this._schedule();
    }
    _schedule() {
      if (!this._mount || this._queued) return;
      this._queued = true;
      Promise.resolve().then(() => { this._queued = false; this._render(); });
    }
    _render() {
      const m = this._mount;
      if (!m) return;
      const vals = this.renderVals();
      const ctx = { handlers: [] };
      const out = [];
      renderNodes(m.template.content.childNodes, vals, ctx, out);
      m.handlers = ctx.handlers;
      const next = document.createElement('div');
      next.innerHTML = out.join('');
      if (!m.rendered) {
        m.root.innerHTML = next.innerHTML;
        m.rendered = true;
      } else {
        morphdom(m.root, next, {
          childrenOnly: true,
          onBeforeElUpdated: (from, to) => !from.isEqualNode(to)
        });
      }
    }
  }

  function mount(root, template, Component, props) {
    const inst = new Component(props);
    const m = { root, template, handlers: [], rendered: false };
    inst._mount = m;
    ['click', 'input', 'keydown'].forEach(type => {
      root.addEventListener(type, e => {
        const el = e.target.closest ? e.target.closest('[data-on-' + type + ']') : null;
        if (!el || !root.contains(el)) return;
        const fn = m.handlers[Number(el.getAttribute('data-on-' + type))];
        if (typeof fn === 'function') fn(e);
      });
    });
    inst._render();
    return inst;
  }

  window.DCLogic = DCLogic;
  window.DCMount = mount;
})();
