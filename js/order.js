document.documentElement.classList.add("has-js");

document.addEventListener("DOMContentLoaded", () => {
    const productLines = document.getElementById("product-lines");
    const addButton = document.getElementById("add-product");
    const form = document.getElementById("purchase-request-form");
    const deliveryType = document.getElementById("delivery-type");
    const deliveryAddressField = document.getElementById("delivery-address-field");
    const deliveryAddress = document.getElementById("delivery-address");

    if (deliveryType && deliveryAddressField && deliveryAddress) {
        const syncDeliveryAddressField = () => {
            const needsAddress = deliveryType.value === "company_transport";
            deliveryAddressField.hidden = !needsAddress;
            deliveryAddressField.classList.toggle("is-hidden", !needsAddress);
            deliveryAddressField.style.display = needsAddress ? "" : "none";
            deliveryAddress.required = needsAddress;

            if (!needsAddress) {
                deliveryAddress.value = "";
            }
        };

        deliveryType.addEventListener("change", syncDeliveryAddressField);

        if (form) {
            form.addEventListener("reset", () => {
                window.setTimeout(syncDeliveryAddressField, 0);
            });
        }

        syncDeliveryAddressField();
    }

    if (!productLines || !addButton) {
        return;
    }

    initializeOrderProducts(productLines, addButton).catch((error) => {
        console.error("Order products loading failed:", error);
        renderUnavailableLine(productLines);
        addButton.disabled = true;
    });
});

async function initializeOrderProducts(productLines, addButton) {
    const response = await fetchJson("/api/products");
    const products = Array.isArray(response.items) ? response.items : [];
    const selectedProduct = new URLSearchParams(window.location.search).get("product");

    if (!products.length) {
        renderUnavailableLine(productLines, "Каталог товаров пока пуст.");
        addButton.disabled = true;
        return;
    }

    productLines.innerHTML = "";

    const buildOptions = (selectedSlug = "") => {
        const placeholder = '<option value="">Выберите продукт</option>';
        const options = products
            .map((product) => {
                const selected = product.slug === selectedSlug ? " selected" : "";
                return `<option value="${product.slug}"${selected}>${escapeHtml(product.name)}</option>`;
            })
            .join("");

        return placeholder + options;
    };

    const syncLineFields = () => {
        const lines = productLines.querySelectorAll(".product-line");

        lines.forEach((line, index) => {
            const selectId = `request-product-${index}-slug`;
            const quantityId = `request-product-${index}-quantity`;

            const labels = line.querySelectorAll(".field label");
            const select = line.querySelector("select");
            const quantity = line.querySelector("input[type='number']");

            select.id = selectId;
            select.name = `request_products[${index}][product_slug]`;
            select.required = true;

            quantity.id = quantityId;
            quantity.name = `request_products[${index}][quantity_tons]`;
            quantity.required = true;

            if (labels[0]) labels[0].setAttribute("for", selectId);
            if (labels[1]) labels[1].setAttribute("for", quantityId);
        });
    };

    const createLine = (selectedSlug = "") => {
        const line = document.createElement("div");
        line.className = "product-line";
        line.innerHTML = `
            <div class="product-line-inner">
                <div class="field">
                    <label>Выбор продукта</label>
                    <select>${buildOptions(selectedSlug)}</select>
                </div>
                <div class="field">
                    <label>Количество (от 25 тонн)</label>
                    <input type="number" min="25" step="0.001" inputmode="decimal" placeholder="25">
                </div>
            </div>
            <button class="remove-line" type="button" aria-label="Удалить товар">×</button>
        `;

        const removeButton = line.querySelector(".remove-line");
        removeButton.addEventListener("click", () => {
            if (productLines.children.length > 1) {
                line.remove();
                syncLineFields();
            }
        });

        productLines.appendChild(line);
        syncLineFields();
    };

    createLine(selectedProduct || "");
    addButton.addEventListener("click", () => createLine(""));
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

function renderUnavailableLine(productLines, message = "Не удалось загрузить товары.") {
    productLines.innerHTML = `
        <div class="product-line">
            <div class="product-line-inner">
                <div class="field">
                    <label>Выбор продукта</label>
                    <select disabled>
                        <option value="">${escapeHtml(message)}</option>
                    </select>
                </div>
                <div class="field">
                    <label>Количество (от 25 тонн)</label>
                    <input type="number" min="25" step="0.001" inputmode="decimal" placeholder="25" disabled>
                </div>
            </div>
        </div>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
