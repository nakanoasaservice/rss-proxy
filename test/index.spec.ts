import { exports } from "cloudflare:workers";
import { setupNetwork } from "@msw/cloudflare";
import { http, HttpResponse } from "msw";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vite-plus/test";

import ipaRdf from "./fixtures/ipa.rdf?raw";
import jpcertRdf from "./fixtures/jpcert.rdf?raw";

const network = setupNetwork();

describe("/proxy", () => {
	beforeAll(() => network.enable());
	beforeEach(() =>
		network.use(
			http.all("*", ({ request }) => {
				throw new Error(`Unexpected outbound request: ${request.url}`);
			}),
		),
	);
	afterEach(() => network.resetHandlers());
	afterAll(() => network.disable());

	it("converts JPCERT RDF to Atom", async () => {
		network.use(
			http.get(
				"https://www.jpcert.or.jp/rss/jpcert.rdf",
				() =>
					new HttpResponse(jpcertRdf, {
						headers: { "content-type": "application/rss+xml" },
					}),
			),
		);

		const response = await exports.default.fetch(
			"https://example.com/proxy?url=https://www.jpcert.or.jp/rss/jpcert.rdf",
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain(
			"application/atom+xml",
		);
		const text = await response.text();
		expect(text).toContain("<feed");
		expect(text).toContain("JPCERT");
		expect(text).toContain("<entry>");
		expect(text).toContain("https://www.jpcert.or.jp/");
	});

	it("converts IPA RDF to Atom", async () => {
		network.use(
			http.get(
				"https://www.ipa.go.jp/security/alert-rss.rdf",
				() =>
					new HttpResponse(ipaRdf, {
						headers: { "content-type": "application/rss+xml" },
					}),
			),
		);

		const response = await exports.default.fetch(
			"https://example.com/proxy?url=https://www.ipa.go.jp/security/alert-rss.rdf",
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain(
			"application/atom+xml",
		);
		const text = await response.text();
		expect(text).toContain("<feed");
		expect(text).toContain("<entry>");
		expect(text).toContain("https://www.ipa.go.jp/");
	});

	it("returns 400 when the URL is missing", async () => {
		const response = await exports.default.fetch("https://example.com/proxy");
		expect(response.status).toBe(400);
	});

	it("rejects HTTP URLs", async () => {
		const response = await exports.default.fetch(
			"https://example.com/proxy?url=http://example.com/feed.rdf",
		);
		expect(response.status).toBe(400);
	});

	it("rejects invalid URLs", async () => {
		const response = await exports.default.fetch(
			"https://example.com/proxy?url=not-a-url",
		);
		expect(response.status).toBe(400);
	});
});
