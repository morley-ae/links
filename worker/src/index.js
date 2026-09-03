const ALLOWED_ORIGINS = new Set([
    "https://morleyae.com",
    "https://www.morleyae.com",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
]);

function corsHeaders(request) {
    const origin = request.headers.get("Origin");
    const headers = {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Content-Type": "application/json; charset=utf-8"
    };

    if (ALLOWED_ORIGINS.has(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Vary"] = "Origin";
    }

    return headers;
}

function json(request, body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: corsHeaders(request)
    });
}

function normalizeFilename(value) {
    if (typeof value !== "string") return null;
    const filename = value.trim().replace(/^\/+/, "");
    if (!filename || filename.length > 500 || filename.includes("..") || filename.includes("\\")) {
        return null;
    }
    return filename;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders(request) });
        }

        if (!ALLOWED_ORIGINS.has(request.headers.get("Origin"))) {
            return json(request, { error: "Origin not allowed" }, 403);
        }

        if (url.pathname === "/downloads" && request.method === "GET") {
            const result = await env.DB.prepare(
                "SELECT filename, downloads FROM audio_downloads ORDER BY filename"
            ).all();
            const total = result.results.reduce((sum, row) => sum + Number(row.downloads || 0), 0);
            const counts = Object.fromEntries(
                result.results.map(row => [row.filename, Number(row.downloads || 0)])
            );
            return json(request, { counts, total });
        }

        if (url.pathname === "/downloads" && request.method === "POST") {
            let payload;
            try {
                payload = await request.json();
            } catch {
                return json(request, { error: "Invalid JSON" }, 400);
            }

            const filename = normalizeFilename(payload?.filename);
            if (!filename) {
                return json(request, { error: "A valid filename is required" }, 400);
            }

            await env.DB.prepare(
                `INSERT INTO audio_downloads (filename, downloads)
                 VALUES (?, 1)
                 ON CONFLICT(filename) DO UPDATE SET downloads = downloads + 1`
            ).bind(filename).run();

            const row = await env.DB.prepare(
                "SELECT downloads FROM audio_downloads WHERE filename = ?"
            ).bind(filename).first();
            const totalRow = await env.DB.prepare(
                "SELECT COALESCE(SUM(downloads), 0) AS total FROM audio_downloads"
            ).first();

            return json(request, {
                filename,
                downloads: Number(row?.downloads || 0),
                total: Number(totalRow?.total || 0)
            });
        }

        return json(request, { error: "Not found" }, 404);
    }
};
