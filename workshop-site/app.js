(function () {
  const STORAGE_KEY = "splunk-workshop-theme";
  const toast = document.getElementById("toast");
  const navLinks = document.querySelectorAll(".sidebar-tree__link[data-step]");
  const progressBar = document.getElementById("progressBar");
  const themeToggle = document.getElementById("themeToggle");
  const html = document.documentElement;

  /* ---- Theme (light / dark / auto) ---- */
  function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(mode) {
    const resolved = mode === "auto" ? getSystemTheme() : mode;
    html.setAttribute("data-theme", resolved);
    html.setAttribute("data-theme-mode", mode);
    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        mode === "dark" ? "Switch to light mode" : mode === "light" ? "Switch to dark mode" : "Theme: auto (system)"
      );
    }
  }

  function cycleTheme() {
    const order = ["auto", "light", "dark"];
    const current = localStorage.getItem(STORAGE_KEY) || "auto";
    const next = order[(order.indexOf(current) + 1) % order.length];
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  const saved = localStorage.getItem(STORAGE_KEY) || "auto";
  applyTheme(saved);

  if (themeToggle) themeToggle.addEventListener("click", cycleTheme);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if ((localStorage.getItem(STORAGE_KEY) || "auto") === "auto") applyTheme("auto");
  });

  /* ---- Copy buttons ---- */
  document.querySelectorAll(".btn-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-copy");
      const el = document.getElementById(id);
      if (!el) return;
      const text = el.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard");
      } catch {
        showToast("Select and copy manually");
      }
    });
  });

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
  }

  /* ---- Sidebar active section ---- */
  const sections = [...navLinks]
    .map((link) => {
      const id = link.getAttribute("href")?.slice(1);
      const section = id ? document.getElementById(id) : null;
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const match = sections.find((s) => s.section === entry.target);
          if (match) setActive(match.link);
        }
      });
    },
    { rootMargin: "-22% 0px -58% 0px", threshold: 0 }
  );

  sections.forEach(({ section }) => observer.observe(section));

  function setActive(activeLink) {
    navLinks.forEach((l) => {
      const on = l === activeLink;
      l.classList.toggle("is-active", on);
      l.setAttribute("aria-current", on ? "true" : "false");
    });
    const tocLinks = document.querySelectorAll(".toc__link");
    tocLinks.forEach((l) => l.classList.remove("is-active"));
  }

  if (sections.length) setActive(sections[0].link);

  /* ---- On-this-page TOC ---- */
  const tocNav = document.getElementById("tocNav");
  if (tocNav) {
    const headings = document.querySelectorAll(".prose h2, .prose h3");
    headings.forEach((h) => {
      if (!h.id) h.id = h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const a = document.createElement("a");
      a.href = `#${h.id}`;
      a.className = `toc__link toc__link--${h.tagName.toLowerCase()}`;
      a.textContent = h.textContent;
      tocNav.appendChild(a);
    });

    const tocObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            document.querySelectorAll(".toc__link").forEach((l) => {
              l.classList.toggle("is-active", l.getAttribute("href") === `#${id}`);
            });
          }
        });
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 }
    );
    headings.forEach((h) => tocObserver.observe(h));
  }

  /* ---- Reading progress ---- */
  function updateProgress() {
    if (!progressBar) return;
    const doc = document.documentElement;
    const scrollTop = doc.scrollTop || document.body.scrollTop;
    const height = doc.scrollHeight - doc.clientHeight;
    progressBar.style.width = height > 0 ? `${(scrollTop / height) * 100}%` : "0%";
  }
  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  /* ---- Feature flag demo controls (set true to re-enable) ---- */
  const DEMO_CONTROLS_ENABLED = false;
  const isLocalLab =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const API_BASE = isLocalLab ? "http://localhost:8080/api" : "";
  const ADMIN_EMAIL = "admin@bank.demo";
  const ADMIN_PASSWORD = "Demo1234!";
  const FLAG_CACHE_MS = 3500;

  let adminToken = null;
  let tokenFetchedAt = 0;

  async function getAdminToken() {
    if (adminToken && Date.now() - tokenFetchedAt < 10 * 60 * 1000) return adminToken;
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!res.ok) throw new Error("Could not log in as admin — is the platform running?");
    const data = await res.json();
    adminToken = data.accessToken;
    tokenFetchedAt = Date.now();
    return adminToken;
  }

  async function fetchFlags(token) {
    const res = await fetch(`${API_BASE}/admin/feature-flags`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to load feature flags");
    const data = await res.json();
    return data.data || [];
  }

  async function setFlag(token, key, enabled) {
    const res = await fetch(`${API_BASE}/admin/feature-flags/${key}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update ${key}`);
    }
    return res.json();
  }

  function syncSelects(value) {
    document.querySelectorAll(".flag-demo__select").forEach((sel) => {
      sel.value = value;
    });
  }

  function updateFlagUI(flags) {
    const active = flags.filter((f) => f.enabled);
    const on = active.length > 0;
    const label = on ? `${active.length} active` : "Errors off";

    document.querySelectorAll("[id^='flagDemoStatus']").forEach((el) => {
      el.textContent = on ? `Errors ON (${active.map((f) => f.key.replace("fail_", "").replace("_insert", "")).join(", ")})` : label;
      el.classList.toggle("flag-demo__badge--ok", !on);
      el.classList.toggle("flag-demo__badge--danger", on);
    });
  }

  function setFlagMessage(msg, isError) {
    document.querySelectorAll(".flag-demo__message").forEach((el) => {
      el.textContent = msg;
      el.classList.toggle("flag-demo__message--error", Boolean(isError));
    });
  }

  async function refreshFlagState() {
    const token = await getAdminToken();
    const flags = await fetchFlags(token);
    updateFlagUI(flags);
    return flags;
  }

  async function triggerErrors(flagKey) {
    setFlagMessage("Enabling failure flag…");
    const token = await getAdminToken();
    await setFlag(token, flagKey, true);
    await new Promise((r) => setTimeout(r, FLAG_CACHE_MS));
    const flags = await refreshFlagState();
    syncSelects(flagKey);
    setFlagMessage(
      `Errors triggered (${flagKey}). Try the matching action in the app — e.g. a transfer for transaction failures.`
    );
    showToast("Failure injection enabled");
    return flags;
  }

  async function clearErrors() {
    setFlagMessage("Disabling all failure flags…");
    const token = await getAdminToken();
    const flags = await fetchFlags(token);
    const enabled = flags.filter((f) => f.enabled);
    await Promise.all(enabled.map((f) => setFlag(token, f.key, false)));
    if (enabled.length) await new Promise((r) => setTimeout(r, FLAG_CACHE_MS));
    await refreshFlagState();
    setFlagMessage("All errors turned off. Operations should work normally again.");
    showToast("Errors turned off");
  }

  function bindFlagDemoPanel({ triggerId, clearId, selectId }) {
    const triggerBtn = document.getElementById(triggerId);
    const clearBtn = document.getElementById(clearId);
    const select = document.getElementById(selectId);
    if (!triggerBtn || !clearBtn) return;

    triggerBtn.addEventListener("click", async () => {
      if (!isLocalLab) return;
      triggerBtn.disabled = true;
      clearBtn.disabled = true;
      try {
        await triggerErrors(select?.value || "fail_transaction_insert");
      } catch (err) {
        setFlagMessage(err.message || "Something went wrong", true);
        showToast("Action failed — check platform is running");
      } finally {
        triggerBtn.disabled = false;
        clearBtn.disabled = false;
      }
    });

    clearBtn.addEventListener("click", async () => {
      if (!isLocalLab) return;
      triggerBtn.disabled = true;
      clearBtn.disabled = true;
      try {
        await clearErrors();
      } catch (err) {
        setFlagMessage(err.message || "Something went wrong", true);
        showToast("Action failed — check platform is running");
      } finally {
        triggerBtn.disabled = false;
        clearBtn.disabled = false;
      }
    });

    if (select) {
      select.addEventListener("change", () => syncSelects(select.value));
    }
  }

  bindFlagDemoPanel({
    triggerId: "flagDemoTrigger",
    clearId: "flagDemoClear",
    selectId: "flagDemoSelect",
  });
  bindFlagDemoPanel({
    triggerId: "flagDemoTriggerStep4",
    clearId: "flagDemoClearStep4",
    selectId: "flagDemoSelectStep4",
  });

  if (DEMO_CONTROLS_ENABLED) {
    document.querySelectorAll(".flag-demo").forEach((panel) => {
      panel.hidden = false;
    });

    refreshFlagState().catch(() => {
      if (!isLocalLab) {
        setFlagMessage(
          "Live controls require the local stack (http://localhost:8080). Clone the repo and run docker compose up.",
          true
        );
        document.querySelectorAll(".flag-demo button").forEach((btn) => {
          btn.disabled = true;
        });
        return;
      }
      setFlagMessage("Platform not reachable — start Docker Compose or Minikube first.", true);
    });
  }

  /* ---- Deploy path tabs ---- */
  document.querySelectorAll("[data-deploy-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-deploy-tab");
      document.querySelectorAll(".deploy-tab").forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      document.querySelectorAll(".deploy-panel").forEach((panel) => {
        const active = panel.id === `deploy-${target}`;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    });
  });
})();
