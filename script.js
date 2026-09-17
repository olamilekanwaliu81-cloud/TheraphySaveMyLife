/* =========================================================
   Landing page behaviour — Paula Axelrod
   ========================================================= */
(function () {
  "use strict";

  /* -----------------------------------------------------
     1) AMAZON LINK — set once, applied everywhere.
     Replace the value below with the final Amazon URL(s).
     If you have separate links per format, fill in the map
     and give buttons a data-fmt="kindle|paperback|audiobook".
     ----------------------------------------------------- */
  var AMAZON = {
    default:   "https://a.co/d/03tNwajn",   // universal book link (from Paula's guide) — confirm/replace
    kindle:    "https://a.co/d/03tNwajn",    // KINDLE_AMAZON_URL
    paperback: "https://a.co/d/03tNwajn",    // PAPERBACK_AMAZON_URL
    audiobook: "https://a.co/d/03tNwajn"     // AUDIOBOOK_AMAZON_URL
  };

  document.querySelectorAll("[data-amazon]").forEach(function (el) {
    var fmt = el.getAttribute("data-fmt");
    var url = (fmt && AMAZON[fmt]) ? AMAZON[fmt] : AMAZON.default;
    // Only override real anchors that point at a placeholder or in-page anchor
    var href = el.getAttribute("href") || "";
    if (href === "" || href.charAt(0) === "#" || href.indexOf("AMAZON_") === 0) {
      el.setAttribute("href", url);
    } else {
      el.setAttribute("href", url);
    }
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener");
  });

  /* -----------------------------------------------------
     2) Footer year
     ----------------------------------------------------- */
  var y = document.getElementById("year");
  if (y) { y.textContent = new Date().getFullYear(); }

  /* -----------------------------------------------------
     3) Opt-in form — client-side validation + success state
     Hook up FORM_ACTION_URL in the HTML <form action="...">
     to your email platform, or handle submit via fetch below.
     ----------------------------------------------------- */
  var SUBSCRIBED_KEY = "pa_subscribed";

  function setError(input, errorEl, show) {
    if (!errorEl) return;
    if (show) { input.setAttribute("aria-invalid", "true"); errorEl.classList.add("show"); }
    else { input.removeAttribute("aria-invalid"); errorEl.classList.remove("show"); }
  }

  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function markSubscribed() {
    try { localStorage.setItem(SUBSCRIBED_KEY, "1"); } catch (e) {}
  }

  // Wire any opt-in form (main page or exit popup). Both post to Brevo
  // via target="brevo_target" and share this validation + success logic.
  function wireOptin(form, success, onSuccess) {
    if (!form) return;
    var fname = form.querySelector('input[name="FIRSTNAME"]');
    var email = form.querySelector('input[name="EMAIL"]');
    if (!fname || !email) return;
    var fnameErr = fname.parentNode.querySelector(".error");
    var emailErr = email.parentNode.querySelector(".error");

    fname.addEventListener("input", function () { if (fname.value.trim()) setError(fname, fnameErr, false); });
    email.addEventListener("input", function () { if (isEmail(email.value.trim())) setError(email, emailErr, false); });

    form.addEventListener("submit", function (e) {
      var ok = true;
      if (!fname.value.trim()) { setError(fname, fnameErr, true); ok = false; }
      if (!isEmail(email.value.trim())) { setError(email, emailErr, true); ok = false; }

      if (!ok) {
        e.preventDefault();
        var firstBad = form.querySelector('[aria-invalid="true"]');
        if (firstBad) firstBad.focus();
        return;
      }

      function showSuccess() {
        form.classList.add("hide");
        if (success) {
          success.classList.add("show");
          success.setAttribute("tabindex", "-1");
          success.focus();
        }
        markSubscribed();
        if (typeof onSuccess === "function") onSuccess();
      }

      var action = form.getAttribute("action") || "";
      var isPlaceholder = (!action || action.indexOf("BREVO_FORM_ACTION_URL") === 0 || action === "FORM_ACTION_URL");

      if (isPlaceholder) {
        // No real endpoint wired — demo the success state in-page.
        e.preventDefault();
        showSuccess();
        return;
      }
      // Real Brevo endpoint: form posts into the hidden iframe, visitor stays here.
      setTimeout(showSuccess, 350);
    });
  }

  wireOptin(document.getElementById("optin-form"), document.getElementById("form-success"));

  /* -----------------------------------------------------
     4) Reveal-on-scroll (respects reduced motion)
     ----------------------------------------------------- */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealEls = document.querySelectorAll(".reveal");

  if (reduce || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* -----------------------------------------------------
     5) Header — add shadow/border once the page scrolls
     ----------------------------------------------------- */
  var topbar = document.querySelector(".topbar");
  if (topbar) {
    var onScroll = function () {
      if (window.scrollY > 12) { topbar.classList.add("is-scrolled"); }
      else { topbar.classList.remove("is-scrolled"); }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* -----------------------------------------------------
     6) Sticky mobile CTA — appears after the hero
     ----------------------------------------------------- */
  var bar = document.getElementById("mobilebar");
  var hero = document.querySelector(".hero");
  if (bar && hero && "IntersectionObserver" in window) {
    var barIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        // show the bar once the hero has scrolled out of view
        if (entry.isIntersecting) {
          bar.classList.remove("show");
          bar.setAttribute("aria-hidden", "true");
        } else {
          bar.classList.add("show");
          bar.setAttribute("aria-hidden", "false");
        }
      });
    }, { threshold: 0 });
    barIO.observe(hero);
  }

  /* -----------------------------------------------------
     7) Exit-intent popup — recover leaving visitors.
        Posts to the SAME Brevo list. Shows once per visitor,
        never to people who already signed up.
     ----------------------------------------------------- */
  var modal = document.getElementById("exit-modal");
  if (modal) {
    var SEEN_KEY = "pa_exit_seen";
    var card = modal.querySelector(".modal__card");
    var lastFocused = null;
    var armed = false;      // only allow triggering after a short delay
    var shown = false;

    function alreadyHandled() {
      try { return localStorage.getItem(SEEN_KEY) === "1" || localStorage.getItem(SUBSCRIBED_KEY) === "1"; }
      catch (e) { return false; }
    }

    function openModal() {
      if (shown || !armed || alreadyHandled()) return;
      shown = true;
      try { localStorage.setItem(SEEN_KEY, "1"); } catch (e) {}
      lastFocused = document.activeElement;
      modal.hidden = false;
      // next frame → add class for the open animation
      requestAnimationFrame(function () { modal.classList.add("is-open"); });
      document.body.style.overflow = "hidden";
      var focusTarget = modal.querySelector("#exit-fname") || card;
      if (focusTarget) focusTarget.focus();
      document.addEventListener("keydown", onKeydown);
    }

    function closeModal() {
      modal.classList.remove("is-open");
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeydown);
      window.setTimeout(function () { modal.hidden = true; }, 250);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function onKeydown(e) {
      if (e.key === "Escape") { closeModal(); return; }
      // simple focus trap
      if (e.key === "Tab") {
        var f = modal.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
        var list = [].filter.call(f, function (el) { return el.offsetParent !== null; });
        if (!list.length) return;
        var first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    modal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) closeModal();
    });

    // wire the popup form to Brevo (closes the modal shortly after success)
    wireOptin(document.getElementById("exit-form"), document.getElementById("exit-success"), function () {
      window.setTimeout(closeModal, 2600);
    });

    // arm triggers a few seconds after load (avoid firing instantly)
    window.setTimeout(function () { armed = true; }, 4000);

    // Desktop: mouse leaves the top of the viewport
    document.addEventListener("mouseout", function (e) {
      if (!e.relatedTarget && e.clientY <= 0) openModal();
    });

    // Touch devices (no mouseout): fall back to an inactivity timer
    var isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    if (isTouch) {
      window.setTimeout(function () { openModal(); }, 30000);
    }
  }
})();
