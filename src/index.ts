import { generateAtomFeed, parseRdfFeed } from "feedsmith";
import { Hono } from "hono";
import * as R from "remeda";

const app = new Hono();

app.get("/proxy", async (c) => {
	const url = c.req.query("url");

	if (!url) {
		return c.json({ error: "url parameter is required" }, 400);
	}

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		return c.json({ error: "Invalid URL" }, 400);
	}

	if (parsedUrl.protocol !== "https:") {
		return c.json({ error: "Only https URLs are allowed" }, 400);
	}

	let response: Response;
	try {
		response = await fetch(url);
	} catch {
		return c.json({ error: "Failed to fetch feed" }, 502);
	}

	if (!response.ok) {
		return c.json({ error: `Upstream returned ${response.status}` }, 502);
	}

	const rdfContent = await response.text();
	const feed = parseRdfFeed(rdfContent, {
		parseDateFn: (raw) => new Date(raw),
	});

	const now = new Date();
	const items = feed.items ?? [];

	const newestDate = items.reduce<Date>((latest, item) => {
		const date = item.dc?.dates?.[0];
		if (
			date instanceof Date &&
			!Number.isNaN(date.getTime()) &&
			date > latest
		) {
			return date;
		}
		return latest;
	}, new Date(0));

	const updated = newestDate.getTime() > 0 ? newestDate : now;

	const atomFeed = {
		id: feed.link ?? url,
		title: { value: feed.title ?? "" },
		updated,
		links: feed.link ? [{ href: feed.link, rel: "alternate" }] : undefined,
		entries: R.pipe(
			items,
			R.uniqueBy((item) => item.link),
			R.map((item) => ({
				id: hash(item.link, item.dc?.dates?.[0]?.getTime()),
				title: { value: item.title ?? "" },
				updated: item.dc?.dates?.[0] ?? now,
				links: item.link ? [{ href: item.link, rel: "alternate" }] : undefined,
			})),
		),
	};

	const atomXml = generateAtomFeed(atomFeed);

	return c.text(atomXml, 200, {
		"Content-Type": "application/atom+xml; charset=utf-8",
	});
});

export default app;

export function hash(
	...args: (string | number | boolean | null | undefined | bigint)[]
): string {
	const str = args.join("");
	let hash = 0x811c9dc5; // offset basis
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193); // FNV prime
	}
	// unsigned 32-bit
	return (hash >>> 0).toString(16).padStart(8, "0");
}
