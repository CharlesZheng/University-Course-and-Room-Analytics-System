import FilterObject from "./FilterObject";
import { InsightError } from "../IInsightFacade";
import MCompObject from "./MCompObject";
import NegationObject from "./NegationObject";
import SCompObject from "./SCompObject";

/**
 * This class represents a LogicComparison for filter
 */
export enum Logic {
	AND,
	OR,
	Other,
}

export default class LogicObject extends FilterObject {
	/**
	 * fields
	 * @param logic Either "AND" or "OR"
	 * @param filterList A list of FilterObjects, must have at least one Object
	 */
	private logic: Logic;
	private filterList: FilterObject[];

	/**
	 * constructor
	 */
	constructor() {
		super("LOGIC");
		this.logic = Logic.Other; // Default to invalid logic
		this.filterList = []; // List of FilterObjects default to empty
	}

	/**
	 * Parse the list of filters
	 */
	public async parse(key: string, obj: object | null): Promise<void> {
		// Determine which logic is applied
		switch (key) {
			case "AND":
				this.logic = Logic.AND;
				break;
			case "OR":
				this.logic = Logic.OR;
				break;
			default:
				break;
		}

		if (obj !== null) {
			await this.parseFilterList(obj);
		} else {
			throw new InsightError("LOGIC -- Has filter list of null");
		}
	}

	/**
	 * Validate whether the LogicObject follows EBNF rules
	 */
	public async validate(): Promise<boolean> {
		// if the LogicComparison is valid, then all filters are valid
		await Promise.all(
			this.filterList.map(async (filter) => {
				const validity = await filter.validate();
				if (!validity) {
					return false;
				}
			})
		);
		/**
		 * suppose all filters are valid, other ways to invalidate are
		 * referecing more than 1 datasets
		 */
		let ids: Set<string> = new Set<string>();
		await Promise.all(
			this.filterList.map(async (filter) => {
				const filterIds = await filter.getIds();
				ids = new Set<string>([...ids, ...filterIds]);
			})
		);
		if (ids.size !== 1) {
			return false;
		}
		return true;
	}

	/**
	 * Filter the dataset following each filter, then union or intersect them
	 */
	public async filter(dataset: object): Promise<object[]> {
		// get all the object[] from each filter applied
		const allFilterSecs: object[][] = [];
		await Promise.all(
			this.filterList.map(async (filterObj) => {
				allFilterSecs.push(await filterObj.filter(dataset));
			})
		);
		let filtered: object[] = [];
		switch (this.logic) {
			case Logic.AND: // Find the intersection of all object[]
				filtered = await this.intersection(allFilterSecs);
				break;
			case Logic.OR: // Find the union of all object[]
				filtered = await this.union(allFilterSecs);
				break;
		}
		return filtered;
	}

	/**
	 * Get the list of filters
	 */
	public async getFilterList(): Promise<FilterObject[]> {
		return this.filterList;
	}

	/**
	 * getIds
	 */
	public async getIds(): Promise<Set<string>> {
		let ids: Set<string> = new Set<string>();
		const filterObjs = await this.getFilterList();
		await Promise.all(
			filterObjs.map(async (filterObj) => {
				const filterObjIds = await filterObj.getIds();
				ids = new Set<string>([...ids, ...filterObjIds]);
			})
		);
		return ids;
	}

	/**
	 * Parse filterObjs
	 */
	private async parseFilterList(filterObjects: object): Promise<void> {
		/**
		 * Parse the list of FilterObjects
		 * Should not have NoFilterObject
		 * Should have at least one Filter Object
		 */
		try {
			// obj should be first parsed into a JSON list
			const filterObjs = JSON.parse(JSON.stringify(filterObjects));
			if (Array.isArray(filterObjs)) {
				await Promise.all(
					filterObjs.map(async (filterObj) => {
						if (typeof filterObj !== "object") {
							throw new InsightError("LOGIC -- Some element in filter list is not JSON object");
						} else {
							await this.parseFilter(filterObj);
						}
					})
				);
			} else {
				throw new InsightError("LOGIC -- Filter list is not a list");
			}
		} catch {
			throw new InsightError("LOGIC -- Filter list is not valid JSON string");
		}
	}

	/**
	 * Parse each filter in the filterObjs -- Copied from QueryObject.pareFilter()
	 * @param filterObject A JSON object that represents the filters
	 */
	private async parseFilter(filterObject: object): Promise<void> {
		try {
			await this.parseEachFilter(filterObject);
		} catch {
			throw new InsightError("LOGIC -- Filter is not valid JSON string");
		}
	}

	/**
	 * @param filterObject A JSON object that represents the filters
	 */
	private async parseEachFilter(filterObject: object): Promise<void> {
		const filterObj = JSON.parse(JSON.stringify(filterObject));
		if (filterObj !== null && typeof filterObj === "object" && !Array.isArray(filterObj)) {
			/**
			 * filterObj has 2 possible situations
			 * 1. It has exactly one key -- following one of the filters, may be invalid
			 * 2. It does not have exactly one key -- invalid
			 */
			const filterKeys = Object.keys(filterObj);
			if (filterKeys.length > 1 || filterKeys.length <= 0) {
				throw new InsightError("LOGIC -- Invalid number of filter conditions");
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
				let currFilter: FilterObject;
				if (filterKey === "AND" || filterKey === "OR") {
					currFilter = new LogicObject();
					// Get the list of filters
					const filterList = filterObj[filterKey];
					await currFilter.parse(filterKey, filterList);
				} else if (filterKey === "LT" || filterKey === "GT" || filterKey === "EQ") {
					currFilter = new MCompObject();
					// Get the comparison object
					const mComp = filterObj[filterKey];
					await currFilter.parse(filterKey, mComp);
				} else if (filterKey === "IS") {
					currFilter = new SCompObject();
					// Get the comparison object
					const sComp = filterObj[filterKey];
					await currFilter.parse("", sComp);
				} else if (filterKey === "NOT") {
					currFilter = new NegationObject();
					// Get the filter to be negated
					const negFilter = filterObj[filterKey];
					await currFilter.parse("", negFilter);
				} else {
					throw new InsightError("LOGIC -- Not a valid filter condition");
				}
				this.filterList.push(currFilter);
			}
		} else {
			throw new InsightError("LOGIC -- Filter is not parsed to a JSON object");
		}
	}

	/**
	 * Find the union of object[], return an object[]
	 * @param filterSecs Sections as a JSON object in a JSON list, first treat it as object
	 */
	private async union(filterSecs: object[][]): Promise<object[]> {
		const sectionLists = JSON.parse(JSON.stringify(filterSecs)); // list of lists of Sections as JSON objects
		const unionSection = new Set<string>(); // A set of Section JSON objects in strings
		if (Array.isArray(sectionLists)) {
			await Promise.all(
				sectionLists.map(async (sectionList) => {
					const sectionLst = JSON.parse(JSON.stringify(sectionList));
					if (Array.isArray(sectionLst)) {
						await Promise.all(
							sectionLst.map(async (section) => {
								unionSection.add(JSON.stringify(section));
							})
						);
					} else {
						throw new InsightError("LOGIC - Union() -- List of List of sections is not parsed to a list");
					}
				})
			);
		} else {
			throw new InsightError("LOGIC - Union() -- List of List of sections is not parsed to a list");
		}
		const unionList = [...unionSection];
		const filtered: object[] = [];
		await Promise.all(
			unionList.map(async (sectionStr) => {
				filtered.push(await JSON.parse(sectionStr));
			})
		);
		return filtered;
	}

	/**
	 * Find the intersection of object[], return an object[]
	 * @param filterSecs Sections as a JSON object in a JSON list, first treat it as object
	 */
	private async intersection(filterSecs: object[][]): Promise<object[]> {
		const sectionLists = JSON.parse(JSON.stringify(filterSecs));
		if (Array.isArray(sectionLists)) {
			const fstList = sectionLists[0];
			const filtered: object[] = [];
			if (Array.isArray(fstList)) {
				await Promise.all(
					fstList.map(async (section) => {
						let contain: boolean = true;
						await Promise.all(
							sectionLists.map(async (sectionList) => {
								contain = contain && sectionList.includes(section);
							})
						);
						if (contain) {
							filtered.push(section);
						}
					})
				);
				return filtered;
			} else {
				throw new InsightError("LOGIC - Intersection() -- 1st List of sections is not parsed to a list");
			}
		} else {
			throw new InsightError("LOGIC - Intersection() -- List of List of sections is not parsed to a list");
		}
	}
}
