function json(data, status = 200) {
    return Response.json(data, {
        status,
        headers: {
            "Cache-Control": "no-store"
        }
    });
}

function getFilename(request) {
    const filename = new URL(request.url).searchParams.get("file");
    if (!filename || filename.length > 500) return null;
    return filename;
}

function getDailyKey(filename) {
    const date = new Date().toISOString().slice(0, 10);
    return `daily:${date}:${filename}`;
}

export async function onRequestGet(context) {
    const filename = getFilename(context.request);
    if (!filename) return json({ error: "Invalid filename" }, 400);

    const count = await context.env.DOWNLOADS.get(`total:${filename}`);
    const dailyCount = await context.env.DOWNLOADS.get(getDailyKey(filename));

    return json({
        filename,
        count: Number(count || 0),
        dailyCount: Number(dailyCount || 0)
    });
}

export async function onRequestPost(context) {
    const filename = getFilename(context.request);
    if (!filename) return json({ error: "Invalid filename" }, 400);

    const totalKey = `total:${filename}`;
    const dailyKey = getDailyKey(filename);
    const currentTotal = Number(await context.env.DOWNLOADS.get(totalKey) || 0);
    const currentDaily = Number(await context.env.DOWNLOADS.get(dailyKey) || 0);
    const count = currentTotal + 1;
    const dailyCount = currentDaily + 1;

    await Promise.all([
        context.env.DOWNLOADS.put(totalKey, String(count)),
        context.env.DOWNLOADS.put(dailyKey, String(dailyCount), { expirationTtl: 172800 })
    ]);

    return json({ filename, count, dailyCount });
}
