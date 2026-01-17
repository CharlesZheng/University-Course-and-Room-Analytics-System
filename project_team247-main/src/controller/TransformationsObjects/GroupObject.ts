/**
 * This class represents the GROUP-BY functionality in Transformations Block
 */

import { InsightError } from "../IInsightFacade";
import * as fs from "fs-extra";

export default class GroupObject {
	/**
	 * fields
	 * @param listKey The list of mkey or skey to group the filtered results by
	 * 					mkey must be "idstring_mfield"
	 * 					skey must be "idstring_sfield"
	 * @param ids potential more than one dataset id
	 * @param id dataset id
	 */
	private listKey: string[];
	private ids: Set<string> = new Set<string>();
	private id: string;
	private fields: string[] = [
		"avg",
		"pass",
		"fail",
		"audit",
		"year",
		"lat",
		"lon",
		"seats",
		"dept",
		"id",
		"instructor",
		"title",
		"uuid",
		"fullname",
		"shortname",
		"number",
		"name",
		"address",
		"type",
		"furniture",
		"href",
	];

	/**
	 * constructor
	 */
	constructor() {
		this.listKey = [];
		this.id = "";
	}

	/**
	 * parse the list of keys
	 * @param
	 */
	public async parse(obj: object | null): Promise<void> {
		if (obj !== null) {
			const groupObj = JSON.parse(JSON.stringify(obj));
			if (Array.isArray(groupObj)) {
				await Promise.all(
					groupObj.map(async (key) => {
						if (typeof key === "string") {
							this.listKey.push(key);
						} else {
							throw new InsightError("GROUP -- list has non-string entries");
						}
					})
				);
			} else {
				throw new InsightError("GROUP -- object being parsed is not a list");
			}
		} else {
			throw new InsightError("GROUP -- object being parsed is null");
		}
		return;
	}

	/**
	 * validate each key to a proper mkey or skey
	 * validate whether there are multiple occurrences of idstring
	 */
	public async validate(): Promise<boolean> {
		try {
			const datasetIds = await fs.readJSON("data/metadata_id.json");
			await Promise.all(
				this.listKey.map(async (key) => {
					if (!key.includes("_") || key.split("_").length > 2) {
						// no underscore, or more than 2 underscores
						return false;
					} else {
						// get the idstring and mfield/sfield
						const underscoreIndex = key.indexOf("_");
						const idstring = key.substring(0, underscoreIndex);
						const field = key.substring(underscoreIndex + 1);

						if (!Array.isArray(datasetIds) || !datasetIds.includes(idstring)) {
							return false;
						} else if (idstring === "") {
							// idstring is empty
							return false;
						}
						this.ids.add(idstring);

						if (!this.fields.includes(field)) {
							return false;
						}
					}
				})
			);
		} catch {
			throw new InsightError("Error reading dataset ID metadata file");
		}

		if (this.ids.size !== 1) {
			return false;
		}
		return true;
	}

	/**
	 * get all keys
	 */
	public async getAllKeys(): Promise<string[]> {
		return this.listKey;
	}

	/**
	 * get all fields
	 */
	public async getFields(): Promise<string[]> {
		const fields: string[] = [];
		await Promise.all(
			this.listKey.map(async (key) => {
				const underscoreIndex = key.indexOf("_");
				const field = key.substring(underscoreIndex + 1);
				fields.push(field);
			})
		);
		return fields;
	}

	/**
	 * Get id
	 */
	public async getID(): Promise<string> {
		if (this.ids.size === 1) {
			const [dataID] = this.ids.values();
			this.id = dataID;
		}
		return this.id;
	}
}
