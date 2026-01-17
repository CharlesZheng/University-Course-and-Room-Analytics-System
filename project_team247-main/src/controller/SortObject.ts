/**
 * This class handles the final grouping, calculation and sorting
 */

import { InsightResult } from "./IInsightFacade";
import ColumnsObject from "./OptionsObjects/ColumnsObject";
import DisplayObject from "./OptionsObjects/DisplayObject";
import OrderObject, { Direction } from "./OptionsObjects/OrderObject";
import ApplyObject from "./TransformationsObjects/ApplyObject";
import GroupObject from "./TransformationsObjects/GroupObject";
import Group from "./Group";

export default class SortObject {
	/**
	 * fields
	 * @param result The filtered result
	 * @param options The OPTIONS block
	 * @param group The GROUP block
	 * @param apply The APPLY block
	 */
	private datasetID: string;
	private result: object[];
	private options: DisplayObject[];
	private columns: ColumnsObject | undefined;
	private order: OrderObject | undefined;
	private group: GroupObject | undefined;
	private apply: ApplyObject | undefined;

	private grouped: Group[] = [];
	private ruledGroups: Group[] = [];
	private unorderedResult: InsightResult[] = [];

	private allFields: string[] = [
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
	constructor(id: string, res: object[], optlst: DisplayObject[], grp: GroupObject | null, apl: ApplyObject | null) {
		this.datasetID = id;
		this.result = res;
		this.options = optlst;
		if (grp !== null) {
			this.group = grp;
		}
		if (apl !== null) {
			this.apply = apl;
		}
	}

	/**
	 * Display the results
	 */
	public async displayResult(): Promise<InsightResult[]> {
		// First decompose the options
		await this.decomposeOptions();

		// check if transformation block exists
		if (this.group !== undefined) {
			// group the results
			this.grouped = await this.groupUp();
			// apply the rules
			this.ruledGroups = await this.applyRules();
			// Find columns to display
			this.unorderedResult = await this.groupsToDisplay();
		} else {
			// no transformation
			// find columns to display
			this.unorderedResult = await this.toDisplay();
		}

		// sort the result
		return await this.sort(this.unorderedResult);
	}

	/**
	 * Break the options into respective parts
	 */
	public async decomposeOptions(): Promise<void> {
		await Promise.all(
			this.options.map(async (option) => {
				if (option instanceof ColumnsObject) this.columns = option;
				else if (option instanceof OrderObject) this.order = option;
			})
		);
	}

	/**
	 * Group up the results
	 */
	public async groupUp(): Promise<Group[]> {
		const groupList: Group[] = [];
		if (this.group instanceof GroupObject) {
			const groupFields = await this.group.getFields();
			await Promise.all(
				this.result.map(async (data) => {
					const dataObj = JSON.parse(JSON.stringify(data));
					let dataID: string = "";
					for (const field of groupFields) {
						dataID = dataID + JSON.stringify(dataObj[field]);
					}
					let existGroup: boolean = false;
					await Promise.all(
						groupList.map(async (eachGroup) => {
							if (dataID === (await eachGroup.getID())) {
								existGroup = true;
								await eachGroup.addElem(data);
							}
						})
					);
					if (!existGroup) {
						const newGroup = new Group(dataID, groupFields);
						groupList.push(newGroup);
					}
				})
			);
		}
		return groupList;
	}

	/**
	 * Apply the rules
	 */
	public async applyRules(): Promise<Group[]> {
		const appliedGroups: Group[] = [];
		if (this.apply instanceof ApplyObject) {
			const ruleList = await this.apply.getRules();
			await Promise.all(
				this.grouped.map(async (eachGroup) => {
					await Promise.all(
						ruleList.map(async (rule) => {
							await rule.apply(eachGroup);
						})
					);
					appliedGroups.push(eachGroup);
				})
			);
		}
		return appliedGroups;
	}

	/**
	 * Find columns to display
	 */
	public async groupsToDisplay(): Promise<InsightResult[]> {
		const insightResults: InsightResult[] = [];
		await Promise.all(
			this.ruledGroups.map(async (eachGroup) => {
				const insightResult: InsightResult = {};
				if (this.columns !== undefined) {
					const fields = await this.columns.getFields();
					const applied = await eachGroup.getRules();
					const appliedKeys = Object.keys(applied);
					const element = (await eachGroup.getElem())[0];
					const obj = JSON.parse(JSON.stringify(element));
					for (const field of fields) {
						if (this.allFields.includes(field)) {
							insightResult[this.datasetID + "_" + field] = obj[field];
						} else if (appliedKeys.includes(field)) {
							insightResult[field] = applied[field];
						}
					}
					insightResults.push(insightResult);
				}
			})
		);
		return insightResults;
	}

	/**
	 * Find columns to display (no transformation)
	 */
	public async toDisplay(): Promise<InsightResult[]> {
		const insightResults: InsightResult[] = [];
		await Promise.all(
			this.result.map(async (data) => {
				const obj = JSON.parse(JSON.stringify(data));
				if (this.columns !== undefined) {
					const fields = await this.columns.getFields();
					const insightResult: InsightResult = {};
					for (const field of fields) {
						insightResult[this.datasetID + "_" + field] = obj[field];
					}
					insightResults.push(insightResult);
				}
			})
		);
		return insightResults;
	}

	/**
	 * Sort last
	 */
	public async sort(unordered: InsightResult[]): Promise<InsightResult[]> {
		// Two situations, sort by one key, or by a set of keys
		if (this.order !== undefined) {
			let ordered: InsightResult[] = [];
			if ((await this.order.getOneKey()) !== "") {
				ordered = await this.sortByOne(unordered);
			} else if ((await this.order.getDir()) !== Direction.Other) {
				ordered = await this.sortBySet(unordered);
			}
			return ordered;
		} else {
			return unordered;
		}
	}

	private async sortByOne(unordered: InsightResult[]): Promise<InsightResult[]> {
		if (this.order !== undefined) {
			const orderString = await this.order.getOneKey();
			return unordered.sort((a, b) => {
				if (a[orderString] < b[orderString]) {
					return -1;
				} else if (a[orderString] > b[orderString]) {
					return 1;
				} else {
					return 0;
				}
			});
		} else {
			return unordered;
		}
	}

	private async sortBySet(unordered: InsightResult[]): Promise<InsightResult[]> {
		if (this.order !== undefined) {
			const orderStrings = await this.order.getAllKeys();
			const orderDirection = await this.order.getDir();
			const isAscending: boolean = orderDirection === Direction.UP;
			return unordered.sort((a, b) => {
				for (const orderString of orderStrings) {
					if (a[orderString] < b[orderString]) {
						return isAscending ? -1 : 1;
					} else if (a[orderString] > b[orderString]) {
						return isAscending ? 1 : -1;
					}
				}
				return 0;
			});
		} else {
			return unordered;
		}
	}
}
