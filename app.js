(function () {
  "use strict";

  // Best-effort Telegram WebApp init — safe no-op outside Telegram.
  //
  // initData is only non-empty when actually launched from inside Telegram
  // (a plain browser visit gets a stub WebApp object with empty initData) —
  // that's the reliable signal for "am I really in the Telegram WebView".
  let tgUser = null;
  let tgInitData = "";
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initData) {
      tg.ready();
      tg.expand();
      document.documentElement.classList.add("tg-app");
      tgInitData = tg.initData;

      const syncViewportHeight = () => {
        const h = tg.viewportStableHeight || tg.viewportHeight;
        if (h) document.documentElement.style.setProperty("--tg-vh", h + "px");
      };
      syncViewportHeight();
      tg.onEvent("viewportChanged", syncViewportHeight);

      // initDataUnsafe is exactly that — unsafe/unverified on the frontend.
      // Fine for prefilling a form field in this static prototype. Once a
      // backend exists, re-derive the real contact server-side from the
      // signed initData hash instead of trusting this value on submit.
      tgUser = (tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
    }
  } catch (e) { /* running outside Telegram — fine for the static prototype */ }

  // Belt-and-suspenders against pinch/double-tap zoom: the viewport meta's
  // user-scalable=no and CSS touch-action:pan-y don't get honored by every
  // WebView (iOS Safari-based ones in particular still allow pinch unless
  // the gesture itself is intercepted). gesturestart is Safari/WebKit-only;
  // the two-finger touchmove check covers pinch on the rest.
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("touchmove", (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  // Backend that verifies initData and relays the lead to Oksana via the
  // Telegram Bot API (see backend/main.py). Bump alongside a redeploy if
  // the Railway service URL ever changes.
  const LEADS_ENDPOINT = "https://oksana-funnel-backend-production.up.railway.app/api/leads";

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

  // Channel subscribe — private invite link (t.me/+...), not a public @username.
  document.querySelectorAll("[data-channel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
          window.Telegram.WebApp.openTelegramLink("https://t.me/+k1VbbOqXTaZmZjA6");
        } else {
          window.open("https://t.me/+k1VbbOqXTaZmZjA6", "_blank");
        }
      } catch (e) {
        window.open("https://t.me/+k1VbbOqXTaZmZjA6", "_blank");
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
  const contactHint = document.getElementById("contactHint");
  const btnSubmitLead = document.getElementById("btnSubmitLead");

  function prefillContact() {
    if (tgUser && tgUser.username) {
      leadContact.value = "@" + tgUser.username;
      contactHint.textContent = "Подтянули автоматически из Telegram — можно поправить или дописать телефон.";
    } else if (tgUser && (tgUser.first_name || tgUser.last_name)) {
      // Some Telegram accounts have no @username set — fall back to the
      // display name so the field isn't just empty, but still ask to confirm.
      leadContact.value = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ");
      contactHint.textContent = "У тебя не задан @username в Telegram — проверь, что здесь удобно связаться, или впиши телефон.";
    } else {
      leadContact.value = "";
      contactHint.textContent = "";
    }
  }
  prefillContact();

  btnSubmitLead.addEventListener("click", async () => {
    leadDraft.request = leadRequest.value.trim();
    leadDraft.contact = leadContact.value.trim();

    if (!tgInitData) {
      // Previewing outside real Telegram (e.g. a plain browser tab) — there's
      // no signed initData to send, and thus no one to actually verify/notify.
      // Just log so the flow is still click-through-able for review.
      console.log("Заявка (нет Telegram initData — просмотр вне Telegram):", { quizAnswers, leadDraft });
      next();
      return;
    }

    const originalLabel = btnSubmitLead.textContent;
    btnSubmitLead.disabled = true;
    btnSubmitLead.textContent = "Отправляем…";

    try {
      const res = await fetch(LEADS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tgInitData, quizAnswers, leadDraft }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      btnSubmitLead.textContent = originalLabel;
      next();
    } catch (err) {
      console.error("Не удалось отправить заявку:", err);
      btnSubmitLead.textContent = "Не отправилось — нажми ещё раз";
    } finally {
      btnSubmitLead.disabled = false;
    }
  });

  // Video lesson — block seeking past the furthest point actually watched
  // (controlsList="nofastforward" only hides the fast-forward buttons in
  // Chrome, it doesn't stop a finger-drag on the scrubber). "seeking" alone
  // isn't reliably fired by every mobile WebView (Telegram's included), so
  // this re-checks on timeupdate/seeked too instead of a one-shot listener.
  const lessonVideo = document.getElementById("lessonVideo");
  const lessonNextBtn = document.getElementById("lessonNextBtn");
  if (lessonVideo) {
    let maxWatched = 0;
    const TOLERANCE = 0.75; // seconds of slack so normal playback doesn't jitter

    // The clamp check must run BEFORE maxWatched is allowed to advance —
    // updating maxWatched to currentTime first (as a separate step) makes
    // the tolerance check trivially pass every time, silently accepting
    // any jump as the new high-water mark. That defeated exactly the
    // "timeupdate" fallback this is meant to be, on any WebView where a
    // scrubber-drag seek doesn't reliably fire seeking/seeked.
    function clampForward() {
      if (lessonVideo.currentTime > maxWatched + TOLERANCE) {
        lessonVideo.currentTime = maxWatched;
      } else if (lessonVideo.currentTime > maxWatched) {
        maxWatched = lessonVideo.currentTime;
      }
    }

    lessonVideo.addEventListener("timeupdate", clampForward);
    lessonVideo.addEventListener("seeking", clampForward);
    lessonVideo.addEventListener("seeked", clampForward);
  }

  if (lessonVideo && lessonNextBtn) {
    function unlockNext() {
      lessonNextBtn.disabled = false;
    }
    lessonVideo.addEventListener("ended", unlockNext);
    // Fallback: some sources report a slightly-off duration, so "ended"
    // can be missed — unlock once playback is effectively at the end too.
    lessonVideo.addEventListener("timeupdate", () => {
      if (lessonVideo.duration && lessonVideo.currentTime >= lessonVideo.duration - 0.5) {
        unlockNext();
      }
    });
  }

  // Bonus lightbox — keeps PDFs/images inside the Mini App. A plain
  // target="_blank"/window.open on these URLs gets handed off by Telegram's
  // WebView to the system browser (Safari/Chrome) instead of opening in-app,
  // which reads as "the bonus is broken" even though the file is fine.
  const bonusLightbox = document.getElementById("bonusLightbox");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxFrame = document.getElementById("lightboxFrame");
  const lightboxDownload = document.getElementById("lightboxDownload");

  function closeBonus() {
    bonusLightbox.hidden = true;
    lightboxImage.hidden = true;
    lightboxFrame.hidden = true;
    lightboxImage.src = "";
    // Reset to about:blank rather than "" — some WebViews keep rendering
    // the last document (and its scroll position) until a real navigation
    // happens, so the next PDF opened could otherwise inherit this one's
    // scroll/page.
    lightboxFrame.src = "about:blank";
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.BackButton) {
        tg.BackButton.offClick(closeBonus);
        tg.BackButton.hide();
      }
    } catch (e) { /* running outside Telegram */ }
  }

  function downloadBonus(src, fileName) {
    const fileUrl = new URL(src, window.location.href).href;
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && typeof tg.downloadFile === "function") {
        tg.downloadFile({ url: fileUrl, file_name: fileName }, () => {});
        return;
      }
    } catch (e) { /* fall through to browser download */ }
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openBonus(src, type, title) {
    lightboxTitle.textContent = title || "";
    const fileName = decodeURIComponent(src.split("/").pop());
    lightboxDownload.onclick = () => downloadBonus(src, fileName);

    if (type === "image") {
      lightboxFrame.hidden = true;
      lightboxFrame.src = "about:blank";
      lightboxImage.src = src;
      lightboxImage.hidden = false;
    } else {
      lightboxImage.hidden = true;
      lightboxImage.src = "";
      lightboxFrame.hidden = false;
      // Same reused <iframe> across bonuses: reassigning an identical src
      // is a no-op in Chrome/WebKit, which is how a PDF opened a second
      // time kept showing whatever page it was scrolled to last time.
      // Force a real navigation via about:blank first, then load the real
      // file with #page=1 on the next tick so it always starts at page 1.
      lightboxFrame.src = "about:blank";
      requestAnimationFrame(() => {
        lightboxFrame.src = src + "#page=1";
      });
    }
    bonusLightbox.hidden = false;

    // Wire Telegram's own back gesture/header-back-arrow to close the
    // overlay instead of leaving the Mini App while it's open.
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.BackButton) {
        tg.BackButton.onClick(closeBonus);
        tg.BackButton.show();
      }
    } catch (e) { /* running outside Telegram */ }
  }

  if (bonusLightbox) {
    document.querySelectorAll("[data-bonus-src]").forEach((el) => {
      el.addEventListener("click", () => {
        openBonus(el.dataset.bonusSrc, el.dataset.bonusType, el.dataset.bonusTitle);
      });
    });
    document.querySelectorAll("[data-lightbox-close]").forEach((el) => {
      el.addEventListener("click", closeBonus);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !bonusLightbox.hidden) closeBonus();
    });
  }

  // Restart funnel
  const btnRestart = document.getElementById("btnRestart");
  if (btnRestart) {
    btnRestart.addEventListener("click", () => {
      Object.keys(quizAnswers).forEach((k) => delete quizAnswers[k]);
      leadRequest.value = "";
      prefillContact();
      document.querySelectorAll(".option.selected").forEach((o) => o.classList.remove("selected"));
      document.querySelectorAll("[data-quiz] [data-next]").forEach((b) => (b.disabled = true));
      goTo(0);
    });
  }

  render();
})();
