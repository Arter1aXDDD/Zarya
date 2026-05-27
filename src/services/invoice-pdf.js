const fs = require("fs");
const PDFDocument = require("pdfkit");
const { env } = require("../config/env");

const COLORS = {
    accent: "#5b744f",
    accentSoft: "#f5f7f1",
    border: "#d9ddd2",
    text: "#202020",
    muted: "#6b6b6b",
    tableStripe: "#fbfcf9",
    tableHeader: "#607951"
};

const deliveryTypeLabels = {
    pickup: "Самовывоз",
    company_transport: "Доставка транспортом компании",
    rail: "Железнодорожная отгрузка"
};

function formatCurrency(value) {
    return new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value || 0));
}

function formatQuantity(value) {
    const numeric = Number(value || 0);
    return Number.isInteger(numeric)
        ? new Intl.NumberFormat("ru-RU").format(numeric)
        : new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(numeric);
}

function formatDateTime(value) {
    return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}

function resolveInvoiceFontPath() {
    const candidates = [
        env.invoiceFontPath,
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\times.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
    ].filter(Boolean);

    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function compactText(value, fallback = "—") {
    if (value === undefined || value === null) {
        return fallback;
    }

    const normalized = String(value).replace(/\s+/g, " ").trim();
    return normalized || fallback;
}

function ensureSpace(doc, height) {
    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    if (doc.y + height > bottomLimit) {
        doc.addPage();
    }
}

function drawRoundedPanel(doc, { x, y, width, height, fill = "#ffffff", stroke = COLORS.border, radius = 7 }) {
    doc.save();
    doc.fillColor(fill);
    doc.strokeColor(stroke);
    doc.lineWidth(1);
    doc.roundedRect(x, y, width, height, radius).fillAndStroke();
    doc.restore();
}

function buildInvoiceFileName(requestNumber) {
    return `nakladnaya-${requestNumber}.pdf`;
}

function drawHeader(doc, invoice) {
    const leftX = doc.page.margins.left;
    const topY = doc.page.margins.top;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const metaWidth = 182;
    const metaHeight = 66;
    const metaX = leftX + contentWidth - metaWidth;

    doc.save();
    doc.fillColor(COLORS.accent);
    doc.rect(leftX, topY - 8, contentWidth, 6).fill();
    doc.restore();

    doc.fontSize(10).fillColor(COLORS.accent).text("ООО «Заря»", leftX, topY + 4, { width: 230 });
    doc.fontSize(21).fillColor(COLORS.text).text("Накладная по заявке", leftX, topY + 18, { width: 260 });
    doc.fontSize(9).fillColor(COLORS.muted).text(
        "Документ на поставку сельскохозяйственной продукции",
        leftX,
        topY + 45,
        { width: 280 }
    );

    drawRoundedPanel(doc, {
        x: metaX,
        y: topY + 2,
        width: metaWidth,
        height: metaHeight,
        fill: COLORS.accentSoft,
        stroke: COLORS.border
    });

    doc.fontSize(8.5).fillColor(COLORS.muted).text("Номер заявки", metaX + 12, topY + 14, { width: 158 });
    doc.fontSize(13.5).fillColor(COLORS.text).text(invoice.requestNumber, metaX + 12, topY + 25, { width: 158 });
    doc.fontSize(8.5).fillColor(COLORS.muted).text("Дата оформления", metaX + 12, topY + 42, { width: 158 });
    doc.fontSize(9.5).fillColor(COLORS.text).text(formatDateTime(invoice.createdAt), metaX + 12, topY + 53, { width: 158 });

    doc.y = topY + metaHeight + 14;
}

function measureInfoCard(doc, width, rows) {
    const padding = 10;
    const labelWidth = 78;
    const valueWidth = width - padding * 2 - labelWidth - 8;
    let rowsHeight = 0;

    doc.fontSize(8.5);

    for (const row of rows) {
        const valueHeight = doc.heightOfString(compactText(row.value), {
            width: valueWidth,
            lineGap: 1
        });
        rowsHeight += Math.max(11, valueHeight) + 4;
    }

    return padding + 16 + rowsHeight + 6;
}

function drawInfoCard(doc, { x, y, width, title, rows, height }) {
    const padding = 10;
    const labelWidth = 78;
    const valueWidth = width - padding * 2 - labelWidth - 8;

    drawRoundedPanel(doc, {
        x,
        y,
        width,
        height,
        fill: "#ffffff",
        stroke: COLORS.border
    });

    doc.fontSize(10.5).fillColor(COLORS.accent).text(title, x + padding, y + padding, { width: width - padding * 2 });

    let rowY = y + padding + 16;
    doc.fontSize(8.5);

    for (const row of rows) {
        const value = compactText(row.value);
        const valueHeight = doc.heightOfString(value, {
            width: valueWidth,
            lineGap: 1
        });
        const rowHeight = Math.max(11, valueHeight);

        doc.fillColor(COLORS.muted).text(`${row.label}:`, x + padding, rowY, {
            width: labelWidth,
            lineGap: 1
        });
        doc.fillColor(COLORS.text).text(value, x + padding + labelWidth + 8, rowY, {
            width: valueWidth,
            lineGap: 1
        });

        rowY += rowHeight + 4;
    }
}

function drawInfoCardRow(doc, leftCard, rightCard) {
    const x = doc.page.margins.left;
    const gap = 12;
    const width = (doc.page.width - doc.page.margins.left - doc.page.margins.right - gap) / 2;
    const leftHeight = measureInfoCard(doc, width, leftCard.rows);
    const rightHeight = measureInfoCard(doc, width, rightCard.rows);
    const height = Math.max(leftHeight, rightHeight);

    ensureSpace(doc, height + 10);

    const y = doc.y;
    drawInfoCard(doc, { x, y, width, title: leftCard.title, rows: leftCard.rows, height });
    drawInfoCard(doc, { x: x + width + gap, y, width, title: rightCard.title, rows: rightCard.rows, height });
    doc.y = y + height + 10;
}

function drawItemsTable(doc, invoice) {
    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columns = {
        number: 24,
        name: 252,
        quantity: 54,
        price: 76,
        total: 85
    };
    const paddingX = 6;

    ensureSpace(doc, 58);
    doc.fontSize(11).fillColor(COLORS.text).text("Состав поставки", x, doc.y, { width });
    doc.moveDown(0.2);

    const drawTableHeader = () => {
        ensureSpace(doc, 24);
        const headerY = doc.y;

        doc.save();
        doc.fillColor(COLORS.tableHeader);
        doc.roundedRect(x, headerY, width, 22, 7).fill();
        doc.restore();

        let cursorX = x + paddingX;
        doc.fontSize(8.5).fillColor("#ffffff");
        doc.text("№", cursorX, headerY + 6, { width: columns.number - paddingX * 2 });
        cursorX += columns.number;
        doc.text("Наименование", cursorX + paddingX, headerY + 6, { width: columns.name - paddingX * 2 });
        cursorX += columns.name;
        doc.text("Кол-во", cursorX + paddingX, headerY + 6, { width: columns.quantity - paddingX * 2, align: "right" });
        cursorX += columns.quantity;
        doc.text("Цена", cursorX + paddingX, headerY + 6, { width: columns.price - paddingX * 2, align: "right" });
        cursorX += columns.price;
        doc.text("Сумма", cursorX + paddingX, headerY + 6, { width: columns.total - paddingX * 2, align: "right" });

        doc.y = headerY + 26;
    };

    drawTableHeader();

    invoice.items.forEach((item, index) => {
        doc.fontSize(8.5);
        const rowHeight = Math.max(
            15,
            doc.heightOfString(compactText(item.name), {
                width: columns.name - paddingX * 2,
                lineGap: 1
            }) + 5
        );

        if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 70) {
            doc.addPage();
            drawTableHeader();
        }

        const rowY = doc.y;

        if (index % 2 === 0) {
            doc.save();
            doc.fillColor(COLORS.tableStripe);
            doc.roundedRect(x, rowY - 1, width, rowHeight + 2, 5).fill();
            doc.restore();
        }

        let cursorX = x + paddingX;
        doc.fillColor(COLORS.text);
        doc.text(String(index + 1), cursorX, rowY + 4, { width: columns.number - paddingX * 2 });
        cursorX += columns.number;
        doc.text(compactText(item.name), cursorX + paddingX, rowY + 4, {
            width: columns.name - paddingX * 2,
            lineGap: 1
        });
        cursorX += columns.name;
        doc.text(formatQuantity(item.quantityTons), cursorX + paddingX, rowY + 4, {
            width: columns.quantity - paddingX * 2,
            align: "right"
        });
        cursorX += columns.quantity;
        doc.text(formatCurrency(item.price), cursorX + paddingX, rowY + 4, {
            width: columns.price - paddingX * 2,
            align: "right"
        });
        cursorX += columns.price;
        doc.text(formatCurrency(item.lineTotal), cursorX + paddingX, rowY + 4, {
            width: columns.total - paddingX * 2,
            align: "right"
        });

        doc.save();
        doc.strokeColor(COLORS.border);
        doc.moveTo(x, rowY + rowHeight + 2).lineTo(x + width, rowY + rowHeight + 2).stroke();
        doc.restore();

        doc.y = rowY + rowHeight + 6;
    });
}

function drawSummary(doc, invoice) {
    const width = 194;
    const x = doc.page.width - doc.page.margins.right - width;

    ensureSpace(doc, 58);
    const y = doc.y + 2;

    drawRoundedPanel(doc, {
        x,
        y,
        width,
        height: 48,
        fill: COLORS.accentSoft,
        stroke: COLORS.border
    });

    doc.fontSize(8.5).fillColor(COLORS.muted).text("Итоговая сумма", x + 12, y + 10, { width: width - 24 });
    doc.fontSize(15).fillColor(COLORS.text).text(`${formatCurrency(invoice.totalAmount)} руб.`, x + 12, y + 22, {
        width: width - 24,
        align: "right"
    });

    doc.y = y + 56;
}

function drawFooter(doc) {
    ensureSpace(doc, 30);

    doc.save();
    doc.strokeColor(COLORS.border);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.restore();

    doc.moveDown(0.25);
    doc.fontSize(7.5).fillColor(COLORS.muted).text(
        "Документ сформирован автоматически и используется для согласования состава поставки и условий отгрузки. Окончательные условия подтверждаются менеджером ООО «Заря».",
        { align: "left", lineGap: 1 }
    );
}

function generateInvoicePdf(invoice) {
    const fontPath = resolveInvoiceFontPath();

    if (!fontPath) {
        throw new Error("Не найден шрифт для генерации PDF. Укажите INVOICE_FONT_PATH в .env.");
    }

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 28 });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        try {
            doc.font(fontPath);

            drawHeader(doc, invoice);

            drawInfoCardRow(doc, {
                title: "Поставщик",
                rows: [
                    { label: "Организация", value: "ООО «Заря»" },
                    { label: "E-mail", value: env.orderNotificationEmail || env.smtpFrom || "Не указан" },
                    { label: "Основание", value: `Заявка ${invoice.requestNumber} от ${formatDateTime(invoice.createdAt)}` }
                ]
            }, {
                title: "Покупатель",
                rows: [
                    { label: "Предприятие", value: invoice.partner.companyName },
                    { label: "ИНН / ОГРН", value: `${compactText(invoice.partner.inn)} / ${compactText(invoice.partner.ogrn)}` },
                    { label: "Адрес", value: invoice.partner.legalAddress }
                ]
            });

            drawInfoCardRow(doc, {
                title: "Контактное лицо",
                rows: [
                    { label: "ФИО", value: invoice.contact.fullName },
                    { label: "Должность", value: invoice.contact.jobTitle },
                    { label: "Контакты", value: `${compactText(invoice.contact.phone)}; ${compactText(invoice.contact.email)}` }
                ]
            }, {
                title: "Условия отгрузки",
                rows: [
                    { label: "Способ", value: deliveryTypeLabels[invoice.delivery.deliveryType] || "Не указан" },
                    { label: "Адрес", value: invoice.delivery.deliveryAddress || "Не указан" },
                    { label: "Комментарий", value: invoice.delivery.deliveryComment || "Не указан" }
                ]
            });

            drawItemsTable(doc, invoice);
            drawSummary(doc, invoice);
            drawFooter(doc);

            doc.end();
        }
        catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    buildInvoiceFileName,
    generateInvoicePdf,
    deliveryTypeLabels
};
