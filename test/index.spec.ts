import { fetchMock, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ipaRdf from "./fixtures/ipa.rdf?raw";
import jpcertRdf from "./fixtures/jpcert.rdf?raw";

describe("/proxy", () => {
	beforeEach(() => {
		fetchMock.activate();
		fetchMock.disableNetConnect();
	});

	afterEach(() => {
		fetchMock.deactivate();
	});

	it("JPCERT RDF を Atom に変換する", async () => {
		fetchMock
			.get("https://www.jpcert.or.jp")
			.intercept({ path: "/rss/jpcert.rdf" })
			.reply(200, jpcertRdf, {
				headers: { "content-type": "application/rss+xml" },
			});

		const response = await SELF.fetch(
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

	it("IPA RDF を Atom に変換する", async () => {
		fetchMock
			.get("https://www.ipa.go.jp")
			.intercept({ path: "/security/alert-rss.rdf" })
			.reply(200, ipaRdf, {
				headers: { "content-type": "application/rss+xml" },
			});

		const response = await SELF.fetch(
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

	it("url パラメータがない場合 400 を返す", async () => {
		const response = await SELF.fetch("https://example.com/proxy");
		expect(response.status).toBe(400);
	});

	it("http URL の場合 400 を返す", async () => {
		const response = await SELF.fetch(
			"https://example.com/proxy?url=http://example.com/feed.rdf",
		);
		expect(response.status).toBe(400);
	});

	it("不正な URL の場合 400 を返す", async () => {
		const response = await SELF.fetch(
			"https://example.com/proxy?url=not-a-url",
		);
		expect(response.status).toBe(400);
	});
});
