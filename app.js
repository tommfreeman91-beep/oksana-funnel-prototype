(function () {
  "use strict";

  // Best-effort Telegram WebApp init — safe no-op outside Telegram.
  // TODO: on the backend-integration step, use Telegram.WebApp.initDataUnsafe.user
  // to prefill the contact field on the lead-form slide instead of asking manually.
  //
  // initData is only non-empty when actually launched from inside Telegram
  // (a plain browser visit gets a stub WebApp object with empty initData) —
  // that's the reliable signal for "am I really in the Telegram WebView".
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initData) {
      tg.ready();
      tg.expand();
      document.documentElement.classList.add("tg-app");

      const syncViewportHeight = () => {
        const h = tg.viewportStableHeight || tg.viewportHeight;
        if (h) document.documentElement.style.setProperty("--tg-vh", h + "px");
      };
      syncViewportHeight();
      tg.onEvent("viewportChanged", syncViewportHeight);
    }
  } catch (e) { /* running outside Telegram — fine for the static prototype */ }

  const track = document.getElementById("track");
  const slides = Array.from(document.querySelectorAll("[data-slide]"));
  const progressTrack = document.getElementById("progressTrack");
  const stepLabel = document.getElementById("stepLabel");
  const btnBack = document.getElementById("btnBack");
  const total = slides.length;

  // Build stories-style progress segments
  slides.forEach(() => {
    const seg = document.createElement("div");
    seg.className = "seg";
    progressTrack.appendChild(seg);
  });
  const segs = Array.from(progressTrack.children);

  let current = 0;
  const quizAnswers = {};
  const leadDraft = { request: "", contact: "" };

  function render() {
    track.style.transform = `translateX(-${current * 100}%)`;
    segs.forEach((seg, i) => {
      seg.classList.toggle("done", i < current);
      seg.classList.toggle("current", i === current);
    });
    stepLabel.textContent = `Шаг ${current + 1} из ${total}`;
    btnBack.disabled = current === 0;
    window.scrollTo(0, 0);
  }

  function goTo(index) {
    if (index < 0 || index >= total) return;
    current = index;
    render();
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  btnBack.addEventListener("click", prev);

  document.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      next();
    });
  });

  // Channel subscribe — placeholder link, no real channel wired up yet.
  // TODO: заменить '#' на реальную ссылку/username канала Оксаны (материалы/тексты или .env CHANNEL_USERNAME)
  document.querySelectorAll("[data-channel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
          window.Telegram.WebApp.openTelegramLink("https://t.me/TODO_channel_username");
        } else {
          window.open("https://t.me/TODO_channel_username", "_blank");
        }
      } catch (e) {
        window.open("https://t.me/TODO_channel_username", "_blank");
      }
    });
  });

  // Quiz option selection
  document.querySelectorAll("[data-quiz]").forEach((slide) => {
    const qid = slide.dataset.quiz;
    const options = slide.querySelectorAll(".option");
    const nextBtn = slide.querySelector("[data-next]");
    options.forEach((opt) => {
      opt.addEventListener("click", () => {
        options.forEach((o) => o.classList.remove("selected"));
        opt.classList.add("selected");
        quizAnswers[qid] = opt.dataset.value;
        nextBtn.disabled = false;
      });
    });
  });

  // Lead form
  const leadRequest = document.getElementById("leadRequest");
  const leadContact = document.getElementById("leadContact");
  const btnSubmitLead = document.getElementById("btnSubmitLead");

  btnSubmitLead.addEventListener("click", () => {
    leadDraft.request = leadRequest.value.trim();
    leadDraft.contact = leadContact.value.trim();

    // TODO: на этапе backend — отправить { quizAnswers, leadDraft } на FastAPI-эндпоинт
    // приёма заявок (POST /api/leads) вместо console.log, и уведомить ADMIN_CHAT_ID.
    console.log("Заявка (прототип, без backend):", { quizAnswers, leadDraft });

    next();
  });

  // Restart funnel
  const btnRestart = document.getElementById("btnRestart");
  if (btnRestart) {
    btnRestart.addEventListener("click", () => {
      Object.keys(quizAnswers).forEach((k) => delete quizAnswers[k]);
      leadRequest.value = "";
      leadContact.value = "";
      document.querySelectorAll(".option.selected").forEach((o) => o.classList.remove("selected"));
      document.querySelectorAll("[data-quiz] [data-next]").forEach((b) => (b.disabled = true));
      goTo(0);
    });
  }

  render();
})();
