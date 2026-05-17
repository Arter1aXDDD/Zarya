const { v2: cloudinary } = require("cloudinary");
const { env } = require("../config/env");

cloudinary.config({
    cloud_name: env.cloudinaryCloudName || undefined,
    api_key: env.cloudinaryApiKey || undefined,
    api_secret: env.cloudinaryApiSecret || undefined,
    secure: true
});

function sanitizeRequestNumber(requestNumber) {
    return String(requestNumber || "invoice")
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getCloudinaryStatusSummary() {
    if (!env.cloudinaryConfigured) {
        return {
            configured: false,
            message: "Cloudinary is not fully configured. Invoice archive upload is disabled until CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_SECRET are filled."
        };
    }

    return {
        configured: true,
        message: `Cloudinary archive is configured for cloud ${env.cloudinaryCloudName}.`
    };
}

async function uploadInvoicePdf({ invoiceBuffer, requestNumber, invoiceFileName }) {
    if (!env.cloudinaryConfigured) {
        return {
            status: "skipped",
            message: "Cloudinary is not configured yet. Online invoice storage was skipped.",
            url: null,
            publicId: null
        };
    }

    const publicId = `${env.cloudinaryFolder}/nakladnaya-${sanitizeRequestNumber(requestNumber)}.pdf`;

    return new Promise((resolve) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: "raw",
                public_id: publicId,
                overwrite: true,
                invalidate: true,
                use_filename: false,
                unique_filename: false,
                filename_override: invoiceFileName
            },
            (error, result) => {
                if (error || !result) {
                    console.error("Cloudinary upload failed:", error ? error.message : "Unknown upload error");
                    resolve({
                        status: "failed",
                        message: "Cloudinary upload failed. The invoice remains available only on the server side and in email attachments.",
                        url: null,
                        publicId: null
                    });
                    return;
                }

                resolve({
                    status: "uploaded",
                    message: "Invoice copy uploaded to Cloudinary.",
                    url: result.secure_url || null,
                    publicId: result.public_id || publicId
                });
            }
        );

        uploadStream.end(invoiceBuffer);
    });
}

module.exports = {
    getCloudinaryStatusSummary,
    uploadInvoicePdf
};
