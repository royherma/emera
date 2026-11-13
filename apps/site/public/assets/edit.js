(() => {
  const page = location.pathname;
  const els = [...document.querySelectorAll("[data-e]")];
  const saved = new Map();
  const originals = new Map();
  let on = false;
  let drafts = 0;
  let orphans = [];
  try { on = new URLSearchParams(location.search).has("edit") || sessionStorage.getItem("em_edit") === "1"; } catch {}

  const css = document.createElement("style");
  css.textContent = `
  .em-on [data-e]{cursor:text;border-radius:4px;transition:outline-color .15s}
  .em-on [data-e]:hover{outline:2px dashed rgba(255,138,43,.75);outline-offset:3px}
  .em-on [data-e]:focus{outline:2px solid #ff8a2b;outline-offset:3px;background:rgba(255,138,43,.08)}
  .em-on [data-e][data-em-draft]{outline:2px dotted #ff8a2b;outline-offset:3px}
  #em-bar{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:8px;padding:8px 8px 8px 16px;border-radius:999px;background:#17120e;color:#fbf3e8;font:500 14px/1 "DM Sans",system-ui,sans-serif;box-shadow:0 16px 40px -12px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08);white-space:nowrap;max-width:calc(100vw - 32px)}
  #em-bar button{all:unset;cursor:pointer;padding:10px 16px;border-radius:999px;font:600 14px/1 "DM Sans",system-ui,sans-serif;background:rgba(255,255,255,.08);color:#fbf3e8}
  #em-bar button:hover{background:rgba(255,255,255,.16)}
  #em-bar button.go{background:#ff8a2b;color:#1a0f05}
  #em-bar button.go:hover{background:#ffa152}
  #em-bar button[disabled]{opacity:.4;pointer-events:none}
  #em-bar .msg{color:#bcae9d;overflow:hidden;text-overflow:ellipsis}
  #em-bar .msg b{color:#ffc24a;font-weight:600}`;
  document.head.appendChild(css);

  const bar = document.createElement("div");
  bar.id = "em-bar";
  document.body.appendChild(bar);

  const api = (path, body) =>
    fetch(`/api/copy${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body && JSON.stringify(body), credentials: "same-origin" }).then((r) => r.json());

  let flash = "";
  let flashTimer;
  const say = (text) => {
    flash = text;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flash = ""; render(); }, 1800);
    render();
  };

  function render() {
    document.documentElement.classList.toggle("em-on", on);
    for (const el of els) el.contentEditable = on ? "true" : "false";
    const waiting = drafts ? `<b>${drafts} change${drafts === 1 ? "" : "s"}</b> not live yet` : "Everything is live";
    const lost = orphans.length ? ` · ${orphans.length} old edit${orphans.length === 1 ? "" : "s"} no longer on the page` : "";
    if (!on) {
      bar.innerHTML = `<span class="msg">${drafts ? waiting : ""}</span><button data-a="edit" class="go">Edit page</button>`;
      if (!drafts) bar.querySelector(".msg").remove();
    } else {
      bar.innerHTML = `<span class="msg" title="${orphans.map((o) => o.replace(/"/g, "&quot;")).join("\n")}">${flash || (waiting + lost)}</span>
        <button data-a="publish" class="go"${drafts ? "" : " disabled"}>Publish</button>
        <button data-a="discard"${drafts ? "" : " disabled"}>Undo all</button>
        <button data-a="done">Done</button>`;
    }
  }

  async function save(el) {
    const key = el.dataset.e;
    const html = el.innerHTML.trim();
    if (html === saved.get(key)) return;
    saved.set(key, html);
    const r = await api("/save", { page, key, html, original: originals.get(key) }).catch(() => null);
    if (!r?.ok) return say(`Not saved: ${r?.error || "network"}`);
    drafts = r.drafts;
    if (html === originals.get(key)) el.removeAttribute("data-em-draft");
    else el.setAttribute("data-em-draft", "");
    say("Saved as draft");
  }

  async function load() {
    const r = await api("").catch(() => null);
    const rows = r?.ok ? r.rows : [];
    const mine = new Map(rows.filter((x) => x.page === page.replace(/\/+$/, "") || (page === "/" && x.page === "/")).map((x) => [x.key, x]));
    for (const el of els) {
      const html = el.innerHTML.trim();
      const row = mine.get(el.dataset.e);
      saved.set(el.dataset.e, html);
      originals.set(el.dataset.e, row?.original ?? html);
      if (row?.draft != null) el.setAttribute("data-em-draft", "");
    }
    const present = new Set(els.map((el) => el.dataset.e));
    orphans = [...mine.values()].filter((x) => !present.has(x.key)).map((x) => (x.draft ?? x.live ?? "").replace(/<[^>]*>/g, "").slice(0, 80));
    drafts = r?.drafts || 0;
    render();
  }

  bar.addEventListener("click", async (e) => {
    const a = e.target.closest("button")?.dataset.a;
    if (!a) return;
    if (a === "edit" || a === "done") {
      on = a === "edit";
      try { sessionStorage.setItem("em_edit", on ? "1" : "0"); } catch {}
      if (!on) document.activeElement?.blur?.();
      return render();
    }
    if (a === "publish") {
      const r = await api("/publish", {}).catch(() => null);
      if (!r?.ok) return say(`Not published: ${r?.error || "network"}`);
      drafts = 0;
      els.forEach((el) => el.removeAttribute("data-em-draft"));
      return say(`Live now: ${r.published} change${r.published === 1 ? "" : "s"}`);
    }
    if (a === "discard") {
      if (!confirm(`Undo ${drafts} change${drafts === 1 ? "" : "s"} that are not live yet?`)) return;
      const r = await api("/discard", {}).catch(() => null);
      if (r?.ok) location.reload();
    }
  });

  document.addEventListener("click", (e) => {
    if (!on || bar.contains(e.target)) return;
    if (e.target.closest("a,button,label,summary")) e.preventDefault();
  }, true);
  document.addEventListener("submit", (e) => { if (on) e.preventDefault(); }, true);
  document.addEventListener("focusout", (e) => { if (on && e.target.dataset?.e) save(e.target); });
  document.addEventListener("keydown", (e) => {
    const el = e.target;
    if (!on || !el.dataset?.e) return;
    if (e.key === "Escape") {
      el.innerHTML = saved.get(el.dataset.e);
      el.blur();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      el.blur();
    }
  });
  document.addEventListener("paste", (e) => {
    if (!on || !e.target.closest?.("[data-e]")) return;
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  });

  render();
  load();
})();
