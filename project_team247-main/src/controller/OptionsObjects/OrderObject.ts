/**
 * This class represents the order of display
 */
import * as fs from "fs-extra";
import DisplayObject from "./DisplayObject";
import { InsightError } from "../IInsightFacade";

export enum Direction {
	UP,
	DOWN,
	Other,
}

export default class OrderObject extends DisplayObject {
	/**
	 * fields
	 * @param key An mkey or a skey or an applykey
	 * 				mkey in the format of "idstring_mfield"
	 * 				skey in the format of "idstring_sfield"
	 * 				applykey must have at least one character
	 * @param dir A direction of ordering, either "UP" or "DOWN"
	 * 				do not need to exist
	 * @param keys list of keys to order by
	 * 				If 1st element has the same, the next element is the tie-breaker
	 * @param fields possible list of mfields or sfields
	 * @param applykeys the list of applykey(s)
	 */
	private key: string;
	private dir: Direction;
	private keys: string[];
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
	private ids: Set<string> = new Set<string>();

	/**
	 * constructor
	 */
	constructor() {
		super("ORDER");
		this.key = ""; // Default to empty string
		this.dir = Direction.Other; // Default to Other, meaning either invalid or only one key is used
		this.keys = []; // Default to empty, invalid
	}

	/**
	 * Parse the Order object
	 */
	public async parse(obj: object): Promise<void> {
		const sortObj = JSON.parse(JSON.stringify(obj));
		if (typeof sortObj === "string") {
			this.key = sortObj;
		} else if (sortObj !== null && typeof sortObj === "object" && !Array.isArray(sortObj)) {
			await this.parseOrder(sortObj);
		} else {
			throw new InsightError("ORDER -- not a string or JSON object to sort by");
		}
		return;
	}

	/**
	 * Validate the Order object
	 */
	public async validate(): Promise<boolean> {
		/**
		 * Situation 1: key = "", dir and keys non empty
		 * Situation 2: key = smth, dir is Other and keys is empty
		 */
		if (this.dir === Direction.Other && this.keys.length === 0 && this.key !== "") {
			// ORDER: "ANYKEY"
			return await this.validateKey();
		} else if (this.dir !== Direction.Other && this.keys.length !== 0 && this.key === "") {
			// ORDER: {...}
			return await this.validateObject();
		} else {
			return false;
		}
	}

	/**
	 * Get the idstring
	 */
	public async getIDString(): Promise<string> {
		return ""; // don't get ID string from here
	}

	/**
	 * Get the field
	 */
	public async getField(): Promise<string> {
		if (!this.key.includes("_") || this.key.split("_").length > 2) {
			// no underscore
			throw new InsightError("ORDER -- Some key does not have underscore");
		} else {
			// get the field
			const underscoreIndex = this.key.indexOf("_");
			return this.key.substring(underscoreIndex + 1);
		}
	}

	/**
	 * Get the applykeys
	 */
	public async getApplyKeys(): Promise<string[]> {
		return this.applykeys;
	}

	/**
	 * get ids
	 */
	public async getIds(): Promise<Set<string>> {
		const IDSet: Set<string> = new Set<string>();
		if (this.key !== "") {
			if (this.key.includes("_")) {
				const underscoreIndex = this.key.indexOf("_");
				IDSet.add(this.key.substring(0, underscoreIndex));
			}
		} else if (this.keys.length !== 0) {
			for (const eachKey of this.keys) {
				if (eachKey.includes("_")) {
					const underscoreIndex = eachKey.indexOf("_");
					IDSet.add(eachKey.substring(0, underscoreIndex));
				}
			}
		}
		return IDSet;
	}

	/**
	 * get one key
	 */
	public async getOneKey(): Promise<string> {
		return this.key;
	}

	/**
	 * get all keys
	 */
	public async getAllKeys(): Promise<string[]> {
		return this.keys;
	}

	/**
	 * get direction
	 */
	public async getDir(): Promise<Direction> {
		return this.dir;
	}

	/**
	 * parse when ORDER is a JSON object
	 * @param sortObject The JSON object to extract information from
	 */
	private async parseOrder(sortObject: object): Promise<void> {
		const sortObj = JSON.parse(JSON.stringify(sortObject));
		const sortObjKeys = Object.keys(sortObj);
		if (sortObjKeys.includes("dir") && sortObjKeys.includes("keys") && sortObjKeys.length === 2) {
			const direction = sortObj.dir;
			const sortKeys = sortObj.keys;
			switch (direction) {
				case "UP":
					this.dir = Direction.UP;
					break;
				case "DOWN":
					this.dir = Direction.DOWN;
					break;
				default:
					break;
			}
			if (Array.isArray(sortKeys) && sortKeys.length > 0) {
				for (const eachKey of sortKeys) {
					if (typeof eachKey !== "string") {
						this.keys.push(eachKey);
					} else {
						throw new InsightError("ORDER -- keys list has non-string entries");
					}
				}
			} else {
				throw new InsightError("ORDER -- keys is not a list or no keys present");
			}
		} else {
			throw new InsightError("ORDER -- JSON object doesn't have dir or keys, or has irrelevant keys");
		}
	}

	/**
	 * Validate when it is only one key
	 */
	private async validateKey(): Promise<boolean> {
		// the key is invalid in the same way as mkey or skey is valid
		try {
			const datasetIds = await fs.readJSON("data/metadata_id.json");
			if (!this.key.includes("_")) {
				// no underscore, could be applykey
				if (this.key !== "") {
					this.applykeys.push(this.key);
				} else {
					return false;
				}
			} else if (this.key.split("_").length > 2) {
				// has more than one underscore
				return false;
			} else {
				// get the idstring and mfield/sfield
				const underscoreIndex = this.key.indexOf("_");
				const idstring = this.key.substring(0, underscoreIndex);
				const field = this.key.substring(underscoreIndex + 1);

				if (!Array.isArray(datasetIds) || !datasetIds.includes(idstring)) {
					return false;
				} else if (idstring === "") {
					// idstring is empty
					return false;
				}

				if (!this.fields.includes(field)) {
					return false;
				}
			}
		} catch {
			throw new InsightError("Error reading dataset ID metadata file");
		}
		return true;
	}

	/**
	 * Validate the JSON object
	 */
	private async validateObject(): Promise<boolean> {
		// Direction must be either UP or DOWN
		if (this.dir === Direction.UP || this.dir === Direction.DOWN) {
			// each key in the key list must either be an applykey or idstring_field
			try {
				const datasetIds = await fs.readJSON("data/metadata_id.json");
				await Promise.all(
					this.keys.map(async (key) => {
						if (!key.includes("_")) {
							// no underscore, could be apply key
							if (key !== "") {
								// the key has at least one character
								this.applykeys.push(key);
							} else {
								return false; // empty string is invalid
							}
						} else if (key.split("_").length > 2) {
							// more than one underscore
							return false;
						} else {
							// get the idstring and mfield/sfield
							const underscoreIndex = key.indexOf("_");
							const idstring = key.substring(0, underscoreIndex);
							const field = key.substring(underscoreIndex + 1);

							if (!Array.isArray(datasetIds) || !datasetIds.includes(idstring)) return false;
							else if (idstring === "") return false;
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
		}
		return false;
	}
}
