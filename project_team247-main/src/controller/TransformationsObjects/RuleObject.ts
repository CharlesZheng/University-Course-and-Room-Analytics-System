import { InsightError } from "../IInsightFacade";
import * as fs from "fs-extra";
import Group from "../Group";
import Decimal from "decimal.js";
/**
 * This class represent one rule to apply to a grouped result
 */
export enum Token {
	MAX,
	MIN,
	AVG,
	COUNT,
	SUM,
	Other,
}

export default class RuleObject {
	/**
	 * fields
	 * @param applykey The name of the information after applying the rule
	 * @param token The token to apply
	 * @param key The mkey or skey to be applied on
	 * @param fields possible mfields and sfields
	 */
	private applykey: string;
	private token: Token;
	private key: string;
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
	private mfields = ["avg", "pass", "fail", "audit", "year", "lat", "lon", "seats"];

	/**
	 * constructor
	 */
	constructor() {
		this.applykey = ""; // default to empty string, which is invalid
		this.token = Token.Other; // default to other, which is an invalid token to apply
		this.key = ""; // default to empty string, which is invalid
	}

	/**
	 * parse the object
	 * @param objKey The key of the key-value pair of the JSON object
	 * @param obj The object to extract the token and the key on which to apply
	 */
	public async parse(objKey: string, obj: object | null): Promise<void> {
		this.applykey = objKey;

		const applyRule = JSON.parse(JSON.stringify(obj));
		if (applyRule !== null && typeof applyRule === "object" && !Array.isArray(applyRule)) {
			const applyRuleKeys = Object.keys(applyRule);
			if (applyRuleKeys.length === 1) {
				const applyToken = applyRuleKeys[0];
				const keyToApply = applyRule[applyToken];
				switch (applyToken) {
					case "MAX":
						this.token = Token.MAX;
						break;
					case "MIN":
						this.token = Token.MIN;
						break;
					case "AVG":
						this.token = Token.AVG;
						break;
					case "SUM":
						this.token = Token.SUM;
						break;
					case "COUNT":
						this.token = Token.COUNT;
						break;
					default:
						break;
				}
				this.key = keyToApply;
			} else {
				throw new InsightError("APPLYRULE -- not exactly one token");
			}
		} else {
			throw new InsightError("APPLYRULE -- Not a JSON object");
		}
	}

	/**
	 * validate the object
	 */
	public async validate(): Promise<boolean> {
		// First, applykey must not be an empty string or contain underscore
		if (this.applykey !== "" && this.applykey.includes("_")) {
			// Second, token must not be other
			if (this.token !== Token.Other) {
				// Third, the key must be idstring_field
				// the key is invalid in the same way as mkey or skey is valid
				try {
					const datasetIds = await fs.readJSON("data/metadata_id.json");
					if (!this.key.includes("_") || this.key.split("_").length > 2) {
						// no underscore, or more than 2 underscores
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

						return true;
					}
				} catch {
					throw new InsightError("Error reading dataset ID metadata file");
				}
			}
		}
		return false;
	}

	/**
	 * apply the rule on a group
	 */
	public async apply(grp: Group): Promise<void> {
		// Get the field of the key
		const underscoreIndex = this.key.indexOf("_");
		const field = this.key.substring(underscoreIndex + 1);

		// get the elements in the group and the value of the field of interest
		const elements = await grp.getElem();
		const relevantVals: (number | string)[] = [];
		await Promise.all(
			elements.map(async (element) => {
				const obj = JSON.parse(JSON.stringify(element));
				if (typeof obj[field] === "string" || typeof obj[field] === "number") {
					relevantVals.push(obj[field]);
				}
			})
		);

		// calculate
		let result: number = 0;
		result = await this.calculate(field, result, relevantVals);

		// add this result into the group
		await grp.addRule(this.applykey, result);
	}

	/**
	 * Get the applykey
	 */
	public async getApplyKey(): Promise<string> {
		return this.applykey;
	}

	/**
	 * get the key
	 */
	public async getKey(): Promise<string> {
		return this.key;
	}

	private async calculate(field: string, result: number, relevantVals: (number | string)[]): Promise<number> {
		if (this.token === Token.COUNT) {
			result = relevantVals.length;
		} else {
			if (this.mfields.includes(field) && relevantVals.every((value) => typeof value === "number")) {
				if (this.token === Token.MIN) {
					result = Math.min(...relevantVals);
				} else if (this.token === Token.MAX) {
					result = Math.max(...relevantVals);
				} else if (this.token === Token.SUM) {
					let sum = new Decimal(0);
					for (const num of relevantVals) {
						sum = sum.add(new Decimal(num));
					}
					result = Number(sum.toFixed(2));
				} else if (this.token === Token.AVG) {
					let sum = new Decimal(0);
					for (const num of relevantVals) {
						sum = sum.add(new Decimal(num));
					}
					const avg = sum.toNumber() / relevantVals.length;
					result = Number(avg.toFixed(2));
				} else {
					throw new InsightError("APPLYRULE -- invalid token");
				}
			} else {
				throw new InsightError("APPLYRULE - Token cannot be applied to strings");
			}
		}
		return result;
	}
}
