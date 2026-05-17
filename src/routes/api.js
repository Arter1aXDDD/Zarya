const express = require("express");
const { pool } = require("../db/pool");
const {
    listProductCategories,
    listProducts,
    getProductBySlug,
    listNews,
    getNewsBySlug
} = require("../db/public-content");
const { sendPurchaseRequestInvoiceEmail } = require("../services/email");
const { uploadInvoicePdf } = require("../services/cloudinary");
const { buildInvoiceFileName, generateInvoicePdf } = require("../services/invoice-pdf");

const router = express.Router();
const allowedSourcePages = new Set(["home", "contacts"]);
const allowedDeliveryTypes = new Set(["pickup", "company_transport"]);

function createHttpError(statusCode, publicMessage) {
    const error = new Error(publicMessage);
    error.statusCode = statusCode;
    error.publicMessage = publicMessage;
    return error;
}

function trimToNull(value) {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function digitsOnly(value) {
    return (value || "").replace(/\D+/g, "");
}

function normalizeWhitespace(value) {
    const trimmed = trimToNull(value);
    return trimmed ? trimmed.replace(/\s+/g, " ") : null;
}

function containsDigits(value) {
    return /\d/.test(String(value || ""));
}

function normalizeRussianPhone(value) {
    const digits = digitsOnly(value).slice(0, 11);

    if (!digits) {
        return null;
    }

    if (digits.length === 10) {
        return "7" + digits;
    }

    if (digits.length === 11 && digits.startsWith("8")) {
        return "7" + digits.slice(1);
    }

    return digits;
}

function isValidRussianPhone(value) {
    return typeof value === "string" && /^7\d{10}$/.test(value);
}

function formatRussianPhone(value) {
    const digits = normalizeRussianPhone(value);

    if (!isValidRussianPhone(digits)) {
        return null;
    }

    return "+7 (" + digits.slice(1, 4) + ") " + digits.slice(4, 7) + "-" + digits.slice(7, 9) + "-" + digits.slice(9, 11);
}

function asPositiveNumber(value) {
    const parsed = Number.parseFloat(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : NaN;
}

function asPositiveInteger(value) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function createInvoiceFailureResult(contactEmail, error) {
    console.error("Invoice generation or sending failed:", error.message);

    return {
        status: "failed",
        message: "Заявка сохранена, но накладную пока не удалось отправить.",
        recipients: [contactEmail].filter(Boolean)
    };
}

router.get("/health", async (req, res, next) => {
    try {
        const result = await pool.query("SELECT now() AS db_time");
        res.json({ ok: true, dbTime: result.rows[0].db_time });
    }
    catch (error) {
        next(error);
    }
});

router.get("/product-categories", async (req, res, next) => {
    try {
        const categories = await listProductCategories();
        res.json({ ok: true, items: categories });
    }
    catch (error) {
        next(error);
    }
});

router.get("/products", async (req, res, next) => {
    try {
        const category = trimToNull(req.query.category);
        const limit = asPositiveInteger(req.query.limit);
        let items = await listProducts();

        if (category) {
            items = items.filter((item) => item.categorySlug === category);
        }

        if (limit) {
            items = items.slice(0, limit);
        }

        res.json({ ok: true, items });
    }
    catch (error) {
        next(error);
    }
});

router.get("/products/:slug", async (req, res, next) => {
    try {
        const slug = trimToNull(req.params.slug);

        if (!slug) {
            throw createHttpError(400, "Product slug is required.");
        }

        const product = await getProductBySlug(slug);

        if (!product) {
            throw createHttpError(404, "Product not found.");
        }

        res.json({ ok: true, item: product });
    }
    catch (error) {
        next(error);
    }
});

router.get("/news", async (req, res, next) => {
    try {
        const limit = asPositiveInteger(req.query.limit);
        let items = await listNews();

        if (limit) {
            items = items.slice(0, limit);
        }

        res.json({ ok: true, items });
    }
    catch (error) {
        next(error);
    }
});

router.get("/news/:slug", async (req, res, next) => {
    try {
        const slug = trimToNull(req.params.slug);

        if (!slug) {
            throw createHttpError(400, "News slug is required.");
        }

        const article = await getNewsBySlug(slug);

        if (!article) {
            throw createHttpError(404, "News article not found.");
        }

        res.json({ ok: true, item: article });
    }
    catch (error) {
        next(error);
    }
});

router.post("/contact-messages", async (req, res, next) => {
    try {
        const sourcePage = trimToNull(req.body.source_page);
        const name = trimToNull(req.body.name);
        const phone = trimToNull(req.body.phone);
        const email = trimToNull(req.body.email);
        const message = trimToNull(req.body.message);

        if (!sourcePage || !allowedSourcePages.has(sourcePage)) {
            throw createHttpError(400, "Invalid source_page value.");
        }

        if (!name && !phone && !email && !message) {
            throw createHttpError(400, "At least one contact field must be filled.");
        }

        const result = await pool.query(
            `
                INSERT INTO contact_message (source_page, name, phone, email, message)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING contact_message_id, created_at
            `,
            [sourcePage, name, phone, email, message]
        );

        res.status(201).json({
            ok: true,
            contactMessageId: result.rows[0].contact_message_id,
            createdAt: result.rows[0].created_at
        });
    }
    catch (error) {
        next(error);
    }
});

router.post("/purchase-requests", async (req, res, next) => {
    const contact = req.body.contact || {};
    const partner = req.body.partner || {};
    const delivery = req.body.delivery || {};
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const agreementAccepted = req.body.agreement_accepted === true;

    const preparedContact = {
        full_name: normalizeWhitespace(contact.full_name),
        email: trimToNull(contact.email),
        job_title: normalizeWhitespace(contact.job_title),
        phone: formatRussianPhone(contact.phone)
    };

    const preparedPartner = {
        company_name: trimToNull(partner.company_name),
        inn: digitsOnly(partner.inn),
        ogrn: digitsOnly(partner.ogrn),
        legal_address: trimToNull(partner.legal_address)
    };

    const preparedDelivery = {
        delivery_type: trimToNull(delivery.delivery_type),
        delivery_address: trimToNull(delivery.delivery_address),
        delivery_comment: trimToNull(delivery.delivery_comment)
    };

    const preparedItems = items
        .map((item) => ({
            product_slug: trimToNull(item.product_slug),
            quantity_tons: asPositiveNumber(item.quantity_tons)
        }))
        .filter((item) => item.product_slug && Number.isFinite(item.quantity_tons));

    if (!preparedContact.full_name || !preparedContact.email || !preparedContact.job_title || !preparedContact.phone) {
        return next(createHttpError(400, "Contact fields are required."));
    }

    if (containsDigits(preparedContact.full_name)) {
        return next(createHttpError(400, "Full name must not contain digits."));
    }

    if (!isValidRussianPhone(normalizeRussianPhone(contact.phone))) {
        return next(createHttpError(400, "Phone format is invalid."));
    }

    if (!preparedPartner.company_name || !preparedPartner.inn || !preparedPartner.ogrn || !preparedPartner.legal_address) {
        return next(createHttpError(400, "Company fields are required."));
    }

    if (preparedPartner.inn.length !== 10 || preparedPartner.ogrn.length !== 13) {
        return next(createHttpError(400, "INN or OGRN format is invalid."));
    }

    if (!agreementAccepted) {
        return next(createHttpError(400, "Agreement must be accepted."));
    }

    if (!preparedItems.length) {
        return next(createHttpError(400, "At least one product is required."));
    }

    if (preparedItems.some((item) => item.quantity_tons < 25)) {
        return next(createHttpError(400, "Each quantity must be at least 25 tons."));
    }

    if (preparedDelivery.delivery_type && !allowedDeliveryTypes.has(preparedDelivery.delivery_type)) {
        return next(createHttpError(400, "Delivery type is invalid."));
    }

    if (preparedDelivery.delivery_type !== "company_transport") {
        preparedDelivery.delivery_address = null;
    }

    if (preparedDelivery.delivery_type === "company_transport" && !preparedDelivery.delivery_address) {
        return next(createHttpError(400, "Delivery address is required when company delivery is selected."));
    }

    const client = await pool.connect();
    let requestRecord = null;
    let invoicePayload = null;

    try {
        await client.query("BEGIN");

        const contactResult = await client.query(
            `
                INSERT INTO company_contact (full_name, email, job_title, phone)
                VALUES ($1, $2, $3, $4)
                RETURNING company_contact_id
            `,
            [preparedContact.full_name, preparedContact.email, preparedContact.job_title, preparedContact.phone]
        );

        const partnerResult = await client.query(
            `
                INSERT INTO company_partner (company_name, inn, ogrn, legal_address)
                VALUES ($1, $2, $3, $4)
                RETURNING company_partner_id
            `,
            [preparedPartner.company_name, preparedPartner.inn, preparedPartner.ogrn, preparedPartner.legal_address]
        );

        const requestResult = await client.query(
            `
                INSERT INTO purchase_request (company_contact_id, company_partner_id, agreement_accepted)
                VALUES ($1, $2, $3)
                RETURNING purchase_request_id, request_number, created_at
            `,
            [contactResult.rows[0].company_contact_id, partnerResult.rows[0].company_partner_id, true]
        );

        const requestedSlugs = [...new Set(preparedItems.map((item) => item.product_slug))];
        const productResult = await client.query(
            `
                SELECT product_id, slug, name, price, is_active
                FROM product
                WHERE slug = ANY($1::text[])
            `,
            [requestedSlugs]
        );

        const productsBySlug = new Map(productResult.rows.map((row) => [row.slug, row]));
        const invoiceItems = [];
        let totalAmount = 0;

        for (const item of preparedItems) {
            const product = productsBySlug.get(item.product_slug);

            if (!product || !product.is_active) {
                throw createHttpError(400, `Product is unavailable: ${item.product_slug}`);
            }

            await client.query(
                `
                    INSERT INTO request_product (purchase_request_id, product_id, quantity_tons, price)
                    VALUES ($1, $2, $3, $4)
                `,
                [requestResult.rows[0].purchase_request_id, product.product_id, item.quantity_tons, product.price]
            );

            const lineTotal = Number(product.price) * item.quantity_tons;
            totalAmount += lineTotal;
            invoiceItems.push({
                name: product.name,
                quantityTons: item.quantity_tons,
                price: Number(product.price),
                lineTotal
            });
        }

        await client.query(
            `
                INSERT INTO delivery (purchase_request_id, delivery_type, delivery_address, delivery_comment)
                VALUES ($1, $2, $3, $4)
            `,
            [
                requestResult.rows[0].purchase_request_id,
                preparedDelivery.delivery_type,
                preparedDelivery.delivery_address,
                preparedDelivery.delivery_comment
            ]
        );

        await client.query("COMMIT");

        requestRecord = requestResult.rows[0];
        invoicePayload = {
            requestNumber: requestResult.rows[0].request_number,
            createdAt: requestResult.rows[0].created_at,
            contact: {
                fullName: preparedContact.full_name,
                email: preparedContact.email,
                jobTitle: preparedContact.job_title,
                phone: preparedContact.phone
            },
            partner: {
                companyName: preparedPartner.company_name,
                inn: preparedPartner.inn,
                ogrn: preparedPartner.ogrn,
                legalAddress: preparedPartner.legal_address
            },
            delivery: {
                deliveryType: preparedDelivery.delivery_type,
                deliveryAddress: preparedDelivery.delivery_address,
                deliveryComment: preparedDelivery.delivery_comment
            },
            items: invoiceItems,
            totalAmount
        };
    }
    catch (error) {
        await client.query("ROLLBACK");
        next(error);
        return;
    }
    finally {
        client.release();
    }

    let emailResult;
    let storageResult = {
        status: "skipped",
        message: "Cloudinary upload was skipped.",
        url: null,
        publicId: null
    };

    try {
        const invoiceBuffer = await generateInvoicePdf(invoicePayload);
        const invoiceFileName = buildInvoiceFileName(requestRecord.request_number);

        storageResult = await uploadInvoicePdf({
            invoiceBuffer,
            requestNumber: requestRecord.request_number,
            invoiceFileName
        });

        emailResult = await sendPurchaseRequestInvoiceEmail({
            contactEmail: preparedContact.email,
            requestNumber: requestRecord.request_number,
            invoiceBuffer,
            invoiceFileName
        });
    }
    catch (error) {
        emailResult = createInvoiceFailureResult(preparedContact.email, error);
    }

    res.status(201).json({
        ok: true,
        purchaseRequestId: requestRecord.purchase_request_id,
        requestNumber: requestRecord.request_number,
        emailStatus: emailResult.status,
        emailMessage: emailResult.message,
        emailRecipients: emailResult.recipients || [],
        emailFailedRecipients: emailResult.failedRecipients || [],
        invoiceStorageStatus: storageResult.status,
        invoiceStorageMessage: storageResult.message,
        invoiceUrl: storageResult.url || null,
        invoicePublicId: storageResult.publicId || null
    });
});

module.exports = router;


