import * as fs from "fs-extra";
import * as parse5 from "parse5";
import { DefaultTreeAdapterMap } from "parse5";
import { InsightError } from "./IInsightFacade";

export default class HTMLParser {
	// Reads an HTML file and extracts a table's rows.
	public async extractTableRows(filePath: string): Promise<any[]> {
		try {
			const htmlContent = await fs.promises.readFile(filePath, "utf8");
			const document = parse5.parse(htmlContent);
			const table = this.findTable(document);

			if (!table) {
				return [];
			}

			return this.extractRows(table) || [];
		} catch (error) {
			throw new InsightError("Failed to parse HTML file: " + (error as Error).message);
		}
	}

	private findTable(node: DefaultTreeAdapterMap["document"] | DefaultTreeAdapterMap["parentNode"]): any | null {
		if (!node || !("childNodes" in node)) {
			return null;
		}

		for (const child of node.childNodes) {
			if (child.nodeName === "table") {
				return child;
			}

			if (this.isElementNode(child)) {
				const foundTable = this.findTable(child);
				if (foundTable) {
					return foundTable;
				}
			}
		}

		return null;
	}

	//  Checks if a given node is an ElementNode.
	private isElementNode(node: DefaultTreeAdapterMap["childNode"]): node is DefaultTreeAdapterMap["element"] {
		return (
			(node as DefaultTreeAdapterMap["element"]).tagName !== undefined &&
			(node as DefaultTreeAdapterMap["element"]).childNodes !== undefined
		);
	}

	//  Extracts rows (<tr>) from a table node.
	private extractRows(tableNode: DefaultTreeAdapterMap["parentNode"]): any[] {
		const rows: any[] = [];

		if (!("childNodes" in tableNode)) {
			return rows;
		}

		for (const child of tableNode.childNodes) {
			if (child.nodeName === "tbody") {
				for (const subChild of child.childNodes) {
					if (subChild.nodeName === "tr") {
						rows.push(this.extractRowData(subChild));
					}
				}
			} else if (child.nodeName === "tr") {
				rows.push(this.extractRowData(child));
			}
		}

		return rows;
	}

	//  Extracts structured data from a table row.
	private extractRowData(rowNode: DefaultTreeAdapterMap["parentNode"]): any {
		const rowData: any = {};

		if (!("childNodes" in rowNode)) {
			return rowData;
		}

		for (const cell of rowNode.childNodes) {
			if (cell.nodeName === "td" && "childNodes" in cell) {
				const text = this.getTextContent(cell);
				const className = this.getCellClass(cell);
				if (className) {
					rowData[className] = text;
				}
			}
		}

		return rowData;
	}

	//  Gets the class name of a table cell.
	private getCellClass(cellNode: DefaultTreeAdapterMap["element"]): string {
		if ("attrs" in cellNode) {
			const classAttr = cellNode.attrs.find((attr) => attr.name === "class");
			return classAttr ? classAttr.value : "unknown";
		}
		return "unknown";
	}

	private getTextContent(node: DefaultTreeAdapterMap["parentNode"]): string {
		if (!("childNodes" in node)) {
			return "";
		}

		let text = "";
		for (const child of node.childNodes) {
			if (child.nodeName === "#text" && "value" in child) {
				text += child.value.trim();
			} else if (child.nodeName === "a" && "childNodes" in child) {
				text += this.getTextContent(child);
			}
		}

		return text;
	}
}
