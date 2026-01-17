import HTMLParser from "./HTMLParser";
import { Building } from "./Interface/BuildingInterface";
import { InsightError } from "./IInsightFacade";
import * as http from "http";

export default class BuildingProcessor {
	private htmlParser: HTMLParser;

	constructor() {
		this.htmlParser = new HTMLParser();
	}

	public async extractBuildings(): Promise<Building[]> {
		const filePath = "data/campus/index.htm";
		const tableRows = await this.htmlParser.extractTableRows(filePath);

		if (!tableRows || tableRows.length === 0) {
			throw new InsightError("Building information could not be extracted.");
		}

		return await this.processBuildings(tableRows);
	}

	private async processBuildings(tableRows: any[]): Promise<Building[]> {
		const buildings: Building[] = [];
		const geoRequests: Promise<any>[] = [];

		for (const row of tableRows) {
			const building = this.extractBuildingAttributes(row);
			if (building) {
				buildings.push(building);
				geoRequests.push(this.fetchGeolocation(building.address));
			}
		}

		if (buildings.length === 0) {
			throw new InsightError("No valid buildings found.");
		}

		const geoResults = await Promise.all(geoRequests);
		return this.combineBuildingsWithGeolocation(buildings, geoResults);
	}

	private extractBuildingAttributes(row: any): Building | null {
		const fullname = row["views-field-title"];
		const shortname = row["views-field-field-building-code"];
		const address = row["views-field-field-building-address"];

		let link = "";
		if (fullname?.includes("href")) {
			const match = fullname.match(/href="(.*?)"/);
			link = match ? match[1] : "";
		}

		if (!fullname || !shortname || !address || !link) {
			return null;
		}

		return { fullname, shortname, address, lat: 0, lon: 0, link };
	}

	private async fetchGeolocation(address: string): Promise<any> {
		const encodedAddress = encodeURIComponent(address);
		const url = `http://cs310.students.cs.ubc.ca:11316/api/v1/project_team247/${encodedAddress}`;

		try {
			return await new Promise((resolve, reject) => {
				http
					.get(url, (res) => {
						let rawData = "";
						res.on("data", (chunk) => (rawData += chunk));
						res.on("end", () => {
							try {
								const data = JSON.parse(rawData);
								resolve(data);
							} catch {
								reject(null);
							}
						});
					})
					.on("error", () => reject(null));
			});
		} catch {
			return null;
		}
	}

	private combineBuildingsWithGeolocation(buildings: Building[], geoResults: any[]): Building[] {
		return buildings.map((building, index) => {
			const geoData = geoResults[index];
			if (geoData?.lat && geoData.lon) {
				return { ...building, lat: geoData.lat, lon: geoData.lon };
			} else {
				return building;
			}
		});
	}
}
