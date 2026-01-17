/**
 * This class represents no filter for filter
 * Notice that this cannot be a part of other FilterObject subclasses
 */

import FilterObject from "./FilterObject";
import { InsightError } from "../IInsightFacade";

export default class NoFilterObject extends FilterObject {
	/**
	 * constructor
	 */
	constructor() {
		super("NONE");
	}

	/**
	 * Parse the no-filter object
	 * @param key A key passed from QueryObject.parseFilter()
	 * @param obj A null passed from QueryObject.parseFilter()
	 */
	public async parse(key: string, obj: object | null): Promise<void> {
		return;
	}

	/**
	 * Validate the no-filter object
	 * The no-filter object is always valid
	 */
	public async validate(): Promise<boolean> {
		return true;
	}

	/**
	 * Filter the dataset, apply no filter
	 * @param dataset The dataset to filter
	 */
	public async filter(dataset: object): Promise<object[]> {
		const noFilter: object[] = [];
		const datasetObj = JSON.parse(JSON.stringify(dataset));
		if (Array.isArray(datasetObj)) {
			await Promise.all(
				datasetObj.map(async (section) => {
					noFilter.push(section);
				})
			);
		} else {
			throw new InsightError("NONE - Filter() -- Dataset is not parsed to JSON list");
		}
		return noFilter;
	}

	/**
	 * getIds
	 */
	public async getIds(): Promise<Set<string>> {
		const ids: Set<string> = new Set<string>();
		return ids;
	}
}
