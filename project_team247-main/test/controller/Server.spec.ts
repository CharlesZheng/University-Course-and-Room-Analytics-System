import { expect } from "chai";
import request from "supertest";
import Server from "../../src/rest/Server";
import fs from "fs-extra";
import path from "path";
import { StatusCodes } from "http-status-codes";

describe("Server Endpoints", function () {
	let server: Server;
	const port = 4329;
	const baseURL = `http://localhost:${port}`;

	before(async function () {
		server = new Server(port);
		await server.start();
	});

	after(async function () {
		await server.stop();
	});

	it("should echo message", async function () {
		const res = await request(baseURL).get("/echo/hello");
		expect(res.status).to.equal(StatusCodes.OK);
		expect(res.body.result).to.equal("hello...hello");
	});

	it("should echo missing message", async function () {
		const res = await request(baseURL).get("/echo/");
		expect(res.status).to.equal(StatusCodes.NOT_FOUND);
	});

	it("should return error for malformed base64 upload", async function () {
		const brokenZip = Buffer.from("<not-valid-base64>");
		const res = await request(baseURL)
			.put("/dataset/brokenTest/sections")
			.set("Content-Type", "application/x-zip-compressed")
			.send(brokenZip);

		expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(res.body.error).to.exist;
	});

	it("should return error when removing twice", async function () {
		const zipPath = path.join(__dirname, "../../test/resources/archives/pair.zip");
		const testZip = await fs.readFile(zipPath);

		await request(baseURL)
			.put("/dataset/twiceTest/sections")
			.set("Content-Type", "application/x-zip-compressed")
			.send(testZip);

		await request(baseURL).delete("/dataset/twiceTest");
		const res = await request(baseURL).delete("/dataset/twiceTest");

		expect(res.status).to.equal(StatusCodes.NOT_FOUND);
		expect(res.body.error).to.exist;
	});

	it("should handle dataset upload, list, and remove end-to-end", async function () {
		const zipPath = path.join(__dirname, "../../test/resources/archives/pair.zip");
		const testZip = await fs.readFile(zipPath);

		const addRes = await request(baseURL)
			.put("/dataset/testSections/sections")
			.set("Content-Type", "application/x-zip-compressed")
			.send(testZip);
		expect(addRes.status).to.equal(StatusCodes.OK);
		expect(addRes.body.result).to.include("testSections");

		const listRes = await request(baseURL).get("/datasets");
		expect(listRes.status).to.equal(StatusCodes.OK);
		expect(
			listRes.body.result.some(
				(d: any) => d.id === "testSections" && d.kind === "sections" && typeof d.numRows === "number"
			)
		).to.be.true;

		const getRes = await request(baseURL).get("/dataset/testSections");
		expect(getRes.status).to.equal(StatusCodes.OK);
		expect(getRes.body.result).to.be.an("array");
		expect(getRes.body.result.length).to.be.greaterThan(0);

		const removeRes = await request(baseURL).delete("/dataset/testSections");
		expect(removeRes.status).to.equal(StatusCodes.OK);
		expect(removeRes.body.result).to.equal("testSections");
	});

	it("should return 404 for non-existent dataset", async function () {
		const res = await request(baseURL).delete("/dataset/notExist");
		expect(res.status).to.equal(StatusCodes.NOT_FOUND);
		expect(res.body.error).to.exist;
	});

	it("should return 400 for invalid dataset kind", async function () {
		const zipPath = path.join(__dirname, "../../test/resources/archives/pair.zip");
		const testZip = await fs.readFile(zipPath);

		const res = await request(baseURL)
			.put("/dataset/testInvalid/invalidkind")
			.set("Content-Type", "application/x-zip-compressed")
			.send(testZip);

		expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(res.body.error).to.exist;
	});

	it("should not re-add existing dataset ID", async function () {
		const zipPath = path.join(__dirname, "../../test/resources/archives/pair.zip");
		const testZip = await fs.readFile(zipPath);

		await request(baseURL)
			.put("/dataset/dupTest/sections")
			.set("Content-Type", "application/x-zip-compressed")
			.send(testZip);

		const res = await request(baseURL)
			.put("/dataset/dupTest/sections")
			.set("Content-Type", "application/x-zip-compressed")
			.send(testZip);

		expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(res.body.error).to.exist;

		await request(baseURL).delete("/dataset/dupTest");
	});

	it("should return error when no dataset is uploaded", async function () {
		const res = await request(baseURL)
			.put("/dataset/emptyTest/sections")
			.set("Content-Type", "application/x-zip-compressed")
			.send();

		expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(res.body.error).to.exist;
	});

	it("should reject upload with invalid file content", async function () {
		const invalidContent = Buffer.from("notazipfile");

		const res = await request(baseURL)
			.put("/dataset/badZip/sections")
			.set("Content-Type", "application/x-zip-compressed")
			.send(invalidContent);

		expect(res.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(res.body.error).to.exist;
	});

	it("should handle empty dataset directory gracefully", async function () {
		const res = await request(baseURL).get("/datasets");
		expect(res.status).to.equal(StatusCodes.OK);
		expect(res.body.result).to.be.an("array");
	});
});
