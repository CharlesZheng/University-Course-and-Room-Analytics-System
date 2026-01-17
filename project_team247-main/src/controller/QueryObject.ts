import * as fs from "fs-extra";
import { InsightError, InsightResult, ResultTooLargeError } from "./IInsightFacade";
import FilterObject from "./WhereObjects/FilterObject";
import NoFilterObject from "./WhereObjects/NoFilterObject";
import LogicObject from "./WhereObjects/LogicObject";
import MCompObject from "./WhereObjects/MCompObject";
import SCompObject from "./WhereObjects/SCompObject";
import NegationObject from "./WhereObjects/NegationObject";
import DisplayObject from "./OptionsObjects/DisplayObject";
import ColumnsObject from "./OptionsObjects/ColumnsObject";
import OrderObject from "./OptionsObjects/OrderObject";
import GroupObject from "./TransformationsObjects/GroupObject";
import ApplyObject from "./TransformationsObjects/ApplyObject";
import SortObject from "./SortObject";

/**
 * This class represents a Query Object by parsing a JSON file
 */

export default class QueryObject {
	/**
	 * fields
	 * @param where The filter to apply, can be empty
	 * @param options The style (what columns to display) and order of display for successful queries
	 * @param groupBy The keys to group by, represented using GroupObject
	 * @param apply The rules to apply on the group, and the results of calculations, using ApplyObject
	 * @param result The result of a successful query
	 * @param tooLargeThreshold Threshold of too many results
	 * @param expectedNumKeys The expected number of parts
	 */
	private where: FilterObject | null;
	private options: DisplayObject[];
	private groupBy: GroupObject | null;
	private apply: ApplyObject | null;
	private result: object[];
	private tooLargeThreshold: number = 5000;
	private expectedNumKeys: number = 3;
	private datasetID: string;

	/**
	 * constructor
	 */
	constructor() {
		this.where = null; // Filter Object default to null
		this.options = []; // Display Object default to empty list
		this.groupBy = null; // GroupObject default to null, meaning the transformation block does not exist
		this.apply = null; // ApplyObject default to null, also means the transformation DNE
		this.result = []; // Result should be empty
		this.datasetID = "";
	}

	/**
	 * methods
	 * Parse a JSON file into a query
	 * First, check whether queryObj is an object or not
	 * Second, check whether the query has the proper keys
	 * Third, parse each part individually
	 */
	public async parse(query: unknown): Promise<void> {
		try {
			const queryObj = JSON.parse(JSON.stringify(query));
			// Check whether queryObj is an object, throw error if not
			if (queryObj !== null && typeof queryObj === "object" && !Array.isArray(queryObj)) {
				await this.parseQuery(queryObj);
			} else {
				throw new InsightError("Query file is not a JSON object");
			}
		} catch {
			throw new InsightError(`Query is in invalid JSON format invalid error?`);
		}
	}

	/**
	 * Validate whether the parsed query is valid
	 * need access to saved datasets
	 */
	public async validate(): Promise<boolean> {
		// First, validate the WHERE
		if (this.where === null || !(await this.where.validate())) {
			// return false;
			throw new InsightError("QUERY - No where or invalid where");
		}
		// Next, if there is a transformation block, validate that first
		if (this.groupBy !== null && this.apply !== null) {
			return await this.crossValidate(this.groupBy, this.apply, this.options);
		} else {
			// the transformation block does not exist
			const displayValidity = await this.crossValidateDisplayNoTransformation();
			if (displayValidity) {
				const whereDatasetIds = await this.where.getIds();
				let displayDatasetIds: Set<string> = new Set<string>();
				await Promise.all(
					this.options.map(async (option) => {
						displayDatasetIds = new Set<string>([...displayDatasetIds, ...(await option.getIds())]);
					})
				);
				if (displayDatasetIds.size === 1) {
					if (whereDatasetIds.size === 1) {
						const [whereDatasetId] = whereDatasetIds.values();
						const [displayDatasetId] = displayDatasetIds.values();
						this.datasetID = displayDatasetId;
						return whereDatasetId === displayDatasetId;
					} else {
						const [displayDatasetId] = displayDatasetIds.values();
						this.datasetID = displayDatasetId;
						return true;
					}
				} else throw new InsightError("QUERY - OPTIONS reference more than one dataset");
			} else throw new InsightError("QUERY - OPTIONS is invalid");
		}
	}

	/**
	 * Given saved dataset, filter out the data that fulfill the WHERE of the QueryObject
	 * need access to saved datasets at path "data/content_" + datasetID + ".json"
	 */
	public async filter(): Promise<void> {
		// Find the filters
		// First, get the dataset we are filtering on
		// const datasetID = await this.options[0].getIDString();
		const dataset = await fs.readJSON("data/content_" + this.datasetID + ".json");
		if (this.where !== null) {
			this.result = await this.where.filter(dataset);
		} else {
			throw new InsightError("Filter() -- How is WHERE null?");
		}
		// Next, check if the result is too large
		if (this.result.length > this.tooLargeThreshold)
			throw new ResultTooLargeError("Too many query results (> 5000 entries)");
	}

	/**
	 * Display the results following the OPTION of the QueryObject
	 */
	public async display(): Promise<InsightResult[]> {
		// We have the filter result now
		// We provide a SortObject with OPTIONS, and TRANSFORMATIONS, and let it figure out the result.
		const sortObj = new SortObject(this.datasetID, this.result, this.options, this.groupBy, this.apply);
		return await sortObj.displayResult();
	}

	/**
	 * Parse a valid query object
	 * @param queryObject
	 */
	private async parseQuery(queryObject: object): Promise<void> {
		/**
		 * queryObj is now a JSON object
		 * It should have a "WHERE" key and an "OPTIONS" key, and only those keys
		 */
		const queryObj = JSON.parse(JSON.stringify(queryObject));
		const queryKeys = Object.keys(queryObj);
		// First, always parse WHERE and OPTIONS, they always exist
		if (queryKeys.includes("WHERE") && queryKeys.includes("OPTIONS")) {
			// possible to parse and validate further
			const filterObj = queryObj.WHERE; // The JSON object after "WHERE"
			const displayObj = queryObj.OPTIONS; // The JSON object after "OPTIONS"
			await this.parseFilter(filterObj);
			await this.parseDisplay(displayObj);
		} else {
			throw new InsightError("Query doesn't have WHERE or OPTIONS");
		}
		// Then, check if the file has transformations, and only has three keys
		if (queryKeys.includes("TRANSFORMATIONS") && queryKeys.length === this.expectedNumKeys) {
			// possible to parse and validate the TRANSFORMATIONS block
			const transformObj = queryObj.TRANSFORMATIONS; // The JSON object after "TRANSFORMATIONS"
			const transformObjKeys = Object.keys(transformObj);
			if (transformObjKeys.includes("GROUP") && transformObjKeys.includes("APPLY") && transformObjKeys.length === 2) {
				const groupObj = transformObj.GROUP; // The JSON list of keys to group by
				const applyObj = transformObj.APPLY; // The JSON list of rules to apply
				await this.parseGroup(groupObj);
				await this.parseApply(applyObj);
			} else {
				throw new InsightError("Query doesn't have GROUP or APPLY, or has other irrelevant keys");
			}
		}
	}

	/**
	 * Parse the WHERE part of the query
	 * @param filterObject A JSON object that represents the filters
	 */
	private async parseFilter(filterObject: object): Promise<void> {
		const filterObj = JSON.parse(JSON.stringify(filterObject)); // Guarantees filterObj is a JSON object
		if (filterObj !== null && typeof filterObj === "object" && !Array.isArray(filterObj)) {
			/**
			 * filterObj has 3 possible situations
			 * 1. It has no keys -- no filter applied
			 * 2. It has one key -- following one of the filters, may be invalid
			 * 3. It has more than one key -- invalid
			 */
			const filterKeys = Object.keys(filterObj);
			if (filterKeys.length > 1 || filterKeys.length < 0) {
				throw new InsightError("Invalid number of filter conditions");
			} else if (filterKeys.length === 0) {
				// No filter
				this.where = new NoFilterObject();
				await this.where.parse("", null);
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
					this.where = new LogicObject();
					// Get the list of filters
					const filterList: object = filterObj[filterKey];
					await this.where.parse(filterKey, filterList);
				} else if (filterKey === "LT" || filterKey === "GT" || filterKey === "EQ") {
					this.where = new MCompObject();
					// Get the comparison object
					const mComp: object = filterObj[filterKey];
					await this.where.parse(filterKey, mComp);
				} else if (filterKey === "IS") {
					this.where = new SCompObject();
					// Get the comparison object
					const sComp: object = filterObj[filterKey];
					await this.where.parse("", sComp);
				} else if (filterKey === "NOT") {
					this.where = new NegationObject();
					// Get the filter to be negated
					const filter: object = filterObj[filterKey];
					await this.where.parse("", filter);
				} else {
					throw new InsightError("Not a valid filter condition");
				}
			}
		} else {
			throw new InsightError("WHERE is not parsed to a JSON object");
		}
	}

	/**
	 * Parse the OPTIONS part of a query
	 * @param displayObject A JSON object that represents the columns to display (and the order of display)
	 */
	private async parseDisplay(displayObject: object): Promise<void> {
		const displayObj = JSON.parse(JSON.stringify(displayObject));
		if (displayObj !== null && typeof displayObj === "object" && !Array.isArray(displayObj)) {
			/**
			 * displayObj has 2 valid situations
			 * 1. It has only "COLUMNS" key
			 * 2. It has both "COLUMNS" key and "ORDER" key in this order
			 * It will always have "COLUMNS" key
			 */
			const displayKeys = Object.keys(displayObj);
			if (displayKeys.length > 2 || displayKeys.length <= 0) {
				throw new InsightError("Invalid OPTIONS format");
			} else if (displayKeys.length === 1) {
				// check if the key is "COLUMNS"
				if (displayKeys.includes("COLUMNS")) {
					const columnsObj = new ColumnsObject();
					const columns = displayObj.OPTIONS;
					await columnsObj.parse(columns);
					this.options.push(columns);
				} else {
					throw new InsightError("OPTIONS does not have COLUMNS key");
				}
			} else {
				// check if the keys are "COLUMNS" and "ORDER" in order
				if (displayKeys[0] === "COLUMNS" && displayKeys[1] === "ORDER") {
					const columnsObj = new ColumnsObject();
					const orderObj = new OrderObject();

					const columns = displayObj.COLUMNS;
					const key = displayObj.ORDER;

					await columnsObj.parse(columns);
					await orderObj.parse(key);

					this.options.push(columnsObj);
					this.options.push(orderObj);
				} else {
					throw new InsightError("OPTIONS does not have right keys or order");
				}
			}
		} else {
			throw new InsightError("OPTIONS is not parsed to a JSON object");
		}
		return;
	}

	/**
	 * parse the group-by block
	 * @param groupObject A JSON object (array) that represents the keys to group by
	 */
	private async parseGroup(groupObject: object): Promise<void> {
		const groupObj = JSON.parse(JSON.stringify(groupObject));
		if (Array.isArray(groupObj)) {
			this.groupBy = new GroupObject();
			await this.groupBy.parse(groupObj);
		} else {
			throw new InsightError("TRANSFORMATIONS - GROUP -- Not a list");
		}
		return;
	}

	/**
	 * parse the APPLY block
	 * @param applyObject A JSON object (array) that represents the rules to apply on groups
	 */
	private async parseApply(applyObject: object): Promise<void> {
		const applyObj = JSON.parse(JSON.stringify(applyObject));
		if (Array.isArray(applyObj)) {
			this.apply = new ApplyObject();
			await this.apply.parse(applyObj);
		} else {
			throw new InsightError("TRANSFORMATIONS - APPLY -- Not a list");
		}
		return;
	}

	/**
	 * cross validate COLUMNS and ORDER when there is no transformation block
	 */
	private async crossValidateDisplayNoTransformation(): Promise<boolean> {
		/**
		 * Where there is no transformation block
		 * neither columns nor order should have applykeys
		 */
		// Check if there is a SORT
		if (this.options.length === 1) {
			const columns = this.options[0];
			if (columns instanceof ColumnsObject) {
				// no applykeys
				return (await columns.validate()) && (await columns.getApplyKeys()).length === 0;
			} else {
				throw new InsightError("OPTIONS - Not a column");
			}
		} else if (this.options.length === 2) {
			return await this.crossValidateDisplayBoth();
		} else {
			throw new InsightError("OPTIONS - have more than 2 keys");
		}
	}

	private async crossValidateDisplayBoth(): Promise<boolean> {
		let columnsKeys: string[] = [];
		let orderKey: string = "";
		let orderKeys: string[] = [];
		let datasetIds: Set<string> = new Set<string>();
		let applykeys: string[] = [];
		await Promise.all(
			this.options.map(async (option) => {
				if (option instanceof ColumnsObject) {
					columnsKeys = [...columnsKeys, ...(await option.getAllKeys())];
					datasetIds = new Set<string>([...datasetIds, ...(await option.getIds())]);
					applykeys = [...applykeys, ...(await option.getApplyKeys())];
				}
				if (option instanceof OrderObject) {
					orderKey = await option.getOneKey();
					orderKeys = await option.getAllKeys();
					datasetIds = new Set<string>([...datasetIds, ...(await option.getIds())]);
					applykeys = [...applykeys, ...(await option.getApplyKeys())];
				}
			})
		);
		if (datasetIds.size !== 1 || applykeys.length !== 0) {
			throw new InsightError("OPTIONS - reference more than one dataset, or has applykeys when no transformation");
		} else {
			if (orderKey !== "" && orderKeys.length === 0) {
				return columnsKeys.includes(orderKey);
			} else if (orderKey === "" && orderKeys.length !== 0) {
				for (const oneOrderKey of orderKeys) {
					if (!columnsKeys.includes(oneOrderKey)) throw new InsightError("OPTIONS - Order key not included in Columns");
				}
				return true;
			} else return false;
		}
	}

	/**
	 * Cross validate with transformations
	 * @param group
	 * @param apply
	 * @param options
	 */
	private async crossValidate(group: GroupObject, apply: ApplyObject, options: DisplayObject[]): Promise<boolean> {
		if ((await group.validate()) && (await apply.validate())) {
			const groupKeys = await group.getAllKeys();
			const applyKeys: Set<string> = new Set<string>();
			if (options.length === 1 && options[0] instanceof ColumnsObject) {
				const columns = options[0];
				const columnsKeys = await columns.getAllKeys();
				await Promise.all(
					columnsKeys.map(async (columnKey) => {
						if (!groupKeys.includes(columnKey) && !applyKeys.has(columnKey)) {
							return false;
						}
					})
				);
				this.datasetID = await group.getID();
			} else if (options.length === 2) {
				await Promise.all(
					options.map(async (option) => {
						if (option instanceof ColumnsObject) {
							const columnsKeys = await option.getAllKeys();
							await Promise.all(
								columnsKeys.map(async (columnKey) => {
									if (!groupKeys.includes(columnKey) && !applyKeys.has(columnKey)) return false;
								})
							);
						}
					})
				);
				this.datasetID = await group.getID();
			}
			return true;
		}
		return false;
	}
}
