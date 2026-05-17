const { pool } = require("./pool");

const productPresentationBySlug = {
    "wheat-javoronok": {
        imagePosition: "50% 44%"
    },
    "wheat-soft": {
        imagePosition: "64% 28%",
        cardFilter: "saturate(0.84)"
    },
    "wheat-taganrog": {
        imagePosition: "51% 22%",
        cardFilter: "brightness(0.9)"
    },
    "sunflower-aromatik": {
        imagePosition: "36% 60%"
    },
    "sunflower-krechet": {
        imagePosition: "62% 44%"
    },
    "sunflower-valentina": {
        imagePosition: "84% 58%"
    },
    "sunflower-barle": {
        imagePosition: "28% 76%",
        cardFilter: "brightness(0.94)"
    },
    "sunflower-mas920": {
        imagePosition: "58% 78%"
    },
    "corn-dks4014": {
        imagePosition: "72% 62%"
    },
    "corn-dks4178": {
        imagePosition: "86% 72%"
    },
    "corn-dks3710": {
        imagePosition: "94% 74%"
    }
};

function attachProductPresentation(product) {
    const presentation = productPresentationBySlug[product.slug] || {};

    return {
        ...product,
        imagePosition: presentation.imagePosition || "center",
        cardFilter: presentation.cardFilter || ""
    };
}

function attachNewsPresentation(article) {
    return {
        ...article,
        imagePosition: article.imagePosition || "center"
    };
}

function formatRuDate(value) {
    const date = typeof value === "string"
        ? new Date(`${value}T00:00:00`)
        : new Date(value);

    return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}

function mapProductSummary(row) {
    return attachProductPresentation({
        productId: row.product_id,
        categoryId: row.product_category_id,
        categorySlug: row.category_slug,
        categoryName: row.category_name,
        name: row.name,
        slug: row.slug,
        shortDescription: row.short_description,
        imageUrl: row.image_url,
        sortOrder: row.sort_order
    });
}

function mapNewsSummary(row) {
    return attachNewsPresentation({
        newsId: row.news_id,
        title: row.title,
        slug: row.slug,
        previewText: row.preview_text,
        imageUrl: row.image_url,
        publishedAt: row.published_at,
        publishedAtLabel: formatRuDate(row.published_at)
    });
}

async function listProductCategories() {
    const result = await pool.query(
        `
            SELECT product_category_id, name, slug, sort_order
            FROM product_category
            WHERE is_active = true
            ORDER BY sort_order, product_category_id
        `
    );

    return result.rows.map((row) => ({
        productCategoryId: row.product_category_id,
        name: row.name,
        slug: row.slug,
        sortOrder: row.sort_order
    }));
}

async function listProducts() {
    const result = await pool.query(
        `
            SELECT
                p.product_id,
                p.product_category_id,
                p.name,
                p.slug,
                p.short_description,
                p.image_url,
                p.sort_order,
                c.name AS category_name,
                c.slug AS category_slug
            FROM product AS p
            INNER JOIN product_category AS c
                ON c.product_category_id = p.product_category_id
            WHERE p.is_active = true
              AND c.is_active = true
            ORDER BY c.sort_order, p.sort_order, p.product_id
        `
    );

    return result.rows.map(mapProductSummary);
}

async function getProductBySlug(slug) {
    const productResult = await pool.query(
        `
            SELECT
                p.product_id,
                p.product_category_id,
                p.name,
                p.slug,
                p.short_description,
                p.image_url,
                p.sort_order,
                c.name AS category_name,
                c.slug AS category_slug
            FROM product AS p
            INNER JOIN product_category AS c
                ON c.product_category_id = p.product_category_id
            WHERE p.slug = $1
              AND p.is_active = true
              AND c.is_active = true
            LIMIT 1
        `,
        [slug]
    );

    if (!productResult.rowCount) {
        return null;
    }

    const product = mapProductSummary(productResult.rows[0]);

    const specsResult = await pool.query(
        `
            SELECT label, value, sort_order
            FROM product_specs
            WHERE product_id = $1
            ORDER BY sort_order, product_spec_id
        `,
        [product.productId]
    );

    const sameCategoryResult = await pool.query(
        `
            SELECT
                p.product_id,
                p.product_category_id,
                p.name,
                p.slug,
                p.short_description,
                p.image_url,
                p.sort_order,
                c.name AS category_name,
                c.slug AS category_slug
            FROM product AS p
            INNER JOIN product_category AS c
                ON c.product_category_id = p.product_category_id
            WHERE p.slug <> $1
              AND p.product_category_id = $2
              AND p.is_active = true
              AND c.is_active = true
            ORDER BY p.sort_order, p.product_id
            LIMIT 3
        `,
        [slug, product.categoryId]
    );

    const relatedItems = sameCategoryResult.rows.map(mapProductSummary);

    if (relatedItems.length < 3) {
        const excludedSlugs = [slug, ...relatedItems.map((item) => item.slug)];
        const fallbackResult = await pool.query(
            `
                SELECT
                    p.product_id,
                    p.product_category_id,
                    p.name,
                    p.slug,
                    p.short_description,
                    p.image_url,
                    p.sort_order,
                    c.name AS category_name,
                    c.slug AS category_slug
                FROM product AS p
                INNER JOIN product_category AS c
                    ON c.product_category_id = p.product_category_id
                WHERE NOT (p.slug = ANY($1::text[]))
                  AND p.is_active = true
                  AND c.is_active = true
                ORDER BY c.sort_order, p.sort_order, p.product_id
                LIMIT $2
            `,
            [excludedSlugs, 3 - relatedItems.length]
        );

        relatedItems.push(...fallbackResult.rows.map(mapProductSummary));
    }

    return {
        ...product,
        specs: specsResult.rows.map((row) => ({
            label: row.label,
            value: row.value,
            sortOrder: row.sort_order
        })),
        relatedItems
    };
}

async function listNews() {
    const result = await pool.query(
        `
            SELECT news_id, title, slug, preview_text, image_url, published_at
            FROM news
            WHERE is_published = true
            ORDER BY published_at DESC, news_id DESC
        `
    );

    return result.rows.map(mapNewsSummary);
}

async function getNewsBySlug(slug) {
    const articleResult = await pool.query(
        `
            SELECT news_id, title, slug, preview_text, content, image_url, published_at
            FROM news
            WHERE slug = $1
              AND is_published = true
            LIMIT 1
        `,
        [slug]
    );

    if (!articleResult.rowCount) {
        return null;
    }

    const articleRow = articleResult.rows[0];
    const newsList = await listNews();
    const currentIndex = newsList.findIndex((item) => item.slug === slug);

    const relatedItems = newsList
        .filter((item) => item.slug !== slug)
        .slice(Math.max(currentIndex - 1, 0), Math.max(currentIndex - 1, 0) + 3);

    const fallbackItems = newsList.filter(
        (item) => item.slug !== slug && !relatedItems.some((related) => related.slug === item.slug)
    );

    while (relatedItems.length < 3 && fallbackItems.length) {
        relatedItems.push(fallbackItems.shift());
    }

    return {
        ...mapNewsSummary(articleRow),
        content: articleRow.content,
        paragraphs: articleRow.content
            .split(/\r?\n\r?\n+/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean),
        relatedItems
    };
}

module.exports = {
    listProductCategories,
    listProducts,
    getProductBySlug,
    listNews,
    getNewsBySlug
};
