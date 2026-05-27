require("dotenv").config();

function parsePort(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value, fallback) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    const normalized = String(value).trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }

    return fallback;
}

function trimToNull(value) {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

const smtpHost = trimToNull(process.env.SMTP_HOST);
const smtpUser = trimToNull(process.env.SMTP_USER);
const smtpPass = trimToNull(process.env.SMTP_PASS);
const smtpFrom = trimToNull(process.env.SMTP_FROM) || smtpUser;
const resendApiKey = trimToNull(process.env.RESEND_API_KEY);
const resendTestToEmail = trimToNull(process.env.RESEND_TEST_TO_EMAIL);
const resendReplyTo = trimToNull(process.env.RESEND_REPLY_TO) || trimToNull(process.env.ORDER_NOTIFICATION_EMAIL) || smtpFrom;
const cloudinaryCloudName = trimToNull(process.env.CLOUDINARY_CLOUD_NAME);
const cloudinaryApiKey = trimToNull(process.env.CLOUDINARY_API_KEY);
const cloudinaryApiSecret = trimToNull(process.env.CLOUDINARY_API_SECRET);

const env = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: parsePort(process.env.PORT, 3000),
    pgHost: process.env.PGHOST || "localhost",
    pgPort: parsePort(process.env.PGPORT, 5432),
    pgDatabase: process.env.PGDATABASE || "zarya",
    pgUser: process.env.PGUSER || "postgres",
    pgPassword: process.env.PGPASSWORD || "postgres",
    pgSslMode: trimToNull(process.env.PGSSLMODE),
    smtpHost,
    smtpPort: parsePort(process.env.SMTP_PORT, 465),
    smtpSecure: parseBoolean(process.env.SMTP_SECURE, true),
    smtpUser,
    smtpPass,
    smtpFrom,
    resendApiKey,
    resendTestToEmail,
    resendReplyTo,
    orderNotificationEmail: trimToNull(process.env.ORDER_NOTIFICATION_EMAIL),
    invoiceFontPath: trimToNull(process.env.INVOICE_FONT_PATH),
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    cloudinaryFolder: trimToNull(process.env.CLOUDINARY_FOLDER) || "zarya/invoices",
    adminCookieName: trimToNull(process.env.ADMIN_COOKIE_NAME) || "zarya_admin",
    adminCookiePassword: trimToNull(process.env.ADMIN_COOKIE_PASSWORD) || "zarya-admin-dev-cookie-secret-2026-change-me"
};

env.smtpConfigured = Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFrom);
env.resendConfigured = Boolean(env.resendApiKey && env.resendTestToEmail);
env.cloudinaryConfigured = Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);

module.exports = { env };
