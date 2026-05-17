document.documentElement.classList.add("has-js");

document.addEventListener("DOMContentLoaded", () => {
    const filterContainer = document.querySelector(".filter-buttons");
    const grid = document.querySelector(".catalog-grid");

    if (!filterContainer || !grid) {
        return;
    }

    filterContainer.innerHTML = "";
    grid.classList.remove("is-empty-state");
    grid.innerHTML = "";

    loadCatalog(filterContainer, grid).catch((error) => {
        console.error("Catalog loading failed:", error);
        renderCatalogUnavailableState(filterContainer, grid);
    });
});

async function loadCatalog(filterContainer, grid) {
    const [categoriesResponse, productsResponse] = await Promise.all([
        fetchJson("/api/product-categories"),
        fetchJson("/api/products")
    ]);

    const categories = Array.isArray(categoriesResponse.items) ? categoriesResponse.items : [];
    const products = Array.isArray(productsResponse.items) ? productsResponse.items : [];

    if (!products.length) {
        renderEmptyState(grid, "Каталог пока пуст.");
        filterContainer.innerHTML = "";
        return;
    }

    let activeFilter = "all";

    const render = () => {
        renderFilterButtons(filterContainer, categories, activeFilter, (nextFilter) => {
            activeFilter = nextFilter;
            render();
        });

        renderProductCards(grid, products, activeFilter);
    };

    render();
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

function renderFilterButtons(container, categories, activeFilter, onSelect) {
    container.innerHTML = "";

    const allButton = createFilterButton("all", "Все", activeFilter === "all", onSelect);
    container.appendChild(allButton);

    categories.forEach((category) => {
        container.appendChild(createFilterButton(category.slug, category.name, activeFilter === category.slug, onSelect));
    });
}

function createFilterButton(filter, label, isActive, onSelect) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-button${isActive ? " is-active" : ""}`;
    button.dataset.filter = filter;
    button.textContent = label;
    button.addEventListener("click", () => onSelect(filter));
    return button;
}

function renderProductCards(container, products, activeFilter) {
    container.classList.remove("is-empty-state");
    container.innerHTML = "";

    const visibleProducts = activeFilter === "all"
        ? products
        : products.filter((product) => product.categorySlug === activeFilter);

    if (!visibleProducts.length) {
        renderEmptyState(container, "В этой категории пока нет товаров.");
        return;
    }

    const fragment = document.createDocumentFragment();
    visibleProducts.forEach((product) => {
        fragment.appendChild(createProductCard(product));
    });

    container.appendChild(fragment);
}

function createProductCard(product) {
    const article = document.createElement("article");
    article.className = "product-card";
    article.dataset.category = product.categorySlug;

    const image = document.createElement("div");
    image.className = "product-image";
    image.style.backgroundImage = buildCatalogCardBackground(product.categorySlug, product.imageUrl);
    image.style.backgroundPosition = product.imagePosition || "center";

    const body = document.createElement("div");
    body.className = "product-body";

    const title = document.createElement("h2");
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

function renderEmptyState(container, message) {
    container.classList.add("is-empty-state");
    container.innerHTML = "";

    const state = document.createElement("p");
    state.className = "empty-state-message";
    state.textContent = message;
    container.appendChild(state);
}

function renderCatalogUnavailableState(filterContainer, grid) {
    filterContainer.innerHTML = "";
    renderEmptyState(grid, "Каталог недоступен без запущенного сервера.");
}

function buildCatalogCardBackground(categorySlug, imageUrl) {
    const overlays = {
        wheat: "linear-gradient(rgba(45, 49, 20, 0.06), rgba(45, 49, 20, 0.12))",
        sunflower: "linear-gradient(rgba(36, 33, 14, 0.05), rgba(36, 33, 14, 0.14))",
        corn: "linear-gradient(rgba(20, 35, 14, 0.06), rgba(20, 35, 14, 0.14))"
    };

    const overlay = overlays[categorySlug] || "linear-gradient(rgba(25, 25, 25, 0.08), rgba(25, 25, 25, 0.14))";
    return `${overlay}, url("${imageUrl}")`;
}
