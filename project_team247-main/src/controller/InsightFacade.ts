import QueryObject from "./QueryObject";
import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightResult,
	InsightError,
	NotFoundError,
} from "./IInsightFacade";
import { Section } from "./Interface/SectionInterface";
import { Room } from "./Interface/RoomInterface";
import loadSections from "./loadSections";
import * as fs from "fs-extra";
import CampusDataProcessor from "./CampusDataProcessor";
import HTMLParser from "./HTMLParser";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private datasets: InsightDataset[] = [];
	private ids: string[] = [];
	private loadSections: loadSections;
	private path_metadata_id = "data/metadata_id.json";
	private path_metadata_dataset = "data/metadata_dataset.json";
	private campusProcessor: CampusDataProcessor;
	private htmlParser: HTMLParser;
	// define a data structure that saves a list of sections map

	constructor() {
		this.loadSections = new loadSections();
		this.campusProcessor = new CampusDataProcessor();
		this.htmlParser = new HTMLParser();
	}

	private async ensureDataAndMetadata(): Promise<void> {
		try {
			// Ensure 'data' directory exists
			await fs.access("data").catch(async () => {
				await fs.mkdir("data");
			});

			// Ensure metadata files exist, otherwise create them
			try {
				await fs.access(this.path_metadata_id);
				await fs.access(this.path_metadata_dataset);
			} catch {
				this.ids = [];
				this.datasets = [];
				await fs.writeFile(this.path_metadata_id, JSON.stringify(this.ids));
				await fs.writeFile(this.path_metadata_dataset, JSON.stringify(this.datasets));
				return;
			}

			const output = await fs.readFile(this.path_metadata_id);
			this.ids = JSON.parse(output.toString());
			const output1 = await fs.readFile(this.path_metadata_dataset);
			this.datasets = JSON.parse(output1.toString());
		} catch (error) {
			const message = (error as Error).message;
			throw new InsightError("Failed to ensure data and metadata" + message);
		}
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		await this.ensureDataAndMetadata();
		this.validateDatasetID(id);

		if (this.ids.includes(id)) {
			throw new InsightError("Dataset ID already exists");
		}

		// Ensure data/campus directory exists before extracting
		await fs.mkdirp("data/campus");

		let jsonContent: Section[] | Room[] = [];

		if (kind === InsightDatasetKind.Sections) {
			jsonContent = await this.loadSections.extractSections(content);
		} else if (kind === InsightDatasetKind.Rooms) {
			await this.htmlParser.extractTableRows("data/campus/index.htm");
			jsonContent = await this.campusProcessor.extractBuildingsAndRooms();
		}

		const newDataset: InsightDataset = {
			id: id,
			kind: kind,
			numRows: jsonContent.length,
		};

		// Save dataset metadata
		this.storeDatasetMetadata(id, newDataset);
		await this.persistDataset(id, jsonContent);

		return this.ids;
	}

	// private async ensureDataDirectoryExists(): Promise<void> {
	// 	try {
	// 		await fs.access("data"); // Check if 'data' directory exists
	// 	} catch (error) {
	// 		// If 'data' directory doesn't exist, create it
	// 		await fs.mkdir("data");
	// 	}
	// }
	//

	private validateDatasetID(id: string): void {
		if (!this.isIDvalid(id)) {
			throw new InsightError("Invalid dataset ID");
		}
	}

	// private async extractDatasetContent(content: string, kind: InsightDatasetKind): Promise<Section[]> {
	// 	if (kind !== InsightDatasetKind.Sections) {
	// 		throw new InsightError("Only 'Sections' kind is supported");
	// 	}
	// 	return await this.loadSections.extractSections(content);
	// }

	private storeDatasetMetadata(id: string, newDataset: InsightDataset): void {
		this.ids.push(id);
		this.datasets.push(newDataset);
	}

	private async persistDataset(id: string, jsonContent: Section[] | Room[]): Promise<void> {
		try {
			await fs.writeFile("data/content_" + id + ".json", JSON.stringify(jsonContent));
			await fs.writeFile(this.path_metadata_id, JSON.stringify(this.ids));
			await fs.writeFile(this.path_metadata_dataset, JSON.stringify(this.datasets));
		} catch (error) {
			const message = (error as Error).message;
			throw new InsightError("Failed to save dataset to disk: " + message);
		}
	}

	// throw new Error(
	// 	`InsightFacadeImpl::addDataset() is unimplemented! - id=${id}; content=${content?.length}; kind=${kind}`
	// );

	public async removeDataset(id: string): Promise<string> {
		// Validate input and check existence

		const index = this.ids.findIndex((datasetId) => datasetId === id);
		if (index === -1) {
			throw new NotFoundError("Dataset ID not found");
		}

		// Remove dataset from memory and disk
		await this.deleteDatasetFromMemoryAndDisk(id, index);

		return id;
	}

	private async deleteDatasetFromMemoryAndDisk(id: string, index: number): Promise<void> {
		this.ids.splice(index, 1);
		this.datasets.splice(index, 1);

		try {
			await fs.remove("data/content_" + id + ".json");
			await fs.writeFile(this.path_metadata_id, JSON.stringify(this.ids));
			await fs.writeFile(this.path_metadata_dataset, JSON.stringify(this.datasets));
		} catch (error) {
			const message = (error as Error).message;
			throw new InsightError("Unable to write to disk: " + message);
		}
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		const obj: QueryObject = new QueryObject();
		await obj.parse(query);

		// Need Sections Data Structure
		if (await obj.validate()) {
			await obj.filter();
			const queryResult: InsightResult[] = await obj.display();
			return queryResult;
		} else {
			throw new InsightError("Not a valid query");
		}
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		return Promise.resolve(this.datasets);
	}

	private isIDvalid(id: string): boolean {
		return !(id.includes("_") || id.trim() === "" || /[ \t\n\r]/.test(id));
	}
}
