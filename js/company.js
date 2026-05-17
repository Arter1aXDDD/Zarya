document.documentElement.classList.add("has-js");

document.addEventListener("DOMContentLoaded", () => {
    (() => {
    const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    // Active nav underline
    const links = document.querySelectorAll(".nav a[data-nav]");
    if (links.length) {
    const path = (location.pathname || "").toLowerCase();
    let active = "home";

    if (path.endsWith("company.html")) active = "company";
    else if (path.endsWith("contacts.html")) active = "contacts";
    else if (path.endsWith("catalog.html")) active = "catalog";
    else if (path.endsWith("news.html")) active = "news";

    links.forEach((a) => a.classList.toggle("is-active", a.dataset.nav === active));
    }

    // Reveal on scroll (one-time)
    const revealEls = document.querySelectorAll(".reveal");
    const revealNow = (el) => el.classList.add("is-in");

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(revealNow);
    } else {
    const io = new IntersectionObserver(
    (entries) => {
    entries.forEach((e) => {
    if (!e.isIntersecting) return;
    revealNow(e.target);
    io.unobserve(e.target);
    });
    },
    { threshold: 0.18 }
    );
    revealEls.forEach((el) => io.observe(el));
    }

    // Wheat should "grow" out from behind the images while scrolling in,
    // and return back when the section scrolls away.
    const wheatCards = document.querySelectorAll(".image-card");
    if (wheatCards.length) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    wheatCards.forEach((card) => card.classList.add("is-grown"));
    } else {
    const wheatObserver = new IntersectionObserver(
    (entries) => {
    entries.forEach((entry) => {
    entry.target.classList.toggle("is-grown", entry.isIntersecting);
    });
    },
    {
    threshold: 0.45,
    rootMargin: "-4% 0px -4% 0px",
    }
    );
    wheatCards.forEach((card) => wheatObserver.observe(card));
    }
    }

    // Count-up numbers in hero stats (run once)
    const statsRoot = document.querySelector(".stats");
    const statNumbers = document.querySelectorAll(".stat-number[data-count]");
    if (!statsRoot || !statNumbers.length) return;

    const setFinal = (el) => {
    const target = Number.parseInt(el.dataset.count || "0", 10) || 0;
    const suffix = el.dataset.suffix || "";
    el.textContent = target.toLocaleString("ru-RU") + suffix;
    };

    const animateNumber = (el) => {
    const target = Number.parseInt(el.dataset.count || "0", 10) || 0;
    const suffix = el.dataset.suffix || "";
    const duration = 1050;
    const start = performance.now();
    const from = 0;

    const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(from + (target - from) * eased);
    el.textContent = value.toLocaleString("ru-RU") + suffix;
    if (t < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
    };

    const runCountersOnce = () => {
    if (statsRoot.dataset.counted === "1") return;
    statsRoot.dataset.counted = "1";

    if (prefersReducedMotion) {
    statNumbers.forEach(setFinal);
    return;
    }

    statNumbers.forEach(animateNumber);
    };

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    runCountersOnce();
    return;
    }

    const io = new IntersectionObserver(
    (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    runCountersOnce();
    io.disconnect();
    },
    { threshold: 0.25 }
    );
    io.observe(statsRoot);
    })();
});
