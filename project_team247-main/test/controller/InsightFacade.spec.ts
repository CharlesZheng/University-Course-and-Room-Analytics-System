import {
	IInsightFacade,
	InsightDatasetKind,
	InsightResult,
	ResultTooLargeError,
	InsightError,
	NotFoundError,
} from "../../src/controller/IInsightFacade";
// import HTMLParser from "../../src/controller/HTMLParser";
// import * as fs from "fs-extra";
// import * as path from "path";
import InsightFacade from "../../src/controller/InsightFacade";
import { clearDisk, getContentFromArchives, loadTestQuery } from "../TestUtil";

import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

export interface ITestQuery {
	title?: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;

	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;

	// 	let datasetMap: Record<string, string> ={};

	before(async function () {
		// This block runs once and loads the datasets.
		sections = await getContentFromArchives("pair.zip");

		// Just in case there is anything hanging around from a previous run of the test suite
		await clearDisk();
	});

	describe("AddDataset", function () {
		before(async function () {
			// Load the dataset once before the tests
			sections = await getContentFromArchives("pair.zip");
			// rooms = await getContentFromArchives("campus.zip");
		});

		beforeEach(function () {
			// Create a new instance of InsightFacade before each test
			facade = new InsightFacade();
		});

		afterEach(async function () {
			// Clear the disk after each test if CLEAR is true
			await clearDisk();
		});

		it("should reject with an empty dataset id", async function () {
			try {
				await facade.addDataset("", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});

		it("should reject a dataset ID containing underscores", async function () {
			try {
				await facade.addDataset("invalid_id", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject a dataset ID with whitespace", async function () {
			try {
				await facade.addDataset("     ", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject a dataset ID with whitespace2", async function () {
			try {
				await facade.addDataset("\t", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject adding a dataset with a duplicate ID", async function () {
			try {
				await facade.addDataset("sections", sections, InsightDatasetKind.Sections);
				await facade.addDataset("sections", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject adding an empty sections", async function () {
			try {
				await facade.addDataset("sections", "", InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject adding an invalid kind", async function () {
			try {
				await facade.addDataset("sections", sections, InsightDatasetKind.Rooms);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		// 		it("should reject a numeric dataset ID", async function () {
		// 			try {
		// 				await facade.addDataset(idNumber, sections, InsightDatasetKind.Sections);
		// 				expect.fail("Should have thrown!");
		// 			} catch (err) {
		// 				expect(err).to.be.instanceOf(InsightError);
		// 			}
		// 		});

		it("should reject content that is not Base64-encoded", async function () {
			try {
				const invalidContent = "This is not Base64!";
				await facade.addDataset("sections", invalidContent, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		// 		it("should reject a null content parameter", async function () {
		// 			try {
		// 				await facade.addDataset("nullContent", null, InsightDatasetKind.Sections);
		// 				expect.fail("Should have thrown!");
		// 			} catch (err) {
		// 				expect(err).to.be.instanceOf(InsightError);
		// 			}
		// 		});

		it("should add a dataset successfully when all inputs are valid", async function () {
			const result = await facade.addDataset("sections", sections, InsightDatasetKind.Sections);
			expect(result).to.deep.equal(["sections"]);
		});

		describe("RemoveDataset", function () {
			beforeEach(async function () {
				// Load the dataset once before the tests
				sections = await getContentFromArchives("pair.zip");
				facade = new InsightFacade();
			});

			afterEach(async function () {
				// Clear the disk after each test if CLEAR is true
				await clearDisk();
			});

			it("should remove a dataset successfully", async function () {
				await facade.addDataset("sections", sections, InsightDatasetKind.Sections);
				const result = await facade.removeDataset("sections");
				expect(result).to.equal("sections");
			});

			it("should reject removing a non-existent dataset", async function () {
				try {
					await facade.removeDataset("nonExistent");
					expect.fail("Should have thrown!");
				} catch (err) {
					expect(err).to.be.instanceOf(NotFoundError);
				}
			});

			it("should reject removing a dataset that already been removed", async function () {
				try {
					await facade.addDataset("sections", sections, InsightDatasetKind.Sections);
					await facade.removeDataset("sections");
					await facade.removeDataset("sections");
					expect.fail("Should have thrown!");
				} catch (err) {
					expect(err).to.be.instanceOf(NotFoundError);
				}
			});

			it("should keep the dataset that hasn't been removed", async function () {
				await facade.addDataset("sections", sections, InsightDatasetKind.Sections);
				await facade.addDataset("sections1", sections, InsightDatasetKind.Sections);
				await facade.removeDataset("sections");
				const result = await facade.addDataset("sections2", sections, InsightDatasetKind.Sections);
				expect(result).to.deep.equal(["sections1", "sections2"]);
			});
		});
	});

	// describe("HTMLParser Tests", function () {
	// 	let htmlParser: HTMLParser;
	// 	const testDir = "test/temp/";
	//
	// 	beforeEach(async function () {
	// 		htmlParser = new HTMLParser();
	// 		await fs.mkdirp(testDir); // Ensure test directory exists
	// 	});
	//
	// 	afterEach(async function () {
	// 		await fs.remove(testDir); // Clean up after each test
	// 	});
	//
	// 	it("should extract rows correctly from a valid table", async function () {
	// 		const testHtml = `
	//     <html>
	//         <body>
	//             <table>
	//                 <tr>
	//                     <td class="views-field-title">Building A</td>
	//                     <td class="views-field-field-building-code">BA</td>
	//                     <td class="views-field-field-building-address">123 Street</td>
	//                 </tr>
	//                 <tr>
	//                     <td class="views-field-title">Building B</td>
	//                     <td class="views-field-field-building-code">BB</td>
	//                     <td class="views-field-field-building-address">456 Avenue</td>
	//                 </tr>
	//             </table>
	//         </body>
	//     </html>
	//     `;
	// 		const filePath = path.join(testDir, "test1.htm");
	// 		await fs.writeFile(filePath, testHtml);
	//
	// 		const extractedRows = await htmlParser.extractTableRows(filePath);
	//
	// 		expect(extractedRows).to.be.an("array").with.length(2);
	// 		expect(extractedRows[0]["views-field-title"]).to.equal("Building A");
	// 		expect(extractedRows[1]["views-field-title"]).to.equal("Building B");
	// 	});
	//
	// 	it("should return an empty array when no table exists", async function () {
	// 		const testHtml = `<html><body><p>No tables here</p></body></html>`;
	// 		const filePath = path.join(testDir, "test2.htm");
	// 		await fs.writeFile(filePath, testHtml);
	//
	// 		const extractedRows = await htmlParser.extractTableRows(filePath);
	// 		expect(extractedRows).to.be.an("array").that.is.empty;
	// 	});
	//
	// 	it("should extract text inside <a> tags correctly", async function () {
	// 		const testHtml = `
	//     <html>
	//         <body>
	//             <table>
	//                 <tr>
	//                     <td class="views-field-title"><a href="#">Building C</a></td>
	//                     <td class="views-field-field-building-code">BC</td>
	//                     <td class="views-field-field-building-address">789 Road</td>
	//                 </tr>
	//             </table>
	//         </body>
	//     </html>
	//     `;
	// 		const filePath = path.join(testDir, "test3.htm");
	// 		await fs.writeFile(filePath, testHtml);
	//
	// 		const extractedRows = await htmlParser.extractTableRows(filePath);
	//
	// 		expect(extractedRows).to.be.an("array").with.length(1);
	// 		expect(extractedRows[0]["views-field-title"]).to.equal("Building C");
	// 	});
	//
	// 	it("should handle nested tbody elements correctly", async function () {
	// 		const testHtml = `
	//     <html>
	//         <body>
	//             <table>
	//                 <tbody>
	//                     <tr>
	//                         <td class="views-field-title">Building D</td>
	//                         <td class="views-field-field-building-code">BD</td>
	//                         <td class="views-field-field-building-address">1010 Plaza</td>
	//                     </tr>
	//                 </tbody>
	//             </table>
	//         </body>
	//     </html>
	//     `;
	// 		const filePath = path.join(testDir, "test4.htm");
	// 		await fs.writeFile(filePath, testHtml);
	//
	// 		const extractedRows = await htmlParser.extractTableRows(filePath);
	//
	// 		expect(extractedRows).to.be.an("array").with.length(1);
	// 		expect(extractedRows[0]["views-field-title"]).to.equal("Building D");
	// 	});
	//
	// 	it("should return an empty array if the table exists but has no rows", async function () {
	// 		const testHtml = `<html><body><table></table></body></html>`;
	// 		const filePath = path.join(testDir, "test5.htm");
	// 		await fs.writeFile(filePath, testHtml);
	//
	// 		const extractedRows = await htmlParser.extractTableRows(filePath);
	// 		expect(extractedRows).to.be.an("array").that.is.empty;
	// 	});
	//
	// 	it("should extract multiple tables correctly and choose the first one", async function () {
	// 		const testHtml = `
	//     <html>
	//         <body>
	//             <table>
	//                 <tr>
	//                     <td class="views-field-title">Building X</td>
	//                     <td class="views-field-field-building-code">BX</td>
	//                     <td class="views-field-field-building-address">2020 Street</td>
	//                 </tr>
	//             </table>
	//             <table>
	//                 <tr>
	//                     <td class="views-field-title">Building Y</td>
	//                     <td class="views-field-field-building-code">BY</td>
	//                     <td class="views-field-field-building-address">3030 Avenue</td>
	//                 </tr>
	//             </table>
	//         </body>
	//     </html>
	//     `;
	// 		const filePath = path.join(testDir, "test6.htm");
	// 		await fs.writeFile(filePath, testHtml);
	//
	// 		const extractedRows = await htmlParser.extractTableRows(filePath);
	//
	// 		expect(extractedRows).to.be.an("array").with.length(1);
	// 		expect(extractedRows[0]["views-field-title"]).to.equal("Building X");
	// 	});
	// });

	// describe("ListDataset", function () {
	// 	before(async function () {
	// 		// Load the dataset once before the tests
	// 		sections = await getContentFromArchives("pair.zip");
	// 		await clearDisk();
	// 	});
	//
	// 	afterEach(async function () {
	// 		// Clear the disk after each test if CLEAR is true
	// 		await clearDisk();
	// 	});
	//
	// 	it("should return an empty array when no datasets are added", async function () {
	// 		await clearDisk();
	// 		const result = await facade.listDatasets();
	// 		expect(result).to.deep.equal([]);
	// 	});
	//
	// 	it("should return an array of datasets when datasets have been added", async function () {
	// 		await facade.addDataset("sections", sections, InsightDatasetKind.Sections);
	// 		const result = await facade.listDatasets();
	// 		expect(result).to.deep.equal([
	// 			{
	// 				id: "sections",
	// 				kind: InsightDatasetKind.Sections,
	// 				numRows: 64612,
	// 			},
	// 		]);
	// 	});
	// });

	describe("PerformQuery", function () {
		/**
		 * Loads the TestQuery specified in the test name and asserts the behaviour of performQuery.
		 *
		 * Note: the 'this' parameter is automatically set by Mocha and contains information about the test.
		 */
		async function checkQuery(this: Mocha.Context): Promise<void> {
			if (!this.test) {
				throw new Error(
					"Invalid call to checkQuery." +
						"Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
						"Do not invoke the function directly."
				);
			}
			// Destructuring assignment to reduce property accesses
			const { input, expected, errorExpected } = await loadTestQuery(this.test.title);
			let result: InsightResult[] = []; // dummy value before being reassigned
			try {
				result = await facade.performQuery(input);
			} catch (err) {
				if (!errorExpected) {
					expect.fail(`performQuery threw unexpected error: ${err}`);
				}
				if (expected === "ResultTooLargeError") {
					expect(err).to.be.instanceOf(ResultTooLargeError);
					return;
				} else {
					expect(err).to.be.instanceOf(InsightError);
					return;
				}
			}
			if (errorExpected) {
				expect.fail(`performQuery resolved when it should have rejected with ${expected}`);
			}
			expect(result).to.have.deep.members(expected);
		}

		before(async function () {
			facade = new InsightFacade();

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises: Promise<string[]>[] = [
				facade.addDataset("sections", sections, InsightDatasetKind.Sections),
			];

			try {
				await Promise.all(loadDatasetPromises);
			} catch (err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			}
		});

		after(async function () {
			await clearDisk();
		});

		// Examples demonstrating how to test performQuery using the JSON Test Queries.
		// The relative path to the query file must be given in square brackets.
		it("[valid/simple.json] SELECT dept, avg WHERE avg > 97", checkQuery);
		it("[invalid/invalid.json] Query missing WHERE", checkQuery);
	});
});
