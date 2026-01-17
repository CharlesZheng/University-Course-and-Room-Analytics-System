/**
 * This class represent a grouped result
 */

export default class Group {
	/**
	 * fields
	 * @param groupID same ID same group
	 * @param elements
	 */
	private groupID: string;
	private elements: object[] = [];
	private commonFields: string[] = [];
	private appliedRules: Record<string, number> = {};

	/**
	 * constructor
	 */
	constructor(id: string, common: string[]) {
		this.groupID = id;
		this.commonFields = common;
	}

	/**
	 * get the id
	 */
	public async getID(): Promise<string> {
		return this.groupID;
	}

	/**
	 * add an element
	 */
	public async addElem(obj: object): Promise<void> {
		this.elements.push(obj);
	}

	/**
	 * add an applied rule
	 */
	public async addRule(key: string, val: number): Promise<void> {}

	/**
	 * get all elements
	 */
	public async getElem(): Promise<object[]> {
		return this.elements;
	}

	/**
	 * get common fields
	 */
	public async getFields(): Promise<string[]> {
		return this.commonFields;
	}

	/**
	 * get applied rules
	 */
	public async getRules(): Promise<Record<string, number>> {
		return this.appliedRules;
	}
}
