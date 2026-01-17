/**
 * This class represents the filters in WHERE of a query
 */

export default abstract class FilterObject {
	/**
	 * fields
	 * @param type Represents the type of filter
	 */
	private type: string;

	/**
	 * constructor
	 */
	constructor(typ: string) {
		this.type = typ;
	}

	/**
	 * Parse the given information into proper objects
	 */
	public abstract parse(key: string, obj: object | null): Promise<void>;

	/**
	 * Validate whether FilterObject adheres to EBNF Logic
	 */
	public abstract validate(): Promise<boolean>;

	/**
	 * Filter the dataset
	 * @param dataset A dataset represented in a JSON list, where each element follows interface Section
	 */
	public abstract filter(dataset: object): Promise<object[]>;

	/**
	 * Get the type of this object
	 */
	public async getType(): Promise<string> {
		return this.type;
	}

	/**
	 * Get the mkey or skey's idstring in the tree-like structure of a query
	 */
	public abstract getIds(): Promise<Set<string>>;
}
