const bcrypt = require("bcryptjs");
const { env } = require("../config/env");
const { pool } = require("../db/pool");

const ADMIN_ROOT_PATH = "/admin";
const hiddenProperty = {
    isVisible: {
        list: false,
        filter: false,
        show: false,
        edit: false
    }
};
const hiddenOnEditProperty = {
    isVisible: {
        list: true,
        filter: true,
        show: true,
        edit: false
    }
};
const hiddenOnListProperty = {
    isVisible: {
        list: false,
        filter: true,
        show: true,
        edit: true
    }
};
const readOnlyActions = {
    new: { isAccessible: false },
    edit: { isAccessible: false },
    delete: { isAccessible: false },
    bulkDelete: { isAccessible: false }
};
const noCreateOrDeleteActions = {
    new: { isAccessible: false },
    delete: { isAccessible: false },
    bulkDelete: { isAccessible: false }
};

function trimToNull(value) {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

async function authenticateAdmin(email, password) {
    const normalizedEmail = trimToNull(email);
    const normalizedPassword = trimToNull(password);

    if (!normalizedEmail || !normalizedPassword) {
        return null;
    }

    const result = await pool.query(
        `
            SELECT admin_user_id, email, password_hash, full_name, role, is_active
            FROM admin_user
            WHERE lower(email) = lower($1)
            LIMIT 1
        `,
        [normalizedEmail]
    );

    if (!result.rowCount) {
        return null;
    }

    const adminUser = result.rows[0];

    if (!adminUser.is_active) {
        return null;
    }

    const passwordMatches = await bcrypt.compare(normalizedPassword, adminUser.password_hash);

    if (!passwordMatches) {
        return null;
    }

    await pool.query(
        `
            UPDATE admin_user
            SET last_login_at = now()
            WHERE admin_user_id = $1
        `,
        [adminUser.admin_user_id]
    );

    return {
        adminUserId: adminUser.admin_user_id,
        email: adminUser.email,
        title: adminUser.full_name,
        fullName: adminUser.full_name,
        role: adminUser.role
    };
}

function encodePart(value) {
    return encodeURIComponent(String(value ?? ""));
}

function buildConnectionString() {
    const connectionString = `postgresql://${encodePart(env.pgUser)}:${encodePart(env.pgPassword)}@${env.pgHost}:${env.pgPort}/${encodePart(env.pgDatabase)}`;

    if (env.pgSslMode === "require") {
        return `${connectionString}?sslmode=require`;
    }

    return connectionString;
}

function buildSessionOptions() {
    return {
        proxy: env.nodeEnv === "production",
        resave: false,
        saveUninitialized: false,
        secret: env.adminCookiePassword,
        name: env.adminCookieName,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: env.nodeEnv === "production",
            maxAge: 1000 * 60 * 60 * 12
        }
    };
}

function makeTimestampProperties() {
    return {
        created_at: hiddenOnEditProperty,
        updated_at: hiddenOnEditProperty
    };
}

function makeReadOnlyOptions(options) {
    return {
        ...options,
        actions: {
            ...readOnlyActions,
            ...(options.actions || {})
        }
    };
}

function makeEditableOperationsOptions(options) {
    return {
        ...options,
        actions: {
            ...noCreateOrDeleteActions,
            ...(options.actions || {})
        }
    };
}

function buildCatalogResources(db) {
    return [
        {
            resource: db.table("product_category"),
            options: {
                navigation: "Каталог",
                listProperties: ["product_category_id", "name", "slug", "sort_order", "is_active", "updated_at"],
                editProperties: ["name", "slug", "sort_order", "is_active"],
                filterProperties: ["name", "slug", "is_active"],
                showProperties: ["product_category_id", "name", "slug", "sort_order", "is_active", "created_at", "updated_at"],
                properties: {
                    product_category_id: hiddenOnEditProperty,
                    ...makeTimestampProperties()
                }
            }
        },
        {
            resource: db.table("product"),
            options: {
                navigation: "Каталог",
                listProperties: ["product_id", "name", "product_category_id", "price", "is_active", "sort_order", "updated_at"],
                editProperties: ["product_category_id", "name", "slug", "short_description", "image_url", "price", "is_active", "sort_order"],
                filterProperties: ["name", "slug", "product_category_id", "is_active"],
                showProperties: ["product_id", "product_category_id", "name", "slug", "short_description", "image_url", "price", "is_active", "sort_order", "created_at", "updated_at"],
                properties: {
                    product_id: hiddenOnEditProperty,
                    short_description: {
                        type: "textarea"
                    },
                    price: {
                        position: 60
                    },
                    ...makeTimestampProperties()
                }
            }
        },
        {
            resource: db.table("product_specs"),
            options: {
                navigation: "Каталог",
                listProperties: ["product_spec_id", "product_id", "label", "value", "sort_order"],
                editProperties: ["product_id", "label", "value", "sort_order"],
                filterProperties: ["product_id", "label", "value"],
                showProperties: ["product_spec_id", "product_id", "label", "value", "sort_order"],
                properties: {
                    product_spec_id: hiddenOnEditProperty
                }
            }
        }
    ];
}

function buildContentResources(db) {
    return [
        {
            resource: db.table("news"),
            options: {
                navigation: "Контент",
                listProperties: ["news_id", "title", "slug", "published_at", "is_published", "updated_at"],
                editProperties: ["title", "slug", "preview_text", "content", "image_url", "published_at", "is_published"],
                filterProperties: ["title", "slug", "published_at", "is_published"],
                showProperties: ["news_id", "title", "slug", "preview_text", "content", "image_url", "published_at", "is_published", "created_by_admin_user_id", "updated_by_admin_user_id", "created_at", "updated_at"],
                properties: {
                    news_id: hiddenOnEditProperty,
                    preview_text: {
                        type: "textarea"
                    },
                    content: {
                        type: "textarea"
                    },
                    created_by_admin_user_id: hiddenOnListProperty,
                    updated_by_admin_user_id: hiddenOnListProperty,
                    ...makeTimestampProperties()
                }
            }
        }
    ];
}

function buildOperationsResources(db) {
    return [
        {
            resource: db.table("contact_message"),
            options: makeEditableOperationsOptions({
                navigation: "Заявки и сообщения",
                listProperties: ["contact_message_id", "source_page", "name", "phone", "email", "status", "created_at"],
                editProperties: ["source_page", "name", "phone", "email", "message", "status", "processed_by_admin_user_id"],
                filterProperties: ["source_page", "name", "phone", "email", "status", "created_at"],
                showProperties: ["contact_message_id", "source_page", "name", "phone", "email", "message", "status", "processed_by_admin_user_id", "created_at"],
                properties: {
                    contact_message_id: hiddenOnEditProperty,
                    source_page: {
                        availableValues: [
                            { value: "home", label: "Главная" },
                            { value: "contacts", label: "Контакты" }
                        ]
                    },
                    status: {
                        availableValues: [
                            { value: "new", label: "Новый" },
                            { value: "in_progress", label: "В работе" },
                            { value: "closed", label: "Закрыт" },
                            { value: "spam", label: "Спам" }
                        ]
                    },
                    message: {
                        type: "textarea"
                    },
                    processed_by_admin_user_id: hiddenOnListProperty,
                    created_at: hiddenOnEditProperty
                }
            })
        },
        {
            resource: db.table("company_contact"),
            options: makeEditableOperationsOptions({
                navigation: "Заявки и сообщения",
                listProperties: ["company_contact_id", "full_name", "email", "job_title", "phone", "created_at"],
                editProperties: ["full_name", "email", "job_title", "phone"],
                filterProperties: ["full_name", "email", "phone", "created_at"],
                showProperties: ["company_contact_id", "full_name", "email", "job_title", "phone", "created_at", "updated_at"],
                properties: {
                    company_contact_id: hiddenOnEditProperty,
                    ...makeTimestampProperties()
                }
            })
        },
        {
            resource: db.table("company_partner"),
            options: makeEditableOperationsOptions({
                navigation: "Заявки и сообщения",
                listProperties: ["company_partner_id", "company_name", "inn", "ogrn", "created_at"],
                editProperties: ["company_name", "inn", "ogrn", "legal_address"],
                filterProperties: ["company_name", "inn", "ogrn", "created_at"],
                showProperties: ["company_partner_id", "company_name", "inn", "ogrn", "legal_address", "created_at", "updated_at"],
                properties: {
                    company_partner_id: hiddenOnEditProperty,
                    legal_address: {
                        type: "textarea"
                    },
                    ...makeTimestampProperties()
                }
            })
        },
        {
            resource: db.table("purchase_request"),
            options: makeEditableOperationsOptions({
                navigation: "Заявки и сообщения",
                listProperties: ["purchase_request_id", "request_number", "company_contact_id", "company_partner_id", "status", "agreement_accepted", "created_at"],
                editProperties: ["company_contact_id", "company_partner_id", "status", "agreement_accepted", "processed_by_admin_user_id"],
                filterProperties: ["request_number", "company_contact_id", "company_partner_id", "status", "created_at"],
                showProperties: ["purchase_request_id", "request_number", "company_contact_id", "company_partner_id", "status", "agreement_accepted", "processed_by_admin_user_id", "created_at", "updated_at"],
                properties: {
                    purchase_request_id: hiddenOnEditProperty,
                    request_number: hiddenOnEditProperty,
                    status: {
                        availableValues: [
                            { value: "new", label: "Новая" },
                            { value: "in_review", label: "На рассмотрении" },
                            { value: "quoted", label: "С расчётом" },
                            { value: "approved", label: "Подтверждена" },
                            { value: "rejected", label: "Отклонена" },
                            { value: "completed", label: "Завершена" }
                        ]
                    },
                    processed_by_admin_user_id: hiddenOnListProperty,
                    ...makeTimestampProperties()
                }
            })
        },
        {
            resource: db.table("request_product"),
            options: makeEditableOperationsOptions({
                navigation: "Заявки и сообщения",
                listProperties: ["request_product_id", "purchase_request_id", "product_id", "quantity_tons", "price"],
                editProperties: ["purchase_request_id", "product_id", "quantity_tons", "price"],
                filterProperties: ["purchase_request_id", "product_id"],
                showProperties: ["request_product_id", "purchase_request_id", "product_id", "quantity_tons", "price"],
                properties: {
                    request_product_id: hiddenOnEditProperty
                }
            })
        },
        {
            resource: db.table("delivery"),
            options: makeEditableOperationsOptions({
                navigation: "Заявки и сообщения",
                listProperties: ["delivery_id", "purchase_request_id", "delivery_type", "created_at"],
                editProperties: ["purchase_request_id", "delivery_type", "delivery_address", "delivery_comment"],
                filterProperties: ["purchase_request_id", "delivery_type", "created_at"],
                showProperties: ["delivery_id", "purchase_request_id", "delivery_type", "delivery_address", "delivery_comment", "created_at", "updated_at"],
                properties: {
                    delivery_id: hiddenOnEditProperty,
                    delivery_type: {
                        availableValues: [
                            { value: "pickup", label: "Самовывоз" },
                            { value: "company_transport", label: "Доставка транспортом" },
                            { value: "rail", label: "Железнодорожная отгрузка" }
                        ]
                    },
                    delivery_address: {
                        type: "textarea"
                    },
                    delivery_comment: {
                        type: "textarea"
                    },
                    ...makeTimestampProperties()
                }
            })
        }
    ];
}

function buildSystemResources(db) {
    return [
        {
            resource: db.table("admin_user"),
            options: makeReadOnlyOptions({
                navigation: "Система",
                listProperties: ["admin_user_id", "email", "full_name", "role", "is_active", "last_login_at", "created_at"],
                filterProperties: ["email", "full_name", "role", "is_active", "created_at"],
                showProperties: ["admin_user_id", "email", "full_name", "role", "is_active", "last_login_at", "created_at"],
                properties: {
                    password_hash: hiddenProperty,
                    role: {
                        availableValues: [
                            { value: "super_admin", label: "Admin" },
                            { value: "editor", label: "Editor" },
                            { value: "manager", label: "Manager" }
                        ]
                    }
                }
            })
        }
    ];
}

async function mountAdmin(app) {
    const [{ default: AdminJS }, { default: AdminJSExpress }, sqlModule] = await Promise.all([
        import("adminjs"),
        import("@adminjs/express"),
        import("@adminjs/sql")
    ]);

    const { Adapter, Database, Resource } = sqlModule;

    AdminJS.registerAdapter({ Database, Resource });

    const db = await new Adapter("postgresql", {
        connectionString: buildConnectionString(),
        database: env.pgDatabase
    }).init();

    const admin = new AdminJS({
        rootPath: ADMIN_ROOT_PATH,
        branding: {
            companyName: "Заря",
            withMadeWithLove: false
        },
        resources: [
            ...buildCatalogResources(db),
            ...buildContentResources(db),
            ...buildOperationsResources(db),
            ...buildSystemResources(db)
        ]
    });

    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
        admin,
        {
            authenticate: authenticateAdmin,
            cookieName: env.adminCookieName,
            cookiePassword: env.adminCookiePassword
        },
        null,
        buildSessionOptions()
    );

    app.use(admin.options.rootPath, adminRouter);

    return {
        admin,
        rootPath: admin.options.rootPath
    };
}

module.exports = {
    mountAdmin
};




