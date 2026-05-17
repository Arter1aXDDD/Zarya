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

function ensureSpace(doc, height) {
    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    if (doc.y + height > bottomLimit) {
        doc.addPage();
    }
}

function drawRoundedPanel(doc, { x, y, width, height, fill = "#ffffff", stroke = COLORS.border, radius = 8 }) {
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
    const rightPanelWidth = 188;
    const rightPanelHeight = 92;
    const rightPanelX = leftX + contentWidth - rightPanelWidth;

    doc.save();
    doc.fillColor(COLORS.accent);
    doc.rect(leftX, topY - 10, contentWidth, 7).fill();
    doc.restore();

    doc.x = leftX;
    doc.y = topY + 10;
    doc.fontSize(11).fillColor(COLORS.accent).text("ООО «Заря»", { width: 280 });
    doc.moveDown(0.25);
    doc.fontSize(24).fillColor(COLORS.text).text("Накладная по заявке", { width: 300 });
    doc.moveDown(0.15);
    doc.fontSize(11).fillColor(COLORS.muted).text(
        "Документ на поставку сельскохозяйственной продукции",
        { width: 300 }
    );

    drawRoundedPanel(doc, {
        x: rightPanelX,
        y: topY + 6,
        width: rightPanelWidth,
        height: rightPanelHeight,
        fill: COLORS.accentSoft,
        stroke: COLORS.border,
        radius: 10
    });

    const metaX = rightPanelX + 14;
    let metaY = topY + 20;
    doc.fontSize(10).fillColor(COLORS.muted).text("Номер заявки", metaX, metaY, { width: 160 });
    metaY += 14;
    doc.fontSize(16).fillColor(COLORS.text).text(invoice.requestNumber, metaX, metaY, { width: 160 });
    metaY += 24;
    doc.fontSize(10).fillColor(COLORS.muted).text("Дата оформления", metaX, metaY, { width: 160 });
    metaY += 14;
    doc.fontSize(11).fillColor(COLORS.text).text(formatDateTime(invoice.createdAt), metaX, metaY, { width: 160 });

    doc.y = Math.max(doc.y, topY + 6 + rightPanelHeight) + 16;
}

function drawSectionBlock(doc, title, rows) {
    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const padding = 14;
    const labelWidth = 156;

    doc.fontSize(10);
    let rowsHeight = 0;

    for (const row of rows) {
        const value = row.value || "—";
        const valueHeight = doc.heightOfString(String(value), {
            width: width - padding * 2 - labelWidth - 8
        });
        rowsHeight += Math.max(14, valueHeight) + 8;
    }

    const blockHeight = padding + 18 + 10 + rowsHeight + 4;
    ensureSpace(doc, blockHeight + 12);

    const y = doc.y;
    drawRoundedPanel(doc, {
        x,
        y,
        width,
        height: blockHeight,
        fill: "#ffffff",
        stroke: COLORS.border,
        radius: 10
    });

    doc.fontSize(12).fillColor(COLORS.accent).text(title, x + padding, y + padding, {
        width: width - padding * 2
    });

    let rowY = y + padding + 24;

    for (const row of rows) {
        const value = row.value || "—";
        const valueHeight = doc.heightOfString(String(value), {
            width: width - padding * 2 - labelWidth - 8
        });
        const rowHeight = Math.max(14, valueHeight);

        doc.fontSize(10).fillColor(COLORS.muted).text(`${row.label}:`, x + padding, rowY, {
            width: labelWidth
        });
        doc.fillColor(COLORS.text).text(String(value), x + padding + labelWidth + 8, rowY, {
            width: width - padding * 2 - labelWidth - 8
        });

        rowY += rowHeight + 8;
    }

    doc.y = y + blockHeight + 14;
}

function drawItemsTable(doc, invoice) {
    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columns = {
        number: 36,
        name: 215,
        quantity: 72,
        price: 88,
        total: 100
    };
    const paddingX = 8;

    ensureSpace(doc, 80);
    doc.fontSize(14).fillColor(COLORS.text).text("Состав поставки", x, doc.y, { width });
    doc.moveDown(0.35);

    const drawTableHeader = (label = "Состав поставки") => {
        if (label) {
            doc.fontSize(13).fillColor(COLORS.text).text(label, x, doc.y, { width });
            doc.moveDown(0.25);
        }

        ensureSpace(doc, 30);
        const headerY = doc.y;

        doc.save();
        doc.fillColor(COLORS.tableHeader);
        doc.roundedRect(x, headerY, width, 26, 8).fill();
        doc.restore();

        let cursorX = x + paddingX;
        doc.fontSize(10).fillColor("#ffffff");
        doc.text("№", cursorX, headerY + 8, { width: columns.number - paddingX * 2, align: "left" });
        cursorX += columns.number;
        doc.text("Наименование", cursorX + paddingX, headerY + 8, { width: columns.name - paddingX * 2 });
        cursorX += columns.name;
        doc.text("Кол-во, т", cursorX + paddingX, headerY + 8, { width: columns.quantity - paddingX * 2, align: "right" });
        cursorX += columns.quantity;
        doc.text("Цена, руб./т", cursorX + paddingX, headerY + 8, { width: columns.price - paddingX * 2, align: "right" });
        cursorX += columns.price;
        doc.text("Сумма, руб.", cursorX + paddingX, headerY + 8, { width: columns.total - paddingX * 2, align: "right" });

        doc.y = headerY + 32;
    };

    drawTableHeader("");

    invoice.items.forEach((item, index) => {
        doc.fontSize(10);
        const rowHeight = Math.max(
            20,
            doc.heightOfString(item.name, { width: columns.name - paddingX * 2 }) + 10
        );

        if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            doc.font(resolveInvoiceFontPath());
            drawTableHeader("Состав поставки (продолжение)");
        }

        const rowY = doc.y;

        if (index % 2 === 0) {
            doc.save();
            doc.fillColor(COLORS.tableStripe);
            doc.roundedRect(x, rowY - 2, width, rowHeight + 4, 6).fill();
            doc.restore();
        }

        let cursorX = x + paddingX;
        doc.fillColor(COLORS.text);
        doc.text(String(index + 1), cursorX, rowY + 6, { width: columns.number - paddingX * 2 });
        cursorX += columns.number;
        doc.text(item.name, cursorX + paddingX, rowY + 6, { width: columns.name - paddingX * 2 });
        cursorX += columns.name;
        doc.text(formatQuantity(item.quantityTons), cursorX + paddingX, rowY + 6, {
            width: columns.quantity - paddingX * 2,
            align: "right"
        });
        cursorX += columns.quantity;
        doc.text(formatCurrency(item.price), cursorX + paddingX, rowY + 6, {
            width: columns.price - paddingX * 2,
            align: "right"
        });
        cursorX += columns.price;
        doc.text(formatCurrency(item.lineTotal), cursorX + paddingX, rowY + 6, {
            width: columns.total - paddingX * 2,
            align: "right"
        });

        doc.save();
        doc.strokeColor(COLORS.border);
        doc.moveTo(x, rowY + rowHeight + 4).lineTo(x + width, rowY + rowHeight + 4).stroke();
        doc.restore();

        doc.y = rowY + rowHeight + 10;
    });
}

function drawSummary(doc, invoice) {
    const width = 198;
    const x = doc.page.width - doc.page.margins.right - width;

    ensureSpace(doc, 92);
    const y = doc.y + 4;

    drawRoundedPanel(doc, {
        x,
        y,
        width,
        height: 74,
        fill: COLORS.accentSoft,
        stroke: COLORS.border,
        radius: 10
    });

    doc.fontSize(10).fillColor(COLORS.muted).text("Итоговая сумма", x + 14, y + 14, { width: width - 28 });
    doc.fontSize(18).fillColor(COLORS.text).text(`${formatCurrency(invoice.totalAmount)} руб.`, x + 14, y + 30, {
        width: width - 28,
        align: "right"
    });
    doc.fontSize(9).fillColor(COLORS.muted).text(
        "Стоимость зафиксирована на момент оформления заявки.",
        x + 14,
        y + 56,
        { width: width - 28, align: "right" }
    );

    doc.y = y + 88;
}

function drawFooter(doc) {
    ensureSpace(doc, 70);

    doc.save();
    doc.strokeColor(COLORS.border);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.restore();

    doc.moveDown(0.55);
    doc.fontSize(9).fillColor(COLORS.muted).text(
        "Документ сформирован автоматически на основании отправленной заявки и используется для согласования состава поставки, стоимости и условий отгрузки.",
        { align: "left" }
    );
    doc.moveDown(0.2);
    doc.text(
        "Окончательные условия поставки подтверждаются менеджером ООО «Заря» после обработки заявки.",
        { align: "left" }
    );
}

function generateInvoicePdf(invoice) {
    const fontPath = resolveInvoiceFontPath();

    if (!fontPath) {
        throw new Error("Не найден шрифт для генерации PDF. Укажите INVOICE_FONT_PATH в .env.");
    }

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 42 });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        try {
            doc.font(fontPath);

            drawHeader(doc, invoice);

            drawSectionBlock(doc, "Поставщик", [
                { label: "Организация", value: "ООО «Заря»" },
                { label: "Электронная почта", value: env.orderNotificationEmail || env.smtpFrom || "Не указана" },
                { label: "Основание", value: `Заявка ${invoice.requestNumber} от ${formatDateTime(invoice.createdAt)}` }
            ]);

            drawSectionBlock(doc, "Покупатель", [
                { label: "Предприятие", value: invoice.partner.companyName },
                { label: "ИНН", value: invoice.partner.inn },
                { label: "ОГРН", value: invoice.partner.ogrn },
                { label: "Юридический адрес", value: invoice.partner.legalAddress }
            ]);

            drawSectionBlock(doc, "Контактное лицо", [
                { label: "ФИО", value: invoice.contact.fullName },
                { label: "Должность", value: invoice.contact.jobTitle },
                { label: "Телефон", value: invoice.contact.phone },
                { label: "E-mail", value: invoice.contact.email }
            ]);

            drawSectionBlock(doc, "Условия отгрузки", [
                { label: "Способ доставки", value: deliveryTypeLabels[invoice.delivery.deliveryType] || "Не указан" },
                { label: "Адрес доставки", value: invoice.delivery.deliveryAddress || "Не указан" },
                { label: "Комментарий", value: invoice.delivery.deliveryComment || "Не указан" }
            ]);

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
