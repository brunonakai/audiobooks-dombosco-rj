// ==================== PLAYER + WAVEFORM (Canvas) com Detector de Picos ====================

/* ============ CONFIG LOADER (JSON + ENV, por página) ============ */
async function pickConfigUrl() {
  // 1) Query param tem prioridade: ?config=assets/config/meu.json
  const usp = new URLSearchParams(location.search);
  const qp = usp.get("config");
  if (qp) return qp;

  // 2) Pelo nome do arquivo HTML (pagina1.html -> assets/config/pagina1.config.json)
  //    index.html -> assets/config/index.config.json (se existir) senão cai no app.config.json
  const file = (
    location.pathname.split("/").pop() || "index.html"
  ).toLowerCase();
  const base = file.replace(/\.html?$/i, ""); // "pagina1", "index"
  const candidate = `assets/config/${base}.config.json`;

  // testa se existe; se 404, usamos o app.config.json
  try {
    const head = await fetch(candidate, { method: "GET", cache: "no-store" });
    if (head.ok) return candidate;
  } catch (_) {}

  // 3) Fallback
  return "assets/config/app.config.json";
}

async function loadConfig() {
  const defaultCfg = {
    siteBaseUrl: window.location.origin + "/",
    // pode ser string OU objeto { src, download, title }
    audio: "assets/audio/fund1-alfabetizacao_com_significado.mp3",
    seo: {
      title: document.title || "Audiobook — Dom Bosco RJ",
      description:
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") || "",
      image: "assets/img/logo-colegio-db.png",
      canonical: window.location.href,
    },
    ui: {
      kicker: null,
      pageTitle: null,
      pageSubtitle: null,
      lead: null,
      trackTitle: null,
      sectionTitle: null,
    },
    links: {
      spotify: null,
      cta: null,
      download: null,
    },
  };

  let fileCfg = {};
  try {
    const cfgUrl = await pickConfigUrl();
    const res = await fetch(
      cfgUrl + (cfgUrl.includes("?") ? "&" : "?") + "v=" + Date.now(),
      { cache: "no-store" }
    );
    if (res.ok) fileCfg = await res.json();
  } catch (_) {}

  // sobrescritas opcionais em env.js (se houver)
  const envCfg =
    window.APP_ENV && typeof window.APP_ENV === "object" ? window.APP_ENV : {};

  // merge raso
  const cfg = structuredClone(defaultCfg);
  const shallowMerge = (target, src) => {
    Object.keys(src || {}).forEach((k) => {
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) {
        target[k] = { ...target[k], ...src[k] };
      } else if (src[k] != null) {
        target[k] = src[k];
      }
    });
  };
  shallowMerge(cfg, fileCfg);
  shallowMerge(cfg.seo, fileCfg.seo || {});
  shallowMerge(cfg.ui, fileCfg.ui || {});
  shallowMerge(cfg.links, fileCfg.links || {});

  shallowMerge(cfg, envCfg);
  shallowMerge(cfg.seo, envCfg.seo || {});
  shallowMerge(cfg.ui, envCfg.ui || {});
  shallowMerge(cfg.links, envCfg.links || {});

  applyConfig(cfg);
  return cfg;
}

function applyConfig(cfg) {
  // ---- UI (textos)
  const $kicker =
    document.querySelector(".kicker") || document.getElementById("kicker");
  if ($kicker && cfg.ui.kicker) $kicker.textContent = cfg.ui.kicker;

  const $title = document.getElementById("pageTitle");
  if ($title && cfg.ui.pageTitle) $title.textContent = cfg.ui.pageTitle;

  const $subtitle = document.getElementById("pageSubtitle");
  if ($subtitle && cfg.ui.pageSubtitle)
    $subtitle.textContent = cfg.ui.pageSubtitle;

  const $lead = document.querySelector(".lead");
  if ($lead && cfg.ui.lead) $lead.textContent = cfg.ui.lead;

  const $sectionTitle = document.querySelector(".section-title");
  if ($sectionTitle && cfg.ui.sectionTitle)
    $sectionTitle.textContent = cfg.ui.sectionTitle;

  const $trackTitle = document.getElementById("trackTitle");
  const audioObj =
    typeof cfg.audio === "object" && cfg.audio ? cfg.audio : null;
  const trackTitleText = cfg.ui.trackTitle || audioObj?.title || null;
  if ($trackTitle && trackTitleText) $trackTitle.textContent = trackTitleText;

  // ---- Áudio (src + download)
  let audioSrc = null,
    audioDownload = null;
  if (typeof cfg.audio === "string") {
    audioSrc = cfg.audio;
  } else if (audioObj) {
    audioSrc = audioObj.src || audioObj.url || audioObj.path || null;
    audioDownload = audioObj.download || null;
  }
  if (!audioDownload)
    audioDownload = (cfg.links && cfg.links.download) || audioSrc || null;

  const srcEl = document.getElementById("audioSource");
  const audioEl = document.getElementById("player");
  if (audioSrc && srcEl && audioEl) {
    srcEl.src = audioSrc;
    try {
      audioEl.load();
    } catch (_) {}
  }
  const $dl = document.getElementById("downloadLink");
  if ($dl && audioDownload) $dl.href = audioDownload;

  // ---- Links
  const spotifyBtn = document.getElementById("spotifyBtn");
  if (spotifyBtn && cfg.links?.spotify) spotifyBtn.href = cfg.links.spotify;

  const ctaEnroll = document.getElementById("ctaEnroll");
  if (ctaEnroll && cfg.links?.cta) ctaEnroll.href = cfg.links.cta;

  // ---- SEO / OpenGraph
  if (cfg.seo?.title) document.title = cfg.seo.title;
  const setMeta = (sel, attr, val) => {
    if (!val) return;
    let el = document.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      if (sel.includes("name="))
        el.setAttribute("name", sel.match(/name="(.+?)"/)[1]);
      else if (sel.includes("property="))
        el.setAttribute("property", sel.match(/property="(.+?)"/)[1]);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, val);
  };
  setMeta('meta[name="description"]', "content", cfg.seo.description);
  setMeta('meta[property="og:title"]', "content", cfg.seo.title);
  setMeta('meta[property="og:description"]', "content", cfg.seo.description);
  setMeta('meta[property="og:image"]', "content", cfg.seo.image);

  if (cfg.seo.canonical) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", cfg.seo.canonical);
  }

  // Notifica restante do app
  window.dispatchEvent(new CustomEvent("cfg:applied", { detail: cfg }));
}

document.addEventListener("DOMContentLoaded", () => {
  loadConfig().catch(() => {});
});
/* ============ /CONFIG LOADER ============ */

(() => {
  // ---------- DOM ----------
  const audio = document.getElementById("player");
  const playBtn = document.getElementById("playPause");
  const back15 = document.getElementById("back15");
  const fwd15 = document.getElementById("fwd15");
  const bar = document.getElementById("bar");
  const cur = document.getElementById("tCur");
  const dur = document.getElementById("tDur");
  const rateBtn = document.getElementById("rate");
  const volume = document.getElementById("volume");
  const shareBtn = document.getElementById("shareBtn");

  // Canvas / pulse
  const waveBox = document.querySelector(".wave");
  const cv = document.getElementById("wave");
  const ctx2d = cv.getContext("2d", { alpha: false });

  // ---------- Utils ----------
  const PROG_KEY = "db_audiobook_progress_v5";
  const LS_RATE = "db_rate";
  const LS_VOL = "db_volume";
  const LS_MUTED = "db_muted";

  const fmt = (t) => {
    if (!isFinite(t)) return "--:--";
    const m = Math.floor(t / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(t % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  // ---------- Preferências persistentes ----------
  const rates = [0.75, 1.0, 1.25, 1.5];
  let rIdx = Math.max(
    0,
    rates.indexOf(Number(localStorage.getItem(LS_RATE)) || 1)
  );
  if (!Number.isFinite(rIdx) || rIdx < 0) rIdx = 1;
  audio.playbackRate = rates[rIdx];
  const fmtRate = (r) => (r === 1 ? "1.00x" : r.toFixed(2) + "x");
  rateBtn.textContent = fmtRate(rates[rIdx]);

  const savedVol = localStorage.getItem(LS_VOL);
  if (savedVol !== null) audio.volume = Number(savedVol);
  volume.value = audio.volume;
  if (localStorage.getItem(LS_MUTED) === "1") audio.muted = true;

  rateBtn.addEventListener("click", () => {
    rIdx = (rIdx + 1) % rates.length;
    audio.playbackRate = rates[rIdx];
    rateBtn.textContent = fmtRate(rates[rIdx]);
    localStorage.setItem(LS_RATE, rates[rIdx]);
  });
  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    localStorage.setItem(LS_VOL, String(volume.value));
  });
  audio.addEventListener("volumechange", () => {
    localStorage.setItem(LS_MUTED, audio.muted ? "1" : "0");
  });

  // ---------- Restore / Duração ----------
  const saved = Number(localStorage.getItem(PROG_KEY) || 0);
  if (saved > 0) audio.currentTime = saved;
  audio.addEventListener(
    "loadedmetadata",
    () => (dur.textContent = fmt(audio.duration))
  );

  // ---------- Progresso / Save ----------
  function update() {
    const pct = (audio.currentTime / (audio.duration || 1)) * 100;
    bar.style.width = pct + "%";
    cur.textContent = fmt(audio.currentTime);
    if (Math.floor(audio.currentTime) % 2 === 0) {
      localStorage.setItem(PROG_KEY, audio.currentTime);
    }
  }
  audio.addEventListener("timeupdate", update);

  // ---------- Controles ----------
  playBtn.addEventListener("click", () =>
    audio.paused ? audio.play() : audio.pause()
  );
  audio.addEventListener("play", () => {
    playBtn.textContent = "⏸ Pausar";
    playBtn.setAttribute("aria-label", "Pausar");
    playBtn.setAttribute("aria-pressed", "true");
  });
  audio.addEventListener("pause", () => {
    playBtn.textContent = "▶ Reproduzir";
    playBtn.setAttribute("aria-label", "Reproduzir");
    playBtn.setAttribute("aria-pressed", "false");
  });

  back15.addEventListener(
    "click",
    () => (audio.currentTime = Math.max(0, audio.currentTime - 15))
  );
  fwd15.addEventListener(
    "click",
    () =>
      (audio.currentTime = Math.min(
        audio.duration || Infinity,
        audio.currentTime + 15
      ))
  );

  // Seek ao clicar na barra
  document.querySelector(".progress").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - r.left) / r.width;
    audio.currentTime = pct * (audio.duration || 0);
  });

  // Atalhos
  window.addEventListener("keydown", (e) => {
    if (["Space", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.code))
      e.preventDefault();
    if (e.code === "Space") playBtn.click();
    if (e.code === "ArrowLeft") back15.click();
    if (e.code === "ArrowRight") fwd15.click();
    if (e.code === "Home") audio.currentTime = 0;
    if (e.code === "End")
      audio.currentTime = audio.duration || audio.currentTime;
  });

  // Compartilhar
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const data = {
        title: "Audiobook — Alfabetização com significado",
        text: "Ouça no Dom Bosco RJ",
        url: location.href,
      };
      try {
        if (navigator.share) await navigator.share(data);
        else {
          await navigator.clipboard.writeText(location.href);
          toast("Link copiado.");
        }
      } catch (e) {}
    });
  }

  // Toast
  audio.addEventListener("error", () => {
    toast("Não foi possível carregar o áudio. Tente novamente.");
  });
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  // Media Session (atualiza conforme config/track)
  function setMediaSession(title) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || "Audiobook",
      artist: "Colégio Dom Bosco",
      album: "Audiobooks",
      artwork: [
        {
          src: "assets/img/logo-colegio-db.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });
    navigator.mediaSession.setActionHandler("play", () => audio.play());
    navigator.mediaSession.setActionHandler("pause", () => audio.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () =>
      back15.click()
    );
    navigator.mediaSession.setActionHandler("seekforward", () => fwd15.click());
    navigator.mediaSession.setActionHandler("seekto", (d) => {
      if (d.seekTime != null) audio.currentTime = d.seekTime;
    });
  }
  setMediaSession(
    document.getElementById("trackTitle")?.textContent || "Audiobook"
  );
  window.addEventListener("cfg:applied", (ev) => {
    const cfg = ev.detail || {};
    const t =
      cfg.ui?.trackTitle ||
      (typeof cfg.audio === "object" && cfg.audio?.title) ||
      document.getElementById("trackTitle")?.textContent;
    setMediaSession(t);
  });

  // ==================== Waveform (Canvas) + Peak Detector ====================
  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth,
      h = cv.clientHeight;
    cv.width = Math.max(1, Math.floor(w * dpr));
    cv.height = Math.max(1, Math.floor(h * dpr));
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitCanvas();
  window.addEventListener("resize", fitCanvas);

  let ac, analyser, srcNode, freqData, timeData;

  function setupAudioGraph() {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;

    if (srcNode) {
      try {
        srcNode.disconnect();
      } catch (e) {}
    }
    srcNode = ac.createMediaElementSource(audio);
    srcNode.connect(analyser);
    analyser.connect(ac.destination);

    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }

  const ensureStarted = async () => {
    if (!ac) setupAudioGraph();
    if (ac && ac.state === "suspended") {
      try {
        await ac.resume();
      } catch (e) {}
    }
  };
  playBtn.addEventListener("click", ensureStarted, { once: true });
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.code === "Space") ensureStarted();
    },
    { once: true }
  );

  function makeGradient() {
    const g = ctx2d.createLinearGradient(0, 0, cv.clientWidth, 0);
    g.addColorStop(0, "#2aa5a1");
    g.addColorStop(0.6, "#f6c21c");
    g.addColorStop(1, "#ff9a2e");
    return g;
  }
  let grad = makeGradient();
  window.addEventListener("resize", () => {
    grad = makeGradient();
  });

  let ema = 0,
    peakHold = 0;
  let t = 0; // oscilação fake antes do play
  const alpha = 0.07,
    PEAK_SENS = 1.45;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  function draw() {
    if (!reduceMotion) requestAnimationFrame(draw);

    const W = cv.clientWidth,
      H = cv.clientHeight;
    ctx2d.fillStyle = "#0b1830";
    ctx2d.fillRect(0, 0, W, H);

    const bars = 64,
      gap = 2,
      bw = W / bars - gap,
      mid = H / 2;
    let amps = new Array(bars).fill(0);

    if (analyser && ac && ac.state !== "suspended" && !audio.paused) {
      analyser.getByteFrequencyData(freqData);
      for (let i = 0; i < bars; i++) {
        const bin = Math.min(
          freqData.length - 1,
          Math.floor(i * (freqData.length / bars))
        );
        amps[i] = freqData[bin] / 255;
      }
      analyser.getByteTimeDomainData(timeData);
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / timeData.length);
      ema = (1 - alpha) * ema + alpha * rms;
      const threshold = ema * PEAK_SENS;

      if (rms > threshold) peakHold = 6;
      else if (peakHold > 0) peakHold--;

      if (peakHold > 0) waveBox.classList.add("is-peak");
      else waveBox.classList.remove("is-peak");
    } else {
      t += 0.02;
      for (let i = 0; i < bars; i++) {
        const p = i / bars;
        const s1 = Math.sin(p * 6.0 + t);
        const s2 = Math.sin(p * 11.0 - t * 1.2) * 0.5;
        amps[i] = Math.max(0, (s1 * 0.5 + 0.5) * 0.6 + (s2 * 0.5 + 0.5) * 0.2);
      }
      const pulse = Math.sin(t * 3.3);
      if (pulse > 0.88) waveBox.classList.add("is-peak");
      else waveBox.classList.remove("is-peak");
    }

    ctx2d.fillStyle = grad;
    ctx2d.strokeStyle = "rgba(32,52,94,.6)";
    ctx2d.lineWidth = 1;

    for (let i = 0; i < bars; i++) {
      const x = i * (bw + gap);
      const base = amps[i] * (mid * 0.9);
      const h = Math.max(2, base * (0.6 + audio.volume * 0.6));
      const y = mid - h;
      ctx2d.fillRect(x, y, bw, h * 2);
      ctx2d.strokeRect(x, y, bw, h * 2);
    }
  }
  draw();
})();
