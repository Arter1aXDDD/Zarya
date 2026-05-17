document.documentElement.classList.add("has-site-nav");

(() => {
    const resetScrollPosition = () => {
        if (window.location.hash) return;
        window.scrollTo(0, 0);
        requestAnimationFrame(() => window.scrollTo(0, 0));
    };

    if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
    }

    window.addEventListener("load", resetScrollPosition, { once: true });
    window.addEventListener("pageshow", resetScrollPosition, { once: true });
})();

document.addEventListener("DOMContentLoaded", () => {
    const path = (window.location.pathname || "").toLowerCase();
    let active = "home";

    if (path.endsWith("company.html")) active = "company";
    else if (path.endsWith("contacts.html")) active = "contacts";
    else if (path.endsWith("catalog.html") || path.endsWith("product.html") || path.endsWith("order.html")) active = "catalog";
    else if (path.endsWith("news.html") || path.endsWith("news-article.html")) active = "news";

    document.querySelectorAll(".nav a[data-nav]").forEach((link) => {
        link.classList.toggle("is-active", link.dataset.nav === active);
    });

    const header = document.querySelector(".site-header");
    const toggle = header?.querySelector(".nav-toggle");
    const nav = header?.querySelector(".nav");

    if (!header || !toggle || !nav) return;

    if (!nav.id) {
        nav.id = "site-nav";
    }

    toggle.setAttribute("aria-controls", nav.id);

    const closeMenu = () => {
        header.classList.remove("is-menu-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
    };

    const openMenu = () => {
        header.classList.add("is-menu-open");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Close menu");
    };

    toggle.addEventListener("click", () => {
        if (header.classList.contains("is-menu-open")) {
            closeMenu();
            return;
        }

        openMenu();
    });

    nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
            closeMenu();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
        }
    });

    closeMenu();
});
