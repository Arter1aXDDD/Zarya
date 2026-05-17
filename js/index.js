document.documentElement.classList.add("has-js");

document.addEventListener("DOMContentLoaded", () => {
    initializeHomeAnimations();

    const newsGrid = document.querySelector("section.news .news-grid");
    if (newsGrid) {
        loadHomeNews(newsGrid).catch((error) => {
            console.error("Home news loading failed:", error);
        });
    }
});

function initializeHomeAnimations() {
    const aboutVisual = document.querySelector(".about-visual");
    const wheat = document.querySelector(".wheat");

    if (!("IntersectionObserver" in window)) {
        if (aboutVisual) aboutVisual.classList.add("is-visible");
        if (wheat) wheat.classList.add("is-visible");
        return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (mediaQuery.matches) {
        if (aboutVisual) aboutVisual.classList.add("is-visible");
        if (wheat) wheat.classList.add("is-visible");
        return;
    }

    const aboutObserver = new IntersectionObserver(
        ([entry]) => {
            if (aboutVisual) {
                aboutVisual.classList.toggle("is-visible", entry.isIntersecting);
            }
        },
        {
            threshold: 0.45
        }
    );

    if (aboutVisual) {
        aboutObserver.observe(aboutVisual);
    }

    const wheatObserver = new IntersectionObserver(
        ([entry]) => {
            if (wheat && entry.isIntersecting) {
                wheat.classList.add("is-visible");
                wheatObserver.unobserve(wheat);
            }
        },
        {
            threshold: 0.18
        }
    );

    if (wheat) {
        wheatObserver.observe(wheat);
    }
}

async function loadHomeNews(grid) {
    const response = await fetchJson("/api/news?limit=3");
    const items = Array.isArray(response.items) ? response.items : [];

    if (!items.length) {
        return;
    }

    grid.innerHTML = "";
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
        fragment.appendChild(createHomeNewsCard(item));
    });
    grid.appendChild(fragment);
}

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: {
            Accept: "application/json"
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Request failed.");
    }

    return data;
}

function createHomeNewsCard(item) {
    const article = document.createElement("article");
    article.className = "news-card";
    article.style.backgroundImage = `url("${item.imageUrl}")`;
    article.style.backgroundPosition = item.imagePosition || "center";

    const link = document.createElement("a");
    link.href = `news-article.html?news=${encodeURIComponent(item.slug)}`;

    const content = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = item.title;

    const preview = document.createElement("p");
    preview.textContent = item.previewText;

    content.append(title, preview);
    link.appendChild(content);
    article.appendChild(link);

    return article;
}