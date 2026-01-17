/**
 * This class represents the displays in OPTIONS of a query
 */

export default abstract class DisplayObject {
	/**
	 * fields
	 * @param type Represents columns or order
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
	public abstract parse(obj: object): Promise<void>;

	/**
	 * Validate whether DisplayObject adheres to EBNF Logic
	 */
	public abstract validate(): Promise<boolean>;

	/**
	 * Get the idstring
	 */
	public abstract getIDString(): Promise<string>;

	/**
	 * Get the set of ids
	 */
	public abstract getIds(): Promise<Set<string>>;
}
