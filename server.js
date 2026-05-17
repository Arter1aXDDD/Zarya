const path = require("path");
const express = require("express");
const { env } = require("./src/config/env");
const { pingDatabase } = require("./src/db/pool");
const { getEmailStatusSummary } = require("./src/services/email");
const { getCloudinaryStatusSummary } = require("./src/services/cloudinary");
const { mountAdmin } = require("./src/admin/panel");
const apiRouter = require("./src/routes/api");

async function startServer() {
    const app = express();
    const rootDir = __dirname;

    app.disable("x-powered-by");

    let adminState = null;

    try {
        adminState = await mountAdmin(app);
    }
    catch (error) {
        console.error("AdminJS initialization failed:", error.message);
    }

    const htmlDir = path.join(rootDir, "html");

    app.use("/api", express.json({ limit: "1mb" }));
    app.use("/api", express.urlencoded({ extended: true }));
    app.use("/api", apiRouter);
    app.use(express.static(htmlDir));
    app.use("/html", express.static(htmlDir));
    app.use("/css", express.static(path.join(rootDir, "css")));
    app.use("/js", express.static(path.join(rootDir, "js")));
    app.use("/img", express.static(path.join(rootDir, "img")));

    app.use("/api", (req, res) => {
        res.status(404).json({ ok: false, error: "API route not found." });
    });

    app.use((err, req, res, next) => {
        console.error(err);

        if (res.headersSent) {
            return next(err);
        }

        res.status(err.statusCode || 500).json({
            ok: false,
            error: err.publicMessage || "Internal server error."
        });
    });

    app.listen(env.port, async () => {
        console.log(`Server is running at http://localhost:${env.port}`);
        console.log("Static frontend pages are served from /html and assets from /css, /js, /img.");

        if (adminState) {
            console.log(`AdminJS is mounted at http://localhost:${env.port}${adminState.rootPath}`);
        }
        else {
            console.log("AdminJS is currently unavailable. Check the startup error above.");
        }

        try {
            await pingDatabase();
            console.log("PostgreSQL connection: OK");
        }
        catch (error) {
            console.error("PostgreSQL connection failed:", error.message);
        }

        const emailStatus = getEmailStatusSummary();
        console.log(emailStatus.message);

        const cloudinaryStatus = getCloudinaryStatusSummary();
        console.log(cloudinaryStatus.message);
    });
}

startServer().catch((error) => {
    console.error("Server startup failed:", error);
    process.exit(1);
});





