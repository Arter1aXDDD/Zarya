document.addEventListener("DOMContentLoaded", () => {
    const homeContactForm = document.getElementById("home-contact-form");
    const contactsFeedbackForm = document.getElementById("contacts-feedback-form");
    const purchaseRequestForm = document.getElementById("purchase-request-form");

    if (homeContactForm) {
        bindContactForm(homeContactForm);
    }

    if (contactsFeedbackForm) {
        bindContactForm(contactsFeedbackForm);
    }

    if (purchaseRequestForm) {
        bindPurchaseRequestForm(purchaseRequestForm);
    }
});

let requestResultModal = null;

function setSubmitDisabled(form, disabled) {
    const submitButton = form.querySelector('[type="submit"]');

    if (!submitButton) {
        return;
    }

    submitButton.disabled = disabled;
    submitButton.dataset.originalText ||= submitButton.textContent;
    submitButton.textContent = disabled ? "Отправка..." : submitButton.dataset.originalText;
}

async function postJson(url, payload) {
    let response;

    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
    }
    catch (error) {
        throw new Error("Не удалось связаться с сервером. Убедитесь, что сайт открыт через http://localhost:3000 и сервер запущен.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Не удалось выполнить запрос.");
    }

    return data;
}

function bindContactForm(form) {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setSubmitDisabled(form, true);

        try {
            const payload = Object.fromEntries(new FormData(form).entries());
            await postJson("/api/contact-messages", payload);
            form.reset();
            alert("Сообщение отправлено. Мы свяжемся с вами в ближайшее время.");
        }
        catch (error) {
            alert(error.message || "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435.");
        }
        finally {
            setSubmitDisabled(form, false);
        }
    });
}

function normalizeWhitespace(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
}

function containsDigits(value) {
    return /\d/.test(String(value || ""));
}

function normalizeRussianPhone(value) {
    const rawDigits = String(value || "").replace(/\D+/g, "").slice(0, 11);

    if (!rawDigits) {
        return "";
    }

    if (rawDigits.length === 10) {
        return "7" + rawDigits;
    }

    if (rawDigits.length === 11 && rawDigits.startsWith("8")) {
        return "7" + rawDigits.slice(1);
    }

    return rawDigits;
}

function isValidRussianPhone(value) {
    return /^7\d{10}$/.test(normalizeRussianPhone(value));
}

function formatRussianPhone(value) {
    const digits = normalizeRussianPhone(value);

    if (!digits) {
        return "";
    }

    const phoneBody = digits.startsWith("7") ? digits.slice(1) : digits;
    const code = phoneBody.slice(0, 3);
    const first = phoneBody.slice(3, 6);
    const second = phoneBody.slice(6, 8);
    const third = phoneBody.slice(8, 10);

    let formatted = "+7";

    if (code) {
        formatted += " (" + code;

        if (code.length === 3) {
            formatted += ")";
        }
    }

    if (first) {
        formatted += " " + first;
    }

    if (second) {
        formatted += "-" + second;
    }

    if (third) {
        formatted += "-" + third;
    }

    return formatted;
}

function getFieldElement(input) {
    return input instanceof HTMLElement ? input.closest(".field") : null;
}

function getOrCreateFieldError(input) {
    const field = getFieldElement(input);

    if (!field) {
        return null;
    }

    let errorNode = field.querySelector(".field-error");

    if (!errorNode) {
        errorNode = document.createElement("div");
        errorNode.className = "field-error";
        field.appendChild(errorNode);
    }

    return errorNode;
}

function setFieldError(input, message) {
    const field = getFieldElement(input);
    const errorNode = getOrCreateFieldError(input);

    if (field) {
        field.classList.add("has-error");
    }

    if (input instanceof HTMLElement) {
        input.setAttribute("aria-invalid", "true");
    }

    if (typeof input.setCustomValidity === "function") {
        input.setCustomValidity(message);
    }

    if (errorNode) {
        errorNode.textContent = message;
    }
}

function clearFieldError(input) {
    const field = getFieldElement(input);
    const errorNode = field ? field.querySelector(".field-error") : null;

    if (field) {
        field.classList.remove("has-error");
    }

    if (input instanceof HTMLElement) {
        input.removeAttribute("aria-invalid");
    }

    if (typeof input.setCustomValidity === "function") {
        input.setCustomValidity("");
    }

    if (errorNode) {
        errorNode.textContent = "";

        if (!errorNode.textContent.trim()) {
            errorNode.remove();
        }
    }
}


function validateRequiredTextField(input, message) {
    const value = normalizeWhitespace(input.value);

    if (!value) {
        setFieldError(input, message);
        return false;
    }

    clearFieldError(input);
    return true;
}

function validatePurchaseFullNameField(input) {
    const value = normalizeWhitespace(input.value);

    if (!value) {
        setFieldError(input, "Укажите ФИО.");
        return false;
    }

    if (containsDigits(value)) {
        setFieldError(input, "В поле ФИО нельзя вводить цифры.");
        return false;
    }

    clearFieldError(input);
    return true;
}

function validatePurchaseEmailField(input) {
    const value = normalizeWhitespace(input.value);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    input.value = value;

    if (!value) {
        setFieldError(input, "Укажите e-mail.");
        return false;
    }

    if (!emailPattern.test(value)) {
        setFieldError(input, "Укажите корректный e-mail.");
        return false;
    }

    clearFieldError(input);
    return true;
}

function validatePurchasePhoneField(input) {
    const value = String(input.value || "").trim();

    if (!value) {
        setFieldError(input, "Укажите телефон.");
        return false;
    }

    if (!isValidRussianPhone(value)) {
        setFieldError(input, "Укажите телефон в корректном формате, например +7 (999) 123-45-67.");
        return false;
    }

    input.value = formatRussianPhone(value);
    clearFieldError(input);
    return true;
}

function validateDigitsLengthField(input, requiredMessage, invalidMessage, length) {
    const digits = String(input.value || "").replace(/\D+/g, "");
    input.value = digits;

    if (!digits) {
        setFieldError(input, requiredMessage);
        return false;
    }

    if (digits.length !== length) {
        setFieldError(input, invalidMessage);
        return false;
    }

    clearFieldError(input);
    return true;
}

function validateProductLineField(input) {
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) {
        return true;
    }

    if (input.name.endsWith("[product_slug]")) {
        if (!input.value) {
            setFieldError(input, "Выберите товар.");
            return false;
        }

        clearFieldError(input);
        return true;
    }

    if (input.name.endsWith("[quantity_tons]")) {
        const value = String(input.value || "").trim();
        const quantity = Number.parseFloat(value.replace(",", "."));

        if (!value) {
            setFieldError(input, "Укажите количество.");
            return false;
        }

        if (!Number.isFinite(quantity) || quantity < 25) {
            setFieldError(input, "Укажите не менее 25 тонн.");
            return false;
        }

        clearFieldError(input);
        return true;
    }

    return true;
}

function validatePurchaseRequestField(form, input) {
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) {
        return true;
    }

    switch (input.name) {
        case "full_name":
            return validatePurchaseFullNameField(input);
        case "email":
            return validatePurchaseEmailField(input);
        case "job_title":
            return validateRequiredTextField(input, "Укажите должность.");
        case "phone":
            return validatePurchasePhoneField(input);
        case "company_name":
            return validateRequiredTextField(input, "Укажите название организации.");
        case "inn":
            return validateDigitsLengthField(input, "Укажите ИНН.", "ИНН должен состоять из 10 цифр.", 10);
        case "ogrn":
            return validateDigitsLengthField(input, "Укажите ОГРН.", "ОГРН должен состоять из 13 цифр.", 13);
        case "legal_address":
            return validateRequiredTextField(input, "Укажите юридический адрес.");
        case "delivery_address":
            if (form.elements.delivery_type.value === "company_transport") {
                return validateRequiredTextField(input, "Укажите адрес доставки.");
            }

            clearFieldError(input);
            return true;
        default:
            if (input.name.includes("request_products[")) {
                return validateProductLineField(input);
            }

            return true;
    }
}

function validatePurchaseRequestFields(form) {
    const trackedInputs = [
        form.elements.full_name,
        form.elements.email,
        form.elements.job_title,
        form.elements.phone,
        form.elements.company_name,
        form.elements.inn,
        form.elements.ogrn,
        form.elements.legal_address,
        form.elements.delivery_address,
        ...form.querySelectorAll("#product-lines select, #product-lines input")
    ].filter(Boolean);

    let firstInvalidInput = null;

    trackedInputs.forEach((input) => {
        const isValid = validatePurchaseRequestField(form, input);

        if (!isValid && !firstInvalidInput) {
            firstInvalidInput = input;
        }
    });

    return firstInvalidInput;
}

function clearPurchaseRequestErrors(form) {
    form.querySelectorAll(".field input, .field select, .field textarea").forEach((input) => {
        clearFieldError(input);
    });
}

function attachPurchaseRequestValidation(form) {
    const fullNameInput = form.elements.full_name;
    const phoneInput = form.elements.phone;
    const emailInput = form.elements.email;
    const innInput = form.elements.inn;
    const ogrnInput = form.elements.ogrn;

    if (fullNameInput) {
        fullNameInput.autocomplete = "name";
    }

    if (emailInput) {
        emailInput.autocomplete = "email";
    }

    if (phoneInput) {
        phoneInput.autocomplete = "tel";
        phoneInput.inputMode = "tel";
        phoneInput.placeholder ||= "+7 (___) ___-__-__";
    }

    if (innInput) {
        innInput.inputMode = "numeric";
    }

    if (ogrnInput) {
        ogrnInput.inputMode = "numeric";
    }

    form.addEventListener("input", (event) => {
        const input = event.target;

        if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) {
            return;
        }
        if (input.name === "phone") {
            const rawValue = String(input.value || "");
            const sanitizedValue = rawValue.replace(/[^\d+()\-\s]/g, "");

            if (sanitizedValue !== rawValue) {
                input.value = sanitizedValue;
            }
        }

        if (input.name === "inn" || input.name === "ogrn") {
            input.value = String(input.value || "").replace(/\D+/g, "");
        }

        if (getFieldElement(input)?.classList.contains("has-error")) {
            validatePurchaseRequestField(form, input);
        }
    });

    form.addEventListener("change", (event) => {
        const input = event.target;

        if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) {
            return;
        }

        if (input.name === "delivery_type") {
            const deliveryAddress = form.elements.delivery_address;

            if (deliveryAddress) {
                validatePurchaseRequestField(form, deliveryAddress);
            }

            return;
        }

        validatePurchaseRequestField(form, input);
    });

    form.addEventListener("focusout", (event) => {
        const input = event.target;

        if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) {
            return;
        }

        validatePurchaseRequestField(form, input);
    });
}

function buildPurchaseRequestPayload(form) {
    const items = [...form.querySelectorAll("#product-lines .product-line")]
        .map((line) => {
            const productSelect = line.querySelector("select");
            const quantityInput = line.querySelector("input[name$='[quantity_tons]']");

            return {
                product_slug: productSelect ? productSelect.value : "",
                quantity_tons: quantityInput ? quantityInput.value : ""
            };
        })
        .filter((item) => item.product_slug && item.quantity_tons);

    return {
        contact: {
            full_name: normalizeWhitespace(form.elements.full_name.value),
            email: normalizeWhitespace(form.elements.email.value),
            job_title: normalizeWhitespace(form.elements.job_title.value),
            phone: formatRussianPhone(form.elements.phone.value)
        },
        partner: {
            company_name: normalizeWhitespace(form.elements.company_name.value),
            inn: normalizeWhitespace(form.elements.inn.value),
            ogrn: normalizeWhitespace(form.elements.ogrn.value),
            legal_address: normalizeWhitespace(form.elements.legal_address.value)
        },
        items,
        delivery: {
            delivery_type: form.elements.delivery_type.value,
            delivery_comment: normalizeWhitespace(form.elements.delivery_comment.value),
            delivery_address: normalizeWhitespace(form.elements.delivery_address.value)
        },
        agreement_accepted: form.elements.agreement_accepted.checked
    };
}

function resetPurchaseRequestForm(form) {
    form.reset();
    clearPurchaseRequestErrors(form);

    const lines = [...form.querySelectorAll("#product-lines .product-line")];
    lines.forEach((line, index) => {
        if (index > 0) {
            line.remove();
            return;
        }

        const select = line.querySelector("select");
        const quantity = line.querySelector("input[name$='[quantity_tons]']");

        if (select) {
            select.value = "";
        }

        if (quantity) {
            quantity.value = "";
        }
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function ensureRequestResultModal() {
    if (requestResultModal) {
        return requestResultModal;
    }

    const modal = document.createElement("div");
    modal.className = "request-result-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="request-result-modal__backdrop" data-modal-close></div>
        <div class="request-result-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="request-result-title">
            <button class="request-result-modal__close" type="button" aria-label="Закрыть окно" data-modal-close>×</button>
            <div class="request-result-modal__eyebrow">Заявка принята</div>
            <h3 class="request-result-modal__title" id="request-result-title"></h3>
            <p class="request-result-modal__lead"></p>
            <div class="request-result-modal__number"></div>
            <div class="request-result-modal__status"></div>
            <div class="request-result-modal__meta"></div>
            <div class="request-result-modal__links"></div>
            <button class="request-result-modal__action" type="button" data-modal-close>Понятно</button>
        </div>
    `;

    modal.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement && event.target.hasAttribute("data-modal-close")) {
            closeRequestResultModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.classList.contains("is-open")) {
            closeRequestResultModal();
        }
    });

    document.body.appendChild(modal);
    requestResultModal = modal;
    return modal;
}

function closeRequestResultModal() {
    const modal = ensureRequestResultModal();
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function buildRecipientMarkup(recipients) {
    if (!Array.isArray(recipients) || !recipients.length) {
        return "";
    }

    return recipients
        .map((recipient) => `<span class="request-result-modal__chip">${escapeHtml(recipient)}</span>`)
        .join("");
}

function buildRequestResultContent(data) {
    const emailRecipients = Array.isArray(data.emailRecipients) ? data.emailRecipients : [];
    const emailFailedRecipients = Array.isArray(data.emailFailedRecipients) ? data.emailFailedRecipients : [];
    const archiveNote = data.invoiceStorageStatus === "uploaded"
        ? '<div class="request-result-modal__note">Резервная копия документа сохранена во внутреннем архиве.</div>'
        : "";

    if (data.emailStatus === "sent") {
        return {
            title: "Накладная отправлена",
            lead: "PDF-документ уже отправлен на указанные адреса. Номер заявки можно сохранить для связи с менеджером.",
            statusLabel: "Письмо успешно отправлено",
            statusVariant: "success",
            metaTitle: emailRecipients.length ? "Получатели документа:" : "",
            metaMarkup: buildRecipientMarkup(emailRecipients) + archiveNote,
            links: ""
        };
    }

    if (data.emailStatus === "partial") {
        return {
            title: "Заявка сохранена, отправка частичная",
            lead: "Накладная отправилась не всем получателям. Заявка уже создана и доступна для дальнейшей обработки.",
            statusLabel: "Частичная доставка письма",
            statusVariant: "warning",
            metaTitle: "Успешно отправлено:",
            metaMarkup: buildRecipientMarkup(emailRecipients) + (emailFailedRecipients.length
                ? `<div class="request-result-modal__note">Не доставлено: ${escapeHtml(emailFailedRecipients.join(", "))}</div>`
                : "") + archiveNote,
            links: ""
        };
    }

    return {
        title: "Заявка сохранена",
        lead: "Уникальный номер уже сформирован. Отправка накладной на почту пока не завершилась, но сама заявка никуда не потерялась.",
        statusLabel: "Требуется завершить настройку почты",
        statusVariant: "neutral",
        metaTitle: "",
        metaMarkup: `<div class="request-result-modal__note">${escapeHtml(data.emailMessage || "Отправка письма временно недоступна.")}</div>` + archiveNote,
        links: ""
    };
}

function openRequestResultModal(data) {
    const modal = ensureRequestResultModal();
    const content = buildRequestResultContent(data);

    modal.querySelector(".request-result-modal__title").textContent = content.title;
    modal.querySelector(".request-result-modal__lead").textContent = content.lead;
    modal.querySelector(".request-result-modal__number").innerHTML = `
        <span>Уникальный номер заявки</span>
        <strong>${escapeHtml(data.requestNumber)}</strong>
    `;

    const statusNode = modal.querySelector(".request-result-modal__status");
    statusNode.className = `request-result-modal__status request-result-modal__status--${content.statusVariant}`;
    statusNode.textContent = content.statusLabel;

    const metaNode = modal.querySelector(".request-result-modal__meta");
    metaNode.innerHTML = content.metaTitle
        ? `<div class="request-result-modal__meta-title">${escapeHtml(content.metaTitle)}</div>${content.metaMarkup}`
        : content.metaMarkup;

    modal.querySelector(".request-result-modal__links").innerHTML = content.links;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function bindPurchaseRequestForm(form) {
    attachPurchaseRequestValidation(form);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const invalidInput = validatePurchaseRequestFields(form);
        if (invalidInput) {
            invalidInput.focus();
            return;
        }

        setSubmitDisabled(form, true);

        try {
            const payload = buildPurchaseRequestPayload(form);
            const data = await postJson("/api/purchase-requests", payload);
            resetPurchaseRequestForm(form);
            openRequestResultModal(data);
        }
        catch (error) {
            alert(error.message || "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443.");
        }
        finally {
            setSubmitDisabled(form, false);
        }
    });
}



