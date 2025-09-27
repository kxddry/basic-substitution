(() => {
  "use strict";

  const UNKNOWN_CHAR = "·"; // shown where no mapping is set

  const els = {
    textarea: /** @type {HTMLTextAreaElement} */ (document.getElementById("ciphertext")),
    original: /** @type {HTMLElement} */ (document.getElementById("originalDisplay")),
    grid: /** @type {HTMLElement} */ (document.getElementById("grid")),
    decrypted: /** @type {HTMLElement} */ (document.getElementById("decryptedSentence")),
    spaced: /** @type {HTMLElement} */ (document.getElementById("spacedGuess")),
    clearBtn: /** @type {HTMLButtonElement} */ (document.getElementById("clearMapping")),
  };

  const state = {
    ciphertext: "",
    mapping: /** @type {Record<string, string>} */ ({}), // cipher letter (A-Z) -> plain letter (A-Z)
  };

  function isLetter(ch) {
    return /^[A-Z]|[А-Я]$/.test(ch);
  }

  function normalizeCiphertext(raw) {
    // Keep text as-is for display, but grid uses uppercased letters for mapping consistency
    // We will display the original (uppercased) to better align with classic cryptograms
    return (raw || "").toUpperCase();
  }

  function applyMapping(text, mapping) {
    let out = "";
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (isLetter(ch)) {
        const mapped = mapping[ch];
        out += mapped && mapped.length === 1 ? mapped : UNKNOWN_CHAR;
      } else {
        out += ch; // preserve spaces, punctuation, newlines
      }
    }
    return out;
  }

  function spacedVersion(applied, original) {
    let out = "";
    for (let i = 0; i < applied.length; i += 1) {
      const a = applied[i];
      const o = original[i];
      if (o === "\n") {
        out += "\n";
      } else if (o === " ") {
        out += "   "; // widen natural spaces a bit
      } else {
        out += a + " ";
      }
    }
    return out;
  }

  function updateOutputs() {
    const applied = applyMapping(state.ciphertext, state.mapping);
    els.decrypted.textContent = applied;
    els.spaced.textContent = spacedVersion(applied, state.ciphertext);
  }

  function clearMapping() {
    state.mapping = {};
    // Clear inputs visually
    els.grid.querySelectorAll("input.plain-input[data-key]").forEach((inp) => {
      inp.value = "";
    });
    updateOutputs();
  }

  function createLetterTile(ch, idx) {
    const tile = document.createElement("div");
    tile.className = "tile letter";

    const top = document.createElement("div");
    top.className = "cipher-char";
    top.textContent = ch;

    const input = document.createElement("input");
    input.className = "plain-input";
    input.type = "text";
    input.maxLength = 1;
    input.setAttribute("inputmode", "latin");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.dataset.key = ch; // cipher letter key
    input.value = state.mapping[ch] || "";

    // Input behavior
    input.addEventListener("beforeinput", (e) => {
      const ev = /** @type {InputEvent} */ (e);
      if (ev.inputType === "insertText" && ev.data) {
        const upper = ev.data.toUpperCase();
        if (!/^[A-Z]$/.test(upper)) {
          e.preventDefault();
        }
      }
    });

    input.addEventListener("input", (e) => {
      const target = /** @type {HTMLInputElement} */ (e.currentTarget);
      const val = (target.value || "").toUpperCase().replace(/[^A-Z]/g, "");
      target.value = val;

      const key = target.dataset.key;
      if (!key) return;

      if (val) state.mapping[key] = val; else delete state.mapping[key];

      // Sync all inputs for the same cipher letter
      els.grid.querySelectorAll(`input.plain-input[data-key="${key}"]`).forEach((inp) => {
        if (inp !== target) inp.value = val;
      });

      updateOutputs();

      // Move to next input if a letter was typed
      if (val.length === 1) {
        const inputs = Array.from(els.grid.querySelectorAll("input.plain-input"));
        const idx = inputs.indexOf(target);
        if (idx > -1 && idx + 1 < inputs.length) {
          inputs[idx + 1].focus();
          inputs[idx + 1].select();
        }
      }
    });

    // Arrow navigation
    input.addEventListener("keydown", (e) => {
      const target = /** @type {HTMLInputElement} */ (e.currentTarget);
      const inputs = Array.from(els.grid.querySelectorAll("input.plain-input"));
      const idx = inputs.indexOf(target);
      if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault();
        inputs[idx - 1].focus();
        inputs[idx - 1].select();
      } else if (e.key === "ArrowRight" && idx > -1 && idx + 1 < inputs.length) {
        e.preventDefault();
        inputs[idx + 1].focus();
        inputs[idx + 1].select();
      } else if (e.key === "Backspace" && !target.value) {
        // If empty and backspace, also clear mapping (already empty) and move left
        if (idx > 0) {
          e.preventDefault();
          inputs[idx - 1].focus();
          inputs[idx - 1].select();
        }
      }
    });

    tile.appendChild(top);
    tile.appendChild(input);
    return tile;
  }

  function createBlankTile(space = false) {
    const tile = document.createElement("div");
    tile.className = space ? "tile blank" : "tile symbol";

    const top = document.createElement("div");
    top.className = "cipher-char";
    top.textContent = space ? " " : "";

    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";

    tile.appendChild(top);
    tile.appendChild(placeholder);
    return tile;
  }

  function rebuildGrid() {
    els.grid.innerHTML = "";

    const text = state.ciphertext;
    const lines = text.split("\n");

    for (const lineText of lines) {
      const lineEl = document.createElement("div");
      lineEl.className = "line";

      for (let i = 0; i < lineText.length; i += 1) {
        const ch = lineText[i];
        if (isLetter(ch)) {
          lineEl.appendChild(createLetterTile(ch, i));
        } else if (ch === " ") {
          lineEl.appendChild(createBlankTile(true));
        } else {
          const tile = createBlankTile(false);
          tile.querySelector(".cipher-char").textContent = ch;
          lineEl.appendChild(tile);
        }
      }

      els.grid.appendChild(lineEl);
    }
  }

  function setCiphertext(raw) {
    state.ciphertext = normalizeCiphertext(raw);
    els.original.textContent = state.ciphertext;
    rebuildGrid();
    updateOutputs();
  }

  // Wire events
  els.textarea.addEventListener("input", () => {
    const posStart = els.textarea.selectionStart || 0;
    const posEnd = els.textarea.selectionEnd || 0;
    const val = (els.textarea.value || "").toUpperCase();
    if (val !== els.textarea.value) {
      els.textarea.value = val;
      // best-effort caret restore
      try { els.textarea.setSelectionRange(posStart, posEnd); } catch {}
    }
    setCiphertext(val);
  });

  els.clearBtn.addEventListener("click", () => {
    clearMapping();
  });

  // Initialize with placeholder example for discoverability (does not modify textarea value)
  setCiphertext("");
})();


