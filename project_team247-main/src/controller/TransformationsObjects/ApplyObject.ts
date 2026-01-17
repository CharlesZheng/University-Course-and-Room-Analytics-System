/**
 * This class represents the group of rules applied and the result of those calculations
 */

import { InsightError } from "../IInsightFacade";
import RuleObject from "./RuleObject";

export default class ApplyObject {
	/**
	 * fields
	 * @param listRule The list of rules to apply
	 * @param applykeys The set of applykeys
	 */
	private listRule: RuleObject[];
	private applykeys: Set<string> = new Set<string>();
	private tokenList: string[] = ["MAX", "MIN", "AVG", "SUM", "COUNT"];

	/**
	 * constructor
	 */
	constructor() {
		this.listRule = []; // default to empty list
	}

	/**
	 * parse the apply part into respective rules
	 */
	public async parse(obj: object | null): Promise<void> {
		if (obj !== null) {
			const applyObj = JSON.parse(JSON.stringify(obj));
			if (Array.isArray(applyObj)) {
				if (applyObj.length > 0) {
					// there are rules to apply
					await Promise.all(
						applyObj.map(async (rule) => {
							if (rule !== null && typeof rule === "object" && !Array.isArray(rule)) {
								const ruleKeys = Object.keys(rule);
								if (ruleKeys.length === 1) {
									const ruleKey = ruleKeys[0];
									if (this.tokenList.includes(ruleKey)) {
										const ruleValue = rule[ruleKey];
										const ruleObj = new RuleObject();
										await ruleObj.parse(ruleKey, ruleValue);
										this.listRule.push(ruleObj);
									} else {
										throw new InsightError("APPLY -- rule token is not one of the five");
									}
								} else {
									throw new InsightError("APPLY -- rule has irrelevant or no keys");
								}
							} else {
								throw new InsightError("APPLY -- rule is not a JSON object");
							}
						})
					);
				}
			} else throw new InsightError("APPLY -- object being parsed is not a list");
		} else {
			throw new InsightError("APPLY -- object being parsed is null");
		}
		return;
	}

	/**
	 * validate whether this object complies with the requirements
	 */
	public async validate(): Promise<boolean> {
		// Validate each RuleObject
		await Promise.all(
			this.listRule.map(async (rule) => {
				if (!(await rule.validate())) {
					return false;
				}
			})
		);

		// Cross validate so no two ApplyRule has the same applykey
		await Promise.all(
			this.listRule.map(async (rule) => {
				this.applykeys.add(await rule.getApplyKey());
			})
		);
		if (this.applykeys.size !== this.listRule.length) {
			return false;
		}

		// All rules must reference the same dataset id
		const ruleDatasetIds: Set<string> = new Set<string>();
		await Promise.all(
			this.listRule.map(async (rule) => {
				const ruleKey = await rule.getKey();
				if (ruleKey.includes("_") && ruleKey.split("_").length === 2) {
					const underscoreIndex = ruleKey.indexOf("_");
					const idstring = ruleKey.substring(0, underscoreIndex);
					ruleDatasetIds.add(idstring);
				} else {
					return false;
				}
			})
		);
		if (ruleDatasetIds.size !== 1) {
			return false;
		}
		return true;
	}

	/**
	 * get all the apply keys
	 */
	public async getApplyKeys(): Promise<Set<string>> {
		return this.applykeys;
	}

	/**
	 * get all rules
	 */
	public async getRules(): Promise<RuleObject[]> {
		return this.listRule;
	}
}
