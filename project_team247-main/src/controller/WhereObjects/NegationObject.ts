import FilterObject from "./FilterObject";
import { InsightError } from "../IInsightFacade";
import LogicObject from "./LogicObject";
import MCompObject from "./MCompObject";
import SCompObject from "./SCompObject";
/**
 * This class represents the negation filter
 */

export default class NegationObject extends FilterObject {
	/**
	 * fields
	 * @param filter The filter to be negated
	 */
	private filterObj: FilterObject | null;

	/**
	 * constructor
	 */
	constructor() {
		super("NEG");
		this.filterObj = null; // Default the filter to null, invalid
	}

	/**
	 * parse to fill information about the FilterObject
	 */
	public async parse(key: string, obj: object | null): Promise<void> {
		// key should be "" from QueryObject.parseFilter()
		if (obj !== null) {
			await this.parseFilter(obj);
		} else {
			throw new InsightError("NEG -- Has filter of null");
		}
	}

	/**
	 * Validate whether the content follows the EBNF logic
	 */
	public async validate(): Promise<boolean> {
		// invalid if and only if the filter is invalid
		if (this.filterObj === null) {
			return false;
		} else {
			const validity = await this.filterObj.validate();
			return validity;
		}
	}

	/**
	 * Filter the dataset to exclude the result from the filter
	 */
	public async filter(dataset: object): Promise<object[]> {
		if (this.filterObj !== null) {
			const objFromFilter = await this.filterObj.filter(dataset);
			const datasetObj = JSON.parse(JSON.stringify(dataset)); // Should be a list of JSON objects, format following Section interface
			const filteredObjs = JSON.parse(JSON.stringify(objFromFilter)); // Should be a list of JSON objects, format following Section interface
			if (Array.isArray(datasetObj) && Array.isArray(filteredObjs)) {
				const filtered = datasetObj.filter((section) => !filteredObjs.includes(section));
				return filtered;
			} else {
				throw new InsightError("NEG - Filter() -- Either dataset or filtered results is not a list");
			}
		} else {
			throw new InsightError("NEG - Filter() -- How is filter null?");
		}
	}

	/**
	 * Get the filter object
	 */
	public async getFilter(): Promise<FilterObject> {
		if (this.filterObj === null) {
			throw new InsightError("NEG -- Filter cannot be null");
		} else {
			return this.filterObj;
		}
	}

	/**
	 * getIds
	 */
	public async getIds(): Promise<Set<string>> {
		let ids: Set<string> = new Set<string>();
		const filterObj = await this.getFilter();
		const filterObjIds = await filterObj.getIds();
		ids = new Set<string>([...ids, ...filterObjIds]);
		return ids;
	}

	/**
	 * Parse the filter of this Negation -- Copied from QueryObject.pareFilter()
	 * @param filterObject A JSON object that represents the filters
	 */
	private async parseFilter(filterObject: object): Promise<void> {
		try {
			await this.parseNegFilter(filterObject);
		} catch {
			throw new InsightError("NEG -- Filter is not valid JSON string");
		}
	}

	/**
	 * @param filterObject A JSON object that represents the filters
	 */
	private async parseNegFilter(filterObject: object): Promise<void> {
		const filterObj = JSON.parse(JSON.stringify(filterObject)); // Guarantees filterObj is a JSON object
		if (filterObj !== null && typeof filterObj === "object" && !Array.isArray(filterObj)) {
			/**
			 * filterObj has 2 possible situations
			 * 1. It has exactly one key -- following one of the filters, may be invalid
			 * 2. It does not have exactly one key -- invalid
			 */
			const filterKeys = Object.keys(filterObj);
			if (filterKeys.length > 1 || filterKeys.length <= 0) {
				throw new InsightError("NEG -- Invalid number of filter conditions");
			} else {
				/**
				 * Has exactly one filter
				 * 1. AND, OR -- LogicComparison
				 * 2. LT, GT, EQ -- MComparison
				 * 3. IS -- SComparison
				 * 4. NOT -- Negation
				 * 5. Other -- Invalid
				 */
				const filterKey = filterKeys[0];
				if (filterKey === "AND" || filterKey === "OR") {
					this.filterObj = new LogicObject();
					// Get the list of filters
					const filterList = filterObj[filterKey];
					await this.filterObj.parse(filterKey, filterList);
				} else if (filterKey === "LT" || filterKey === "GT" || filterKey === "EQ") {
					this.filterObj = new MCompObject();
					// Get the comparison object
					const mComp = filterObj[filterKey];
					await this.filterObj.parse(filterKey, mComp);
				} else if (filterKey === "IS") {
					this.filterObj = new SCompObject();
					// Get the comparison object
					const sComp = filterObj[filterKey];
					await this.filterObj.parse("", sComp);
				} else if (filterKey === "NOT") {
					this.filterObj = new NegationObject();
					// Get the filter to be negated
					const negFilter = filterObj[filterKey];
					await this.filterObj.parse("", negFilter);
				} else {
					throw new InsightError("NEG -- Not a valid filter condition");
				}
			}
		} else {
			throw new InsightError("NEG -- Filter is not parsed to a JSON object");
		}
	}
}
