(() => {
  const c = window.culori;
  const { converter, formatHex, displayable, modeOklch } = c;

  const el = (sel) => document.querySelector(sel);
  const els = (sel) => Array.from(document.querySelectorAll(sel));

  const primaryColorInput = el('#primaryColor');
  const primaryHexInput = el('#primaryHex');
  const usePrimaryBtn = el('#usePrimary');
  const schemeGrid = el('#schemeGrid');
  const acceptSchemeBtn = el('#acceptScheme');
  const rampsRoot = el('#ramps');
  const dashboard = el('#dashboard');
  const apcaSection = el('#apca');
  const apcaText = el('#apcaText');
  const apcaBg = el('#apcaBg');
  const apcaSwap = el('#apcaSwap');
  const apcaResult = el('#apcaResult');
  const apcaPreview = el('#apcaPreview');

  const hexToOklch = converter('oklch');
  const oklchToHex = converter('oklch');

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const round2 = (n) => Math.round(n * 100) / 100;

  const STEPS = [50,100,200,300,400,500,600,700,800,900];

  function syncHexFromPicker() {
    primaryHexInput.value = primaryColorInput.value.toLowerCase();
  }

  function syncPickerFromHex() {
    const v = primaryHexInput.value.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
      const hex = v.startsWith('#') ? v : `#${v}`;
      primaryColorInput.value = hex;
    }
  }

  function suggestScheme(primaryHex) {
    const p = hexToOklch(primaryHex);
    // Derive accent variant and deep variant by adjusting chroma and lightness
    const accent = { l: clamp(p.l, 0.5, 0.75), c: clamp(p.c * 0.95, 0.03, 0.37), h: p.h };
    const deep = { l: clamp(p.l * 0.7, 0.25, 0.55), c: clamp(p.c * 1.05, 0.04, 0.4), h: p.h };
    const neutralHue = isFinite(p.h) ? (p.h + 210) % 360 : 300; // choose a distant hue for neutrality
    const neutral = { l: 0.96, c: 0.02, h: neutralHue };

    const items = [
      { role: '60%', label: 'Neutral (background)', oklch: neutral },
      { role: '30%', label: 'Primary (accent)', oklch: accent },
      { role: '10%', label: 'Primary Deep', oklch: deep },
    ];

    schemeGrid.innerHTML = items.map((it) => {
      const hex = formatHex(it.oklch);
      return `
        <div class="scheme-item" data-role="${it.role}" data-hex="${hex}" data-label="${it.label}">
          <div class="scheme-swatch" style="background:${hex}"></div>
          <div class="scheme-meta">
            <span>${it.role} • ${it.label}</span>
            <span>${hex}</span>
          </div>
        </div>
      `;
    }).join('');

    acceptSchemeBtn.disabled = false;
    return items;
  }

  function renderDummyScheme() {
    const items = [
      { role: '60%', label: 'Neutral (background)', hex: '#f3f4f6' },
      { role: '30%', label: 'Primary (accent)', hex: '#5b8aff' },
      { role: '10%', label: 'Primary Deep', hex: '#1e3a8a' },
    ];
    schemeGrid.innerHTML = items.map((it) => {
      return `
        <div class="scheme-item" data-role="${it.role}" data-hex="${it.hex}" data-label="${it.label}">
          <div class="scheme-swatch" style="background:${it.hex}"></div>
          <div class="scheme-meta">
            <span>${it.role} • ${it.label}</span>
            <span>${it.hex}</span>
          </div>
        </div>
      `;
    }).join('');
    acceptSchemeBtn.disabled = false;
  }

  function generateRampForOklch(base, name) {
    // Build a ramp from 50..900 by varying lightness. Keep chroma and hue constant, with slight taper.
    const steps = STEPS.map((k, idx) => {
      const t = idx / (STEPS.length - 1); // 0..1
      const l = clamp(0.98 - t * 0.85, 0.08, 0.98);
      // Taper chroma a bit at the ends to reduce artifacts
      const cTaper = 1 - Math.pow(Math.abs(0.5 - t) * 2, 1.2) * 0.25;
      const cVal = clamp(base.c * cTaper, 0, 0.4);
      const o = { l, c: cVal, h: base.h };
      return { key: k, oklch: o, hex: formatHex(o) };
    });

    return { name, base, steps };
  }

  function renderRamp(ramp) {
    const id = `r-${ramp.name.replace(/\s+/g, '-').toLowerCase()}`;
    const container = document.createElement('div');
    container.className = 'ramp';
    container.dataset.ramp = ramp.name;
    container.innerHTML = `
      <div class="ramp-header">
        <strong>${ramp.name}</strong>
        <div class="row">
          <label style="color:#a7adbb">Chroma <input type="range" min="0" max="0.4" step="0.005" value="${round2(ramp.base.c)}" data-control="c"></label>
          <label style="color:#a7adbb">Hue <input type="range" min="0" max="360" step="1" value="${round2(isFinite(ramp.base.h) ? ramp.base.h : 0)}" data-control="h"></label>
        </div>
      </div>
      <div class="ramp-steps"></div>
      <div class="step-controls">
        <span style="color:#a7adbb">Adjust individual lightness (maintains uniformity across ramp)</span>
      </div>
    `;
    const stepsEl = container.querySelector('.ramp-steps');
    stepsEl.innerHTML = ramp.steps.map((s) => {
      const textColor = s.oklch.l < 0.55 ? '#fff' : '#000';
      return `
        <div class="step ${textColor === '#fff' ? 'invert' : ''}" data-key="${s.key}" style="background:${s.hex}">
          <span>${s.key}</span>
          <span>${s.hex}</span>
        </div>
      `;
    }).join('');

    // Add interactions: adjust base c and h, and tweak per-step lightness
    container.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        const control = input.dataset.control;
        if (control === 'c') ramp.base.c = parseFloat(input.value);
        if (control === 'h') ramp.base.h = parseFloat(input.value);
        const regenerated = generateRampForOklch(ramp.base, ramp.name);
        container.replaceWith(renderRamp(regenerated));
        attachApcaPreview();
      });
    });

    stepsEl.querySelectorAll('.step').forEach((stepEl) => {
      stepEl.addEventListener('click', () => {
        const key = stepEl.dataset.key;
        const idx = STEPS.indexOf(Number(key));
        const current = ramp.steps[idx];
        const newL = clamp(hexToOklch(current.hex).l + 0.02, 0.05, 0.99);
        // Rebuild ramp by adjusting lightness curve around this step to maintain smoothness
        const adjusted = ramp.steps.map((s, i) => {
          const dist = Math.abs(i - idx);
          const influence = Math.max(0, 1 - dist / 4);
          const baseL = hexToOklch(s.hex).l;
          const l = clamp(baseL + (newL - baseL) * influence * 0.6, 0.05, 0.99);
          const o = { l, c: ramp.base.c * (1 - Math.pow(Math.abs(0.5 - i/(STEPS.length-1)) * 2, 1.2) * 0.25), h: ramp.base.h };
          return { key: s.key, oklch: o, hex: formatHex(o) };
        });
        const updated = { name: ramp.name, base: ramp.base, steps: adjusted };
        container.replaceWith(renderRamp(updated));
        attachApcaPreview();
      });
    });

    return container;
  }

  function renderRampsFromScheme(items) {
    rampsRoot.innerHTML = '';
    const ramps = items.map((it) => generateRampForOklch(it.oklch, `${it.role} ${it.label}`));
    ramps.forEach((r) => rampsRoot.appendChild(renderRamp(r)));
  }

  function attachApcaPreview() {
    const text = apcaText.value;
    const bg = apcaBg.value;
    apcaPreview.style.color = text;
    apcaPreview.style.background = bg;
    try {
      // APCA returns Lc value: positive for dark text on light bg, negative for light on dark
      const Lc = window.APCAcontrast(text, bg);
      const score = Number.isFinite(Lc) ? Lc.toFixed(1) : '–';
      apcaResult.textContent = `Contrast: ${score} Lc`;
    } catch (e) {
      apcaResult.textContent = 'Contrast: –';
    }
  }

  primaryColorInput.addEventListener('input', () => {
    syncHexFromPicker();
    suggestScheme(primaryColorInput.value);
  });
  primaryHexInput.addEventListener('input', () => {
    syncPickerFromHex();
    suggestScheme(primaryColorInput.value);
  });
  usePrimaryBtn.addEventListener('click', () => {
    // Show a dummy example scheme regardless of the chosen primary
    renderDummyScheme();
  });

  acceptSchemeBtn.addEventListener('click', () => {
    const cards = els('.scheme-item');
    if (!cards.length) return;
    const items = cards.map((card) => {
      const role = card.dataset.role;
      const hex = card.dataset.hex;
      const label = card.dataset.label || 'Colour';
      return { role, label, oklch: hexToOklch(hex) };
    });
    renderRampsFromScheme(items);
    dashboard.hidden = false;
    apcaSection.hidden = false;
    attachApcaPreview();
    try { dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
  });

  apcaText.addEventListener('input', attachApcaPreview);
  apcaBg.addEventListener('input', attachApcaPreview);
  apcaSwap.addEventListener('click', () => {
    const t = apcaText.value; apcaText.value = apcaBg.value; apcaBg.value = t; attachApcaPreview();
  });

  // Initial render (show dummy scheme so there's always something visible)
  renderDummyScheme();
  attachApcaPreview();
})();


