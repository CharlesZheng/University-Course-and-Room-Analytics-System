/**
 * This class represents columns to be displayed
 */
import * as fs from "fs-extra";
import DisplayObject from "./DisplayObject";
import { InsightError } from "../IInsightFacade";

export default class ColumnsObject extends DisplayObject {
	/**
	 * fields
	 * @param keyList a list of keys
	 * @param ids the set of ids from the keys, should only have one element
	 * @param fields possible mfields and sfields
	 * @param applykeys	list of applykeys
	 */
	private keyList: string[];
	private ids: Set<string> = new Set<string>();
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
	private applykeys: string[] = [];

	/**
	 * constructor
	 */
	constructor() {
		super("COLUMNS");
		this.keyList = [];
	}

	/**
	 * Parse the Columns object
	 */
	public async parse(obj: object): Promise<void> {
		const keyListObj = JSON.parse(JSON.stringify(obj));
		if (Array.isArray(keyListObj)) {
			keyListObj.forEach((key) => {
				if (typeof key === "string") {
					this.keyList.push(key);
				} else {
					throw new InsightError("COLUMNS -- Key list contain non-strings");
				}
			});
		} else {
			throw new InsightError("COLUMNS -- Key list is not parsed to an array");
		}
		return;
	}

	/**
	 * Validate the Columns object
	 */
	public async validate(): Promise<boolean> {
		/**
		 * keyList can be invalid in the following ways
		 * it is an empty list
		 * the key is an invalid mkey or skey (when it has one underscore)
		 * the keys reference different datasets
		 */
		/**
		 * Each key can be invalid in the following ways
		 * the key contains more than one underscore
		 * "idstring" is empty, contains underscore (will have more than 1 underscore), or does not exist
		 * the mfield/sfield is not one of	"avg", "pass", "fail", "audit", "year"
		 * 								or	"dept", "id", "instructor", "title", "uuid"
		 */
		try {
			// dataset ids are stored at path "data/metadata_id.json"
			const datasetIds = await fs.readJSON("data/metadata_id.json");
			for (const key of this.keyList) {
				if (!key.includes("_")) {
					// no underscore, could be apply key
					if (key !== "") {
						// the key has at least one character
						this.applykeys.push(key);
					} else {
						throw new InsightError("COLUMNS - key is empty string"); // empty string is invalid
					}
				} else if (key.split("_").length > 2) {
					// more than one underscore
					throw new InsightError("COLUMNS - key has more than one underscore");
				} else {
					// get the idstring and mfield/sfield
					const underscoreIndex = key.indexOf("_");
					const idstring = key.substring(0, underscoreIndex);
					const field = key.substring(underscoreIndex + 1);

					if (!Array.isArray(datasetIds) || !datasetIds.includes(idstring)) {
						throw new InsightError("COLUMNS - dataset ID file not parsed to array, or idstring not present.");
					} else if (idstring === "") {
						throw new InsightError("COLUMNS - idstring is empty string");
					}
					this.ids.add(idstring);

					if (!this.validateField(field)) {
						throw new InsightError("COLUMNS - field is invalid");
					}
				}
			}
		} catch {
			throw new InsightError("Error reading dataset ID metadata file");
		}

		if (this.ids.size !== 1) {
			return false;
		}
		return true;
	}

	/**
	 * Get the idstrings
	 */
	public async getIDString(): Promise<string> {
		for (const key of this.keyList) {
			if (key.split("_").length > 2) {
				// no underscore: possible applykey
				throw new InsightError("COLUMNS -- Some key have more than one underscore");
			} else if (key.includes("_")) {
				// get the idstring
				const underscoreIndex = key.indexOf("_");
				const idstring = key.substring(0, underscoreIndex);
				this.ids.add(idstring);
			}
		}
		if (this.ids.size !== 1) {
			throw new InsightError("COLUMNS -- Keys references not exactly one dataset");
		} else {
			const [onlyID] = this.ids.values();
			return onlyID;
		}
	}

	/**
	 * Get the fields
	 */
	public async getFields(): Promise<string[]> {
		let fields: string[] = [];
		for (const key of this.keyList) {
			if (key.split("_").length > 2) {
				// more than one underscore
				throw new InsightError("COLUMNS -- Some key have more than one underscore");
			} else if (!key.includes("_")) {
				fields = [...fields, ...this.applykeys];
			} else {
				// get the idstring
				const underscoreIndex = key.indexOf("_");
				const field = key.substring(underscoreIndex + 1);
				fields.push(field);
			}
		}
		return fields;
	}

	/**
	 * Get all the keys from column
	 */
	public async getAllKeys(): Promise<string[]> {
		return this.keyList;
	}

	/**
	 * get ids
	 */
	public async getIds(): Promise<Set<string>> {
		const IDSet = new Set<string>();
		await Promise.all(
			this.keyList.map(async (key) => {
				if (key.includes("_")) {
					const underscoreIndex = key.indexOf("_");
					IDSet.add(key.substring(0, underscoreIndex));
				}
			})
		);
		return IDSet;
	}

	/**
	 * Get the applykeys
	 */
	public async getApplyKeys(): Promise<string[]> {
		return this.applykeys;
	}

	/**
	 * validate() submethod
	 * @param field
	 */
	private validateField(field: string): boolean {
		if (!this.fields.includes(field)) {
			return false;
		}
		return true;
	}
}
