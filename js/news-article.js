document.documentElement.classList.add("has-js");

document.addEventListener("DOMContentLoaded", () => {
    loadArticlePage().catch((error) => {
        console.error("News article loading failed:", error);
        showArticleError("Не удалось загрузить новость. Попробуйте открыть страницу чуть позже.");
    });
});

async function loadArticlePage() {
    const slug = await resolveArticleSlug();

    if (!slug) {
        showArticleError("Новость не найдена.");
        return;
    }

    const response = await fetchJson(`/api/news/${encodeURIComponent(slug)}`);
    const article = response.item;

    if (!article) {
        showArticleError("Новость не найдена.");
        return;
    }

    document.title = `${article.title} — Заря`;

    const titleNode = document.getElementById("article-title");
    const photoNode = document.getElementById("article-photo");
    const copyNode = document.getElementById("article-copy");
    const relatedGrid = document.getElementById("related-news-grid");

    if (titleNode) {
        titleNode.textContent = article.title;
    }

    if (photoNode) {
        photoNode.style.backgroundImage = `url("${article.imageUrl}")`;
        photoNode.style.backgroundPosition = article.imagePosition || "center";
    }

    if (copyNode) {
        copyNode.innerHTML = "";
        article.paragraphs.forEach((paragraphText) => {
            const paragraph = document.createElement("p");
            paragraph.textContent = paragraphText;
            copyNode.appendChild(paragraph);
        });
    }

    if (relatedGrid) {
        relatedGrid.innerHTML = "";
        article.relatedItems.forEach((item) => {
            relatedGrid.appendChild(createRelatedNewsCard(item));
        });
    }
}

async function resolveArticleSlug() {
    const params = new URLSearchParams(window.location.search);
    const requestedSlug = params.get("news");

    if (requestedSlug) {
        return requestedSlug;
    }

    const response = await fetchJson("/api/news?limit=1");
    return response.items?.[0]?.slug || null;
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

function createRelatedNewsCard(item) {
    const article = document.createElement("article");
    article.className = "news-card";

    const link = document.createElement("a");
    link.href = `news-article.html?news=${encodeURIComponent(item.slug)}`;

    const image = document.createElement("div");
    image.className = "news-image";
    image.style.backgroundImage = `url("${item.imageUrl}")`;
    image.style.backgroundPosition = item.imagePosition || "center";

    const body = document.createElement("div");
    body.className = "news-body";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const preview = document.createElement("p");
    preview.textContent = item.previewText;

    const meta = document.createElement("div");
    meta.className = "news-meta";

    const date = document.createElement("span");
    date.textContent = item.publishedAtLabel;

    const more = document.createElement("span");
    more.className = "news-link";
    more.textContent = "Подробнее →";

    meta.append(date, more);
    body.append(title, preview, meta);
    link.append(image, body);
    article.appendChild(link);

    return article;
}

function showArticleError(message) {
    const titleNode = document.getElementById("article-title");
    const copyNode = document.getElementById("article-copy");
    const relatedGrid = document.getElementById("related-news-grid");

    if (titleNode) {
        titleNode.textContent = "Новость недоступна";
    }

    if (copyNode) {
        copyNode.innerHTML = "";
        const paragraph = document.createElement("p");
        paragraph.textContent = message;
        copyNode.appendChild(paragraph);
    }

    if (relatedGrid) {
        relatedGrid.innerHTML = "";
    }
}