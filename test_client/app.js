const streamEl = document.getElementById("stream");
const wsStatusEl = document.getElementById("wsStatus");
const submitBtn = document.getElementById("submitBtn");
const inputEl = document.getElementById("poemInput");
const langEl = document.getElementById("langSelect");

function addLine(text, generation, sourceText) {
  const wrapper = document.createElement("div");
  wrapper.className = "poem-line";
  wrapper.textContent = `[gen ${generation}] ${text}`;
  if (sourceText) {
    const source = document.createElement("div");
    source.className = "source";
    source.textContent = `← ${sourceText}`;
    source.style.fontSize = "12px";
    source.style.color = "#666";
    wrapper.appendChild(source);
  }
  streamEl.prepend(wrapper);
  requestAnimationFrame(() => wrapper.classList.add("visible"));
}

function connectWS() {
  const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/visuals`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    wsStatusEl.textContent = "WS: connected";
  };

  ws.onclose = () => {
    wsStatusEl.textContent = "WS: disconnected";
    setTimeout(connectWS, 2000);
  };

  ws.onerror = () => {
    wsStatusEl.textContent = "WS: error";
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      addLine(payload.text, payload.generation, payload.source_text);
    } catch (err) {
      console.warn("Invalid WS payload", err);
    }
  };
}

submitBtn.addEventListener("click", async () => {
  const text = inputEl.value.trim();
  if (!text) return;
  const payload = {
    text,
    language: langEl.value,
  };

  try {
    await fetch("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    inputEl.value = "";
  } catch (err) {
    console.error("Submit failed", err);
  }
});

connectWS();
