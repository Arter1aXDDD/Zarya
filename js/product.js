document.documentElement.classList.add("has-js");

document.addEventListener("DOMContentLoaded", () => {
    loadProductPage().catch((error) => {
        console.error("Product page loading failed:", error);
        showProductError("Не удалось загрузить товар. Попробуйте открыть страницу чуть позже.");
    });
});

async function loadProductPage() {
    const slug = await resolveProductSlug();

    if (!slug) {
        showProductError("Товар не найден.");
        return;
    }

    const response = await fetchJson(`/api/products/${encodeURIComponent(slug)}`);
    const product = response.item;

    if (!product) {
        showProductError("Товар не найден.");
        return;
    }

    document.title = `${product.name} — Заря`;

    const title = document.getElementById("product-title");
    const lead = document.getElementById("product-lead");
    const photo = document.getElementById("product-photo");
    const specs = document.getElementById("product-specs");
    const orderButton = document.getElementById("primary-order-button");
    const relatedGrid = document.getElementById("related-grid");

    if (title) title.textContent = product.name;
    if (lead) lead.textContent = product.shortDescription;

    if (photo) {
        photo.style.backgroundImage = `url("${product.imageUrl}")`;
        photo.style.backgroundPosition = product.imagePosition || "center";
    }

    if (orderButton) {
        orderButton.href = `order.html?product=${encodeURIComponent(product.slug)}`;
    }

    if (specs) {
        specs.innerHTML = "";
        product.specs.forEach((spec) => {
            const row = document.createElement("div");
            row.className = "spec-row";

            const label = document.createElement("dt");
            label.textContent = spec.label;

            const value = document.createElement("dd");
            value.textContent = spec.value;

            row.append(label, value);
            specs.appendChild(row);
        });
    }

    if (relatedGrid) {
        relatedGrid.innerHTML = "";
        product.relatedItems.forEach((item) => {
            relatedGrid.appendChild(createRelatedProductCard(item));
        });
    }
}

async function resolveProductSlug() {
    const params = new URLSearchParams(window.location.search);
    const requestedSlug = params.get("product");

    if (requestedSlug) {
        return requestedSlug;
    }

    const response = await fetchJson("/api/products?limit=1");
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

function createRelatedProductCard(product) {
    const article = document.createElement("article");
    article.className = "product-card";

    const image = document.createElement("div");
    image.className = "product-image";
    image.style.backgroundImage = `url("${product.imageUrl}")`;
    image.style.backgroundPosition = product.imagePosition || "center";

    const body = document.createElement("div");
    body.className = "product-body";

    const title = document.createElement("h3");
    title.className = "product-title";
    title.textContent = product.name;

    const description = document.createElement("p");
    description.className = "product-description";
    description.textContent = product.shortDescription;

    const actions = document.createElement("div");
    actions.className = "product-actions";

    const orderLink = document.createElement("a");
    orderLink.className = "pill-link";
    orderLink.href = `order.html?product=${encodeURIComponent(product.slug)}`;
    orderLink.textContent = "Заказать";

    const detailsLink = document.createElement("a");
    detailsLink.className = "pill-link";
    detailsLink.href = `product.html?product=${encodeURIComponent(product.slug)}`;
    detailsLink.textContent = "Узнать больше";

    actions.append(orderLink, detailsLink);
    body.append(title, description, actions);
    article.append(image, body);

    return article;
}

function showProductError(message) {
    const title = document.getElementById("product-title");
    const lead = document.getElementById("product-lead");
    const specs = document.getElementById("product-specs");
    const relatedGrid = document.getElementById("related-grid");
    const orderButton = document.getElementById("primary-order-button");

    if (title) title.textContent = "Товар недоступен";
    if (lead) lead.textContent = message;
    if (specs) specs.innerHTML = "";
    if (relatedGrid) relatedGrid.innerHTML = "";
    if (orderButton) orderButton.setAttribute("aria-disabled", "true");
}