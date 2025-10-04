// ==================== CONFIG LOADER (JSON + fallback) ====================
async function loadConfig() {
  // 1) Nome do config vindo do atributo data-config do <html> (preferível)
  const htmlCfg = document.documentElement.getAttribute('data-config');

  // 2) Se não achar, tenta pelo nome do arquivo epN.html
  const byPath = (location.pathname.match(/\/([a-z0-9_-]+)\.html$/i) || [])[1];

  // 3) Ou query string ?cfg=ep1
  const byQS = new URLSearchParams(location.search).get('cfg');

  const key = (htmlCfg || byQS || byPath || 'app').toLowerCase(); // 'ep1', 'app', etc.
  const candidate = `assets/config/${key}.config.json?v=${Date.now()}`;
  const fallback = `assets/config/app.config.json?v=${Date.now()}`;

  // Busca com cache-busting
  let cfg = null;
  try {
    const r = await fetch(candidate, { cache: 'no-store' });
    if (r.ok) cfg = await r.json();
  } catch (_) {}

  // Fallback
  if (!cfg) {
    const r = await fetch(fallback, { cache: 'no-store' });
    if (r.ok) cfg = await r.json();
  }

  if (!cfg) throw new Error('Config não encontrado.');
  applyConfig(cfg);
  return cfg;
}

function setMeta(sel, attr, val) {
  if (!val) return;
  let el = document.querySelector(sel);
  if (!el) {
    el = document.createElement('meta');
    if (sel.includes('name=')) {
      el.setAttribute('name', sel.match(/name="(.+?)"/)[1]);
    } else if (sel.includes('property=')) {
      el.setAttribute('property', sel.match(/property="(.+?)"/)[1]);
    }
    document.head.appendChild(el);
  }
  el.setAttribute(attr, val);
}

function applyConfig(cfg) {
  // ---- SEO ----
  if (cfg.seo?.title) document.title = cfg.seo.title;
  setMeta('meta[name="description"]', 'content', cfg.seo?.description);
  setMeta('meta[property="og:title"]', 'content', cfg.seo?.title);
  setMeta('meta[property="og:description"]', 'content', cfg.seo?.description);
  setMeta('meta[property="og:image"]', 'content', cfg.seo?.image);
  if (cfg.seo?.canonical) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = cfg.seo.canonical;
  }

  // ---- Topbar brand ----
  const brand = cfg.links?.brand || 'https://domboscorj.com.br/';
  const $brandA = document.getElementById('brandLink');
  const $brandF = document.getElementById('brandLinkFooter');
  if ($brandA) $brandA.href = brand;
  if ($brandF) $brandF.href = brand;

  // ---- UI textos ----
  const $kicker = document.getElementById('kicker');
  const $title = document.getElementById('pageTitle');
  const $subtitle = document.getElementById('pageSubtitle');
  const $lead = document.getElementById('lead');
  const $track = document.getElementById('trackTitle');
  const $sectionTitle = document.getElementById('sectionTitle');

  if ($kicker && cfg.ui?.kicker) $kicker.textContent = cfg.ui.kicker;
  if ($title && cfg.ui?.pageTitle) $title.textContent = cfg.ui.pageTitle;
  if ($subtitle && cfg.ui?.pageSubtitle) $subtitle.firstChild
      ? $subtitle.firstChild.textContent = cfg.ui.pageSubtitle
      : $subtitle.textContent = cfg.ui.pageSubtitle;
  if ($lead && cfg.ui?.lead) $lead.textContent = cfg.ui.lead;
  if ($track && cfg.ui?.trackTitle) $track.textContent = cfg.ui.trackTitle;
  if ($sectionTitle && cfg.ui?.sectionTitle) $sectionTitle.textContent = cfg.ui.sectionTitle;

  // ---- Áudio ----
  const audio = document.getElementById('player');
  const source = document.getElementById('audioSource');
  const download = document.getElementById('downloadLink');

  if (cfg.audio?.src && source) source.src = cfg.audio.src;
  if (cfg.audio?.src && audio) { try { audio.load(); } catch(_){} }
  if (download) download.href = cfg.audio?.download || cfg.audio?.src || '#';

  // ---- Links ----
  const spotifyBtn = document.getElementById('spotifyBtn');
  if (spotifyBtn && cfg.links?.spotify) spotifyBtn.href = cfg.links.spotify;

  const cta = document.getElementById('ctaEnroll');
  if (cta && cfg.links?.cta) cta.href = cfg.links.cta;
  if (document.getElementById('ctaTitle') && cfg.links?.ctaTitle)
    document.getElementById('ctaTitle').textContent = cfg.links.ctaTitle;
  if (document.getElementById('ctaDesc') && cfg.links?.ctaDesc)
    document.getElementById('ctaDesc').textContent = cfg.links.ctaDesc;
  if (document.getElementById('ctaBtnText') && cfg.links?.ctaBtnText)
    document.getElementById('ctaBtnText').textContent = cfg.links.ctaBtnText;

  // ---- Contatos no rodapé ----
  const phone = cfg.contacts?.phone || '';
  const whats = cfg.contacts?.whatsapp || '';
  const mail  = cfg.contacts?.email || '';

  const linkPhone = document.getElementById('linkPhone');
  const linkWhats = document.getElementById('linkWhats');
  const linkMail  = document.getElementById('linkMail');

  if (linkPhone && phone) { linkPhone.href = `tel:${phone}`; }
  if (linkWhats && whats) { linkWhats.href = `https://wa.me/${whats.replace(/\D/g,'')}`; }
  if (linkMail && mail)   { linkMail.href  = `mailto:${mail}`; }

  // ---- Artigos ----
  const slots = document.querySelectorAll('.cards .info');
  if (slots.length && Array.isArray(cfg.articles)) {
    cfg.articles.forEach((art, i) => {
      const card = slots[i];
      if (!card) return;
      const h = card.querySelector('h3');
      const p = card.querySelector('.quote');
      if (h && art.title)  h.textContent = art.title;
      if (p && art.text)   p.textContent = art.text;
    });
  }
}

// carregamento imediato
document.addEventListener('DOMContentLoaded', () => {
  loadConfig().catch(err => console.error(err));
});

// ==================== PLAYER + WAVEFORM (Canvas) ====================
(() => {
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

  const waveBox = document.querySelector(".wave");
  const cv = document.getElementById("wave");
  const ctx2d = cv.getContext("2d", { alpha: false });

  const PROG_KEY = "db_audiobook_progress_v6";
  const LS_RATE = "db_rate";
  const LS_VOL = "db_volume";
  const LS_MUTED = "db_muted";

  const fmt = (t) => {
    if (!isFinite(t)) return "--:--";
    const m = Math.floor(t / 60).toString().padStart(2, "0");
    const s = Math.floor(t % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Velocidade
  const rates = [0.75, 1.00, 1.25, 1.50];
  let rIdx = Math.max(0, rates.indexOf(Number(localStorage.getItem(LS_RATE)) || 1));
  if (!Number.isFinite(rIdx) || rIdx < 0) rIdx = 1;
  audio.playbackRate = rates[rIdx];
  const fmtRate = (r) => (r === 1 ? "1.00x" : r.toFixed(2) + "x");
  rateBtn.textContent = fmtRate(rates[rIdx]);
  rateBtn.style.minWidth = "4.5rem";      // fixa largura para não “pular”
  rateBtn.style.textAlign = "center";

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

  // Restore / duração
  const saved = Number(localStorage.getItem(PROG_KEY) || 0);
  if (saved > 0) audio.currentTime = saved;
  audio.addEventListener("loadedmetadata", () => (dur.textContent = fmt(audio.duration)));

  // Progresso
  function update() {
    const pct = (audio.currentTime / (audio.duration || 1)) * 100;
    bar.style.width = pct + "%";
    cur.textContent = fmt(audio.currentTime);
    if (Math.floor(audio.currentTime) % 2 === 0) {
      localStorage.setItem(PROG_KEY, audio.currentTime);
    }
  }
  audio.addEventListener("timeupdate", update);

  // Controles
  playBtn.addEventListener("click", () => (audio.paused ? audio.play() : audio.pause()));
  audio.addEventListener("play", () => { playBtn.textContent = "⏸ Pausar"; });
  audio.addEventListener("pause", () => { playBtn.textContent = "▶ Reproduzir"; });

  back15.addEventListener("click", () => (audio.currentTime = Math.max(0, audio.currentTime - 15)));
  fwd15.addEventListener("click", () =>
    (audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 15))
  );

  document.querySelector(".progress").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - r.left) / r.width;
    audio.currentTime = pct * (audio.duration || 0);
  });

  // Atalhos
  window.addEventListener("keydown", (e) => {
    if (["Space", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.code)) e.preventDefault();
    if (e.code === "Space") playBtn.click();
    if (e.code === "ArrowLeft") back15.click();
    if (e.code === "ArrowRight") fwd15.click();
    if (e.code === "Home") audio.currentTime = 0;
    if (e.code === "End")  audio.currentTime = audio.duration || audio.currentTime;
  });

  // Share
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const data = {
        title: document.title || "Audiobook — Dom Bosco RJ",
        text: "Ouça no Dom Bosco RJ",
        url: location.href
      };
      try {
        if (navigator.share) await navigator.share(data);
        else { await navigator.clipboard.writeText(location.href); toast("Link copiado!"); }
      } catch (_) {}
    });
  }

  audio.addEventListener("error", () => toast("Não foi possível carregar o áudio. Tente novamente."));
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3000);
  }

  // Media Session
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: document.getElementById('trackTitle')?.textContent || "Audiobook",
      artist: "Colégio Dom Bosco",
      album: "Audiobooks",
      artwork: [{ src: "assets/img/logo-colegio-db.png", sizes: "512x512", type: "image/png" }]
    });
    navigator.mediaSession.setActionHandler("play", () => audio.play());
    navigator.mediaSession.setActionHandler("pause", () => audio.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => back15.click());
    navigator.mediaSession.setActionHandler("seekforward", () => fwd15.click());
    navigator.mediaSession.setActionHandler("seekto", (d) => { if (d.seekTime != null) audio.currentTime = d.seekTime; });
  }

  // ===== Waveform (com oscilação pré-play) =====
  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.max(1, Math.floor(w * dpr));
    cv.height = Math.max(1, Math.floor(h * dpr));
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitCanvas(); window.addEventListener("resize", fitCanvas);

  let ac, analyser, srcNode, freqData, timeData;
  function setupAudioGraph() {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    if (srcNode) try { srcNode.disconnect(); } catch(_){}
    srcNode = ac.createMediaElementSource(audio);
    srcNode.connect(analyser);
    analyser.connect(ac.destination);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
  }

  const ensureStarted = async () => {
    if (!ac) setupAudioGraph();
    if (ac && ac.state === "suspended") { try { await ac.resume(); } catch(_){ } }
  };
  playBtn.addEventListener("click", ensureStarted, { once: true });
  document.addEventListener("keydown", (e) => { if (e.code === "Space") ensureStarted(); }, { once: true });

  function makeGradient() {
    const g = ctx2d.createLinearGradient(0, 0, cv.clientWidth, 0);
    g.addColorStop(0, "#2aa5a1");
    g.addColorStop(0.6, "#f6c21c");
    g.addColorStop(1, "#ff9a2e");
    return g;
  }
  let grad = makeGradient();
  window.addEventListener("resize", () => { grad = makeGradient(); });

  let ema = 0, peakHold = 0, t = 0;
  const alpha = 0.07, PEAK_SENS = 1.45;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function draw() {
    if (!reduceMotion) requestAnimationFrame(draw);

    const W = cv.clientWidth, H = cv.clientHeight;
    ctx2d.fillStyle = "#0b1830"; ctx2d.fillRect(0, 0, W, H);

    const bars = 64, gap = 2, bw = W / bars - gap, mid = H / 2;
    const amps = new Array(bars).fill(0);

    if (analyser && ac && ac.state !== "suspended" && !audio.paused) {
      analyser.getByteFrequencyData(freqData);
      for (let i = 0; i < bars; i++) {
        const bin = Math.min(freqData.length - 1, Math.floor(i * (freqData.length / bars)));
        amps[i] = freqData[bin] / 255;
      }
      analyser.getByteTimeDomainData(timeData);
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128; sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / timeData.length);
      ema = (1 - alpha) * ema + alpha * rms;
      const threshold = ema * PEAK_SENS;
      if (rms > threshold) peakHold = 6; else if (peakHold > 0) peakHold--;
      waveBox.classList.toggle("is-peak", peakHold > 0);
    } else {
      // Oscilação "fake" antes do play
      t += 0.02;
      for (let i = 0; i < bars; i++) {
        const p = i / bars;
        const s1 = Math.sin(p * 6.0 + t);
        const s2 = Math.sin(p * 11.0 - t * 1.2) * 0.5;
        amps[i] = Math.max(0, (s1 * 0.5 + 0.5) * 0.6 + (s2 * 0.5 + 0.5) * 0.2);
      }
      const pulse = Math.sin(t * 3.3);
      waveBox.classList.toggle("is-peak", pulse > 0.88);
    }

    ctx2d.fillStyle = grad; ctx2d.strokeStyle = "rgba(32,52,94,.6)"; ctx2d.lineWidth = 1;
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
