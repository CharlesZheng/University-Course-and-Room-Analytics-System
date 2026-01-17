/**
 * This class represents an MComparison for filter
 */
import * as fs from "fs-extra";
import FilterObject from "./FilterObject";
import { InsightError } from "../IInsightFacade";

export const enum MComparator {
	LT,
	GT,
	EQ,
	Other,
}

export default class MCompObject extends FilterObject {
	/**
	 * fields
	 * @param mcomp A comparator used for filtering
	 * @param mkey An identifier of a section's dataset of number format
	 * 				Must in the format of "idstring_mfield"
	 * @param number The number compared against
	 * @param mfield_list The list of possible mfields
	 */
	private mcomp: MComparator;
	private mkey: string;
	private number: number;
	private mfield_list: string[] = ["avg", "pass", "fail", "audit", "year", "lat", "lon", "seats"];

	/**
	 * constructor
	 */
	constructor() {
		super("MCOMP");
		this.mcomp = MComparator.Other; // Default to other comparators, invalid
		this.mkey = ""; // Default to empty string, which is invalid
		this.number = 0; // Default to 0
	}

	/**
	 * parse the current object into a comparator, a key, and a num
	 */
	public async parse(key: string, obj: object | null): Promise<void> {
		// Get the MComparator
		switch (key) {
			case "LT":
				this.mcomp = MComparator.LT;
				break;
			case "GT":
				this.mcomp = MComparator.GT;
				break;
			case "EQ":
				this.mcomp = MComparator.EQ;
				break;
			default:
				break;
		}

		// Parse the obj into an mkey and a number
		if (obj !== null) {
			try {
				const mCompObj = JSON.parse(JSON.stringify(obj));
				if (mCompObj !== null && typeof mCompObj === "object" && !Array.isArray(mCompObj)) {
					const mCompKeys = Object.keys(mCompObj);
					// mCompKey should have exactly one entry
					if (mCompKeys.length > 1 || mCompKeys.length <= 0) {
						throw new InsightError("MCOMP -- MComparison has wrong number of entries");
					} else {
						this.mkey = mCompKeys[0];
						this.number = mCompObj[this.mkey];
					}
				} else {
					throw new InsightError("MCOMP -- MComparison is not parsed to JSON object");
				}
			} catch {
				throw new InsightError("MCOMP -- MComparison has an invalid object to parse");
			}
		} else {
			throw new InsightError("MCOMP -- Has filter of null");
		}
	}

	/**
	 * validates whether this current object is valid according to EBNF grammar
	 */
	public async validate(): Promise<boolean> {
		// If the comparator is not one of the three
		if (this.mcomp === MComparator.Other) {
			return false;
		}

		/**
		 * mkey can be invalidated in these ways
		 * Not wrapped in double quotation marks
		 * 		If mkey is not wrapped in quotation marks, JSON.parse() will throw an InsightError already
		 * mkey doesn't contain an underscore
		 * "idstring" is not a valid dataset id
		 * "idstring" is an empty string
		 * "idstring" has an underscore
		 * 		Included in the case of mkey having 2+ underscores
		 * mfield is not one of "avg", "pass", "fail", "audit", "year"
		 */
		try {
			// dataset ids are stored at path "data/metadata_id.json"
			const datasetIds = await fs.readJSON("data/metadata_id.json");
			if (!this.mkey.includes("_") || this.mkey.split("_").length > 2) {
				// no underscore
				return false;
			} else {
				// get the idstring and mfield
				const underscoreIndex = this.mkey.indexOf("_");
				const idstring = this.mkey.substring(0, underscoreIndex);
				const mfield = this.mkey.substring(underscoreIndex + 1);

				if (!Array.isArray(datasetIds) || !datasetIds.includes(idstring)) {
					return false;
				} else if (idstring === "") {
					// idstring is empty
					return false;
				}

				if (!this.mfield_list.includes(mfield)) {
					return false;
				}
			}
		} catch {
			throw new InsightError("Error reading dataset ID metadata file");
		}

		return true;
	}

	/**
	 * Filter the dataset with the current (filtered) dataset
	 * @param dataset The (filtered) dataset to further filter
	 */
	public async filter(dataset: object): Promise<object[]> {
		try {
			return this.filterDataset(dataset);
		} catch {
			throw new InsightError("MCOMP - Filter() -- Dataset not valid JSON format");
		}
	}

	/**
	 * get the comparator
	 */
	public async getComparator(): Promise<MComparator> {
		return this.mcomp;
	}

	/**
	 * get the idstring
	 */
	public async getIDString(): Promise<string> {
		if (!this.mkey.includes("_") || this.mkey.split("_").length > 2) {
			throw new InsightError("MCOMP -- Should not be validated");
		} else {
			const underscoreIndex = this.mkey.indexOf("_");
			return this.mkey.substring(0, underscoreIndex);
		}
	}

	/**
	 * get the mfield
	 */
	public async getMField(): Promise<string> {
		if (!this.mkey.includes("_") || this.mkey.split("_").length > 2) {
			throw new InsightError("MCOMP -- Should not be validated");
		} else {
			const underscoreIndex = this.mkey.indexOf("_");
			return this.mkey.substring(underscoreIndex + 1);
		}
	}

	/**
	 * get the number
	 */
	public async getCompNumber(): Promise<number> {
		return this.number;
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
	 * Filter the dataset
	 */
	private async filterDataset(dataset: object): Promise<object[]> {
		const filtered: object[] = [];
		const datasetObj = JSON.parse(JSON.stringify(dataset)); // datasetObj should a JSON list
		if (Array.isArray(datasetObj)) {
			const mfield = await this.getMField();
			await Promise.all(
				datasetObj.map(async (section) => {
					switch (this.mcomp) {
						case MComparator.LT:
							if (section[mfield] < this.number) {
								filtered.push(section);
							}
							break;
						case MComparator.GT:
							if (section[mfield] > this.number) {
								filtered.push(section);
							}
							break;
						case MComparator.EQ:
							if (section[mfield] === this.number) {
								filtered.push(section);
							}
							break;
					}
				})
			);
			return filtered;
		} else {
			throw new InsightError("MCOMP - Filter() -- Dataset not a JSON list");
		}
	}
}
