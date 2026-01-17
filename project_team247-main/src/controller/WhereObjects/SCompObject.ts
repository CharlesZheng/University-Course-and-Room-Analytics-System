/**
 * This class represents an SComparison for filter
 */
import * as fs from "fs-extra";
import FilterObject from "./FilterObject";
import { InsightError } from "../IInsightFacade";

export enum Wildcard {
	EXACT,
	BEGIN,
	END,
	CONTAIN,
	Other,
}

export default class SCompObject extends FilterObject {
	/**
	 * field
	 * @param skey An identifier of a section's dataset of string format
	 * 				Must be in the format of "idstring_sfield"
	 * @param inputstring The input string must not contain '*'
	 * @param wildcard One of the four:
	 * 					exact match, begin with inputstring "inputstring*"
	 * 					end with inputstring "*inputstring", containing inputstring "*inputstring*"
	 * @param sfield_list The list of possible sfields
	 */
	private skey: string;
	private inputstring: string;
	private wildcard: Wildcard;
	private sfield_list: string[] = [
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
		super("SCOMP");
		this.skey = ""; // Skey default to empty string, it is invalid
		this.inputstring = ""; // Input string default to empty string
		this.wildcard = Wildcard.Other; // Wildcard default to Other, invalid
	}

	/**
	 * Parse the object into a key, an input string, and a wildcard
	 */
	public async parse(key: string, obj: object | null): Promise<void> {
		// key will be "" from QueryObject.parseFilter()
		if (obj !== null) {
			await this.parseSCompObj(obj);
		} else {
			throw new InsightError("SCOMP -- Has filter of null");
		}
	}

	/**
	 * Validate whether the skey and the inputstring follows EBNF
	 */
	public async validate(): Promise<boolean> {
		/**
		 * skey can be invalid in the following ways
		 * skey does not contain an underscore
		 * "idstring" is not a valid dataset id
		 * "idstring" is an empty string
		 * "idstring" has an underscore
		 * 		Included in the case of mkey having 2+ underscores
		 * sfield is not one of "dept", "id", "instructor", "title", "uuid"
		 */
		try {
			// dataset ids are stored at path "data/metadata_id.json"
			const datasetIds = await fs.readJSON("data/metadata_id.json");
			if (!this.skey.includes("_") || this.skey.split("_").length > 2) {
				// skey does not include an underscore, or there are more than one underscore
				return false;
			} else {
				// skey has exactly one underscore, get the idstring and the sfield
				const underscoreIndex = this.skey.indexOf("_");
				const idstring = this.skey.substring(0, underscoreIndex);
				const sfield = this.skey.substring(underscoreIndex + 1);

				if (!Array.isArray(datasetIds) || !datasetIds.includes(idstring)) {
					return false;
				} else if (idstring === "") {
					// idstring is empty
					return false;
				}

				if (!this.sfield_list.includes(sfield)) {
					return false;
				}
			}
		} catch {
			throw new InsightError("Error reading dataset ID metadata file");
		}

		/**
		 * inputstring can be invalid in the following ways
		 * inputstring contains asterisks
		 */

		// Wildcard is invalid if it is Wildcard.Other
		if (this.wildcard === Wildcard.Other) {
			return false;
		}

		return true;
	}

	/**
	 * Filter the given dataset with respect to the input string and wildcard
	 */
	public async filter(dataset: object): Promise<object[]> {
		try {
			return await this.filterDataset(dataset);
		} catch {
			throw new InsightError("SCOMP - Filter() -- Dataset not a JSON list");
		}
		return [];
	}

	/**
	 * get the idstring
	 */
	public async getIDString(): Promise<string> {
		if (!this.skey.includes("_") || this.skey.split("_").length > 2) {
			throw new InsightError("MCOMP -- Should not be validated");
		} else {
			const underscoreIndex = this.skey.indexOf("_");
			return this.skey.substring(0, underscoreIndex);
		}
	}

	/**
	 * get the sfield
	 */
	public async getSField(): Promise<string> {
		if (!this.skey.includes("_") || this.skey.split("_").length > 2) {
			throw new InsightError("MCOMP -- Should not be validated");
		} else {
			const underscoreIndex = this.skey.indexOf("_");
			return this.skey.substring(underscoreIndex + 1);
		}
	}

	/**
	 * Get the input string
	 */
	public async getInputString(): Promise<string> {
		return this.inputstring;
	}

	/**
	 * Get the wildcard
	 */
	public async getWildcard(): Promise<Wildcard> {
		return this.wildcard;
	}

	/**
	 * getIds
	 */
	public async getIds(): Promise<Set<string>> {
		const ids: Set<string> = new Set<string>();
		const id = await this.getIDString();
		ids.add(id);
		return ids;
	}

	/**
	 * Parse the SComparisonObject
	 */
	private async parseSCompObj(sCompObject: object): Promise<void> {
		try {
			const sCompObj = JSON.parse(JSON.stringify(sCompObject));
			if (sCompObj !== null && typeof sCompObj === "object" && !Array.isArray(sCompObj)) {
				const sCompKeys = Object.keys(sCompObj);
				// sCompKeys should have exactly one entry
				if (sCompKeys.length > 1 || sCompKeys.length <= 0) {
					throw new InsightError("SCOMP -- SComparison has wrong number of entries");
				} else {
					this.skey = sCompKeys[0];
					// parse the value of this key-value pair into an input string and wildcards
					const input = sCompObj[this.skey]; // input should be of format [*]? inputstring [*]?
					const inputLen = input.length;
					const fstChar = input[0];
					const lstChar = input[inputLen - 1];
					if (fstChar === "*" && lstChar === "*") {
						// Contain
						this.wildcard = Wildcard.CONTAIN;
						this.inputstring = input.substring(1, inputLen - 1);
					} else if (fstChar === "*") {
						// End
						this.wildcard = Wildcard.END;
						this.inputstring = input.substring(1);
					} else if (lstChar === "*") {
						// Begin
						this.wildcard = Wildcard.BEGIN;
						this.inputstring = input.substring(0, inputLen - 1);
					} else {
						// Exact
						this.wildcard = Wildcard.EXACT;
						this.inputstring = input;
					}
				}
			} else {
				throw new InsightError("SCOMP -- SComparison is not parsed to JSON object");
			}
		} catch {
			throw new InsightError("SCOMP -- SComparison has an invalid object to parse");
		}
	}

	/**
	 * Filter the dataset
	 */
	private async filterDataset(dataset: object): Promise<object[]> {
		const filtered: object[] = [];
		const datasetObj = JSON.parse(JSON.stringify(dataset));
		if (Array.isArray(datasetObj)) {
			const sfield = await this.getSField();
			await Promise.all(
				datasetObj.map(async (section) => {
					if (this.wildcard === Wildcard.BEGIN) {
						if (section[sfield].endsWith(this.inputstring)) {
							filtered.push(section);
						}
					} else if (this.wildcard === Wildcard.END) {
						if (section[sfield].startsWith(this.inputstring)) {
							filtered.push(section);
						}
					} else if (this.wildcard === Wildcard.CONTAIN) {
						if (section[sfield].includes(this.inputstring)) {
							filtered.push(section);
						}
					} else if (this.wildcard === Wildcard.EXACT) {
						if (section[sfield] === this.inputstring) {
							filtered.push(section);
						}
					}
				})
			);
			return filtered;
		} else {
			throw new InsightError("SCOMP - Filter() -- Dataset not a JSON list");
		}
	}
}
