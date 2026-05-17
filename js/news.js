document.documentElement.classList.add("has-js");

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.querySelector(".news-grid");

    if (!grid) {
        return;
    }

    grid.classList.remove("is-empty-state");
    grid.innerHTML = "";

    loadNews(grid).catch((error) => {
        console.error("News loading failed:", error);
        renderEmptyState(grid, "Новости недоступны без запущенного сервера.");
    });
});

async function loadNews(grid) {
    const response = await fetchJson("/api/news");
    const items = Array.isArray(response.items) ? response.items : [];

    if (!items.length) {
        renderEmptyState(grid, "Пока нет опубликованных новостей.");
        return;
    }

    grid.classList.remove("is-empty-state");
    grid.innerHTML = "";
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
        fragment.appendChild(createNewsCard(item));
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

function createNewsCard(item) {
    const article = document.createElement("article");
    article.className = "news-card";

    const image = document.createElement("div");
    image.className = "news-image";
    image.style.backgroundImage = `url("${item.imageUrl}")`;
    image.style.backgroundPosition = item.imagePosition || "center";

    const body = document.createElement("div");
    body.className = "news-body";

    const title = document.createElement("h2");
    title.textContent = item.title;

    const preview = document.createElement("p");
    preview.textContent = item.previewText;

    const meta = document.createElement("div");
    meta.className = "news-meta";

    const date = document.createElement("span");
    date.textContent = item.publishedAtLabel;

    const link = document.createElement("a");
    link.className = "news-link";
    link.href = `news-article.html?news=${encodeURIComponent(item.slug)}`;
    link.textContent = "Подробнее →";

    meta.append(date, link);
    body.append(title, preview, meta);
    article.append(image, body);

    return article;
}

function renderEmptyState(container, message) {
    container.classList.add("is-empty-state");
    container.innerHTML = "";

    const state = document.createElement("p");
    state.className = "empty-state-message";
    state.textContent = message;
    container.appendChild(state);
}
