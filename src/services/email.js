const nodemailer = require("nodemailer");
const { env } = require("../config/env");

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM = "ООО «Заря» <onboarding@resend.dev>";
const RESEND_USER_AGENT = "zarya-render/1.0";

function getEmailStatusSummary() {
    if (env.resendConfigured) {
        return {
            configured: true,
            message: `Resend testing mode is configured. Invoices will be sent via onboarding@resend.dev only to ${env.resendTestToEmail}.`
        };
    }

    if (!env.smtpConfigured) {
        return {
            configured: false,
            message: "SMTP не настроен. Отправка накладных будет недоступна, пока не заполнены переменные SMTP_* или RESEND_* ."
        };
    }

    if (!env.orderNotificationEmail) {
        return {
            configured: true,
            message: `SMTP настроен для ${env.smtpHost}:${env.smtpPort}. Накладные будут отправляться только контактному лицу из заявки.`
        };
    }

    return {
        configured: true,
        message: `SMTP настроен для ${env.smtpHost}:${env.smtpPort}. Копия накладной также будет отправляться на ${env.orderNotificationEmail}.`
    };
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildRecipientTargets(contactEmail) {
    const candidates = [
        contactEmail ? { email: contactEmail, kind: "contact" } : null,
        env.orderNotificationEmail ? { email: env.orderNotificationEmail, kind: "company" } : null
    ].filter(Boolean);

    const uniqueTargets = [];
    const seen = new Set();

    for (const candidate of candidates) {
        const normalized = String(candidate.email).trim().toLowerCase();
        if (!normalized || seen.has(normalized)) {
            continue;
        }

        seen.add(normalized);
        uniqueTargets.push(candidate);
    }

    return uniqueTargets;
}

function formatFromHeader() {
    if (!env.smtpFrom) {
        return undefined;
    }

    return env.smtpFrom.includes("<") ? env.smtpFrom : `ООО «Заря» <${env.smtpFrom}>`;
}

function buildSubject(requestNumber, recipientKind) {
    if (recipientKind === "company") {
        return `[Копия] Накладная по заявке ${requestNumber}`;
    }

    return `Накладная по заявке ${requestNumber}`;
}

function buildTextBody({ requestNumber, recipientKind }) {
    const lines = [
        "Здравствуйте!",
        "",
        recipientKind === "company"
            ? `На адрес предприятия направляется служебная копия накладной по заявке ${requestNumber}.`
            : `Направляем накладную по вашей заявке ${requestNumber}.`,
        "PDF-документ приложен к письму.",
        "",
        "Если потребуется уточнить позиции, стоимость или условия отгрузки, ответьте на это письмо.",
        "",
        "С уважением,",
        "ООО «Заря»"
    ];

    return lines.join("\n");
}

function buildHtmlBody({ requestNumber, recipientKind }) {
    const title = recipientKind === "company"
        ? "Служебная копия накладной"
        : "Накладная по заявке сформирована";
    const intro = recipientKind === "company"
        ? `На адрес предприятия направляется служебная копия накладной по заявке <strong>${escapeHtml(requestNumber)}</strong>.`
        : `Направляем накладную по вашей заявке <strong>${escapeHtml(requestNumber)}</strong>.`;

    return `
        <div style="margin:0; padding:32px 16px; background:#f3efe4; font-family:Arial, Helvetica, sans-serif; color:#202020;">
            <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e3dfd4; border-radius:18px; overflow:hidden; box-shadow:0 18px 44px rgba(32,32,32,.08);">
                <div style="padding:22px 28px; background:#5b744f; color:#fff7e6;">
                    <div style="font-size:12px; letter-spacing:.12em; text-transform:uppercase; opacity:.82;">ООО «Заря»</div>
                    <div style="margin-top:8px; font-size:28px; line-height:1.2; font-weight:700;">${title}</div>
                </div>
                <div style="padding:28px;">
                    <p style="margin:0 0 14px; font-size:16px; line-height:1.65;">Здравствуйте!</p>
                    <p style="margin:0 0 14px; font-size:16px; line-height:1.65;">${intro}</p>
                    <p style="margin:0; font-size:16px; line-height:1.65;">PDF-документ приложен к письму и содержит состав заявки, стоимость по позициям и сведения для дальнейшей обработки.</p>
                    <div style="margin-top:24px; padding:18px 20px; border-radius:14px; background:#fbfaf7; border:1px solid #ece6da;">
                        <div style="font-size:13px; color:#736a58; margin-bottom:6px;">Номер заявки</div>
                        <div style="font-size:24px; font-weight:700; color:#202020;">${escapeHtml(requestNumber)}</div>
                    </div>
                    <p style="margin:24px 0 0; font-size:14px; line-height:1.65; color:#595959;">Если потребуется уточнить позиции, стоимость или условия отгрузки, ответьте на это письмо.</p>
                </div>
                <div style="padding:18px 28px 24px; border-top:1px solid #efe7d9; color:#6f6756; font-size:14px; line-height:1.6;">
                    С уважением,<br>
                    ООО «Заря»
                </div>
            </div>
        </div>
    `;
}

function wasAccepted(info, recipient) {
    if (!Array.isArray(info.accepted) || !info.accepted.length) {
        return false;
    }

    return info.accepted.some((accepted) => String(accepted).trim().toLowerCase() === recipient.trim().toLowerCase());
}

function buildResendTestingSubject(requestNumber) {
    return `[TEST] Накладная по заявке ${requestNumber}`;
}

function buildResendTestingTextBody({ contactEmail, requestNumber, intendedRecipients }) {
    const formattedRecipients = intendedRecipients.length ? intendedRecipients.join(", ") : "не определено";

    return [
        "Тестовый режим Resend (resend.dev)",
        "",
        `Заявка ${requestNumber} обработана, накладная приложена к письму.`,
        `Тестовый адрес получения: ${env.resendTestToEmail}.`,
        `Исходный e-mail контактного лица: ${contactEmail || "не указан"}.`,
        `Кому письмо должно было уйти в боевом режиме: ${formattedRecipients}.`,
        "",
        "Это письмо отправлено через тестовый домен Resend и не уходит реальным получателям.",
        ""
    ].join("\n");
}

function buildResendTestingHtmlBody({ contactEmail, requestNumber, intendedRecipients }) {
    const recipientsHtml = intendedRecipients.length
        ? `<ul style="margin:8px 0 0 18px; padding:0;">${intendedRecipients.map((email) => `<li>${escapeHtml(email)}</li>`).join("")}</ul>`
        : '<div style="margin-top:8px;">Не определено</div>';

    return `
        <div style="margin:0; padding:32px 16px; background:#f3efe4; font-family:Arial, Helvetica, sans-serif; color:#202020;">
            <div style="max-width:680px; margin:0 auto; background:#ffffff; border:1px solid #e3dfd4; border-radius:18px; overflow:hidden; box-shadow:0 18px 44px rgba(32,32,32,.08);">
                <div style="padding:22px 28px; background:#5b744f; color:#fff7e6;">
                    <div style="font-size:12px; letter-spacing:.12em; text-transform:uppercase; opacity:.82;">Resend Test Mode</div>
                    <div style="margin-top:8px; font-size:28px; line-height:1.2; font-weight:700;">Накладная по заявке ${escapeHtml(requestNumber)}</div>
                </div>
                <div style="padding:28px;">
                    <p style="margin:0 0 14px; font-size:16px; line-height:1.65;">PDF накладной приложен к письму.</p>
                    <p style="margin:0 0 14px; font-size:16px; line-height:1.65;">Это тестовая отправка через <strong>onboarding@resend.dev</strong>, поэтому письмо пришло только на тестовый адрес <strong>${escapeHtml(env.resendTestToEmail)}</strong>.</p>
                    <div style="margin-top:22px; padding:18px 20px; border-radius:14px; background:#fbfaf7; border:1px solid #ece6da;">
                        <div style="font-size:13px; color:#736a58; margin-bottom:6px;">Исходный e-mail контактного лица</div>
                        <div style="font-size:18px; font-weight:600; color:#202020;">${escapeHtml(contactEmail || "не указан")}</div>
                    </div>
                    <div style="margin-top:18px; padding:18px 20px; border-radius:14px; background:#fbfaf7; border:1px solid #ece6da;">
                        <div style="font-size:13px; color:#736a58; margin-bottom:6px;">Кому письмо должно было уйти в боевом режиме</div>
                        ${recipientsHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function sendPurchaseRequestInvoiceEmail({ contactEmail, requestNumber, invoiceBuffer, invoiceFileName }) {
    const recipients = buildRecipientTargets(contactEmail);

    if (env.resendConfigured) {
        try {
            const response = await fetch(RESEND_API_URL, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${env.resendApiKey}`,
                    "Content-Type": "application/json",
                    "User-Agent": RESEND_USER_AGENT
                },
                body: JSON.stringify({
                    from: RESEND_FROM,
                    to: [env.resendTestToEmail],
                    ...(env.resendReplyTo ? { reply_to: env.resendReplyTo } : {}),
                    subject: buildResendTestingSubject(requestNumber),
                    text: buildResendTestingTextBody({
                        contactEmail,
                        requestNumber,
                        intendedRecipients: recipients.map((recipient) => recipient.email)
                    }),
                    html: buildResendTestingHtmlBody({
                        contactEmail,
                        requestNumber,
                        intendedRecipients: recipients.map((recipient) => recipient.email)
                    }),
                    attachments: [
                        {
                            filename: invoiceFileName,
                            content: invoiceBuffer.toString("base64")
                        }
                    ]
                })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(result.message || result.name || `Resend API request failed with status ${response.status}`);
            }

            if (!result.id) {
                throw new Error("Resend API did not return an email id.");
            }

            return {
                status: "sent",
                message: `Накладная отправлена в тестовый ящик ${env.resendTestToEmail} через Resend.`,
                recipients: [env.resendTestToEmail]
            };
        }
        catch (error) {
            console.error(`Invoice email failed for Resend test recipient ${env.resendTestToEmail}:`, error.message);
            return {
                status: "failed",
                message: "Заявка сохранена, но тестовую отправку через Resend выполнить не удалось.",
                recipients: [],
                failedRecipients: [env.resendTestToEmail]
            };
        }
    }

    if (!env.smtpConfigured) {
        return {
            status: "skipped",
            message: "SMTP пока не настроен. Заявка сохранена, но накладная не была отправлена.",
            recipients: recipients.map((recipient) => recipient.email)
        };
    }

    if (!recipients.length) {
        return {
            status: "failed",
            message: "Заявка сохранена, но адреса получателей для накладной не найдены.",
            recipients: [],
            failedRecipients: []
        };
    }

    const transporter = nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth: {
            user: env.smtpUser,
            pass: env.smtpPass
        }
    });

    const acceptedRecipients = [];
    const failedRecipients = [];

    for (const recipient of recipients) {
        try {
            const info = await transporter.sendMail({
                from: formatFromHeader(),
                to: recipient.email,
                replyTo: env.smtpFrom,
                subject: buildSubject(requestNumber, recipient.kind),
                text: buildTextBody({ requestNumber, recipientKind: recipient.kind }),
                html: buildHtmlBody({ requestNumber, recipientKind: recipient.kind }),
                attachments: [
                    {
                        filename: invoiceFileName,
                        content: invoiceBuffer,
                        contentType: "application/pdf"
                    }
                ]
            });

            if (wasAccepted(info, recipient.email)) {
                acceptedRecipients.push(recipient.email);
            }
            else {
                failedRecipients.push(recipient.email);
            }
        }
        catch (error) {
            failedRecipients.push(recipient.email);
            console.error(`Invoice email failed for ${recipient.email}:`, error.message);
        }
    }

    if (acceptedRecipients.length && !failedRecipients.length) {
        return {
            status: "sent",
            message: "Накладная успешно отправлена всем получателям.",
            recipients: acceptedRecipients
        };
    }

    if (acceptedRecipients.length && failedRecipients.length) {
        return {
            status: "partial",
            message: "Заявка сохранена, но накладная была доставлена не всем получателям.",
            recipients: acceptedRecipients,
            failedRecipients
        };
    }

    return {
        status: "failed",
        message: "Заявка сохранена, но накладную не удалось отправить.",
        recipients: [],
        failedRecipients
    };
}

module.exports = {
    getEmailStatusSummary,
    sendPurchaseRequestInvoiceEmail
};
