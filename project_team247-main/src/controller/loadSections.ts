import JSZip from "jszip";
import { Section } from "./Interface/SectionInterface";
import { InsightError } from "./IInsightFacade";

export default class SectionProcessor {
	// Extracts and parses sections from a ZIP file
	public async extractSections(content: string): Promise<Section[]> {
		const extractedFiles: string[] = await this.processZipFile(content);
		return this.parseSectionFiles(extractedFiles);
	}

	// Unzips and extracts text files from a Base64 encoded ZIP
	private async processZipFile(encodedZip: string): Promise<string[]> {
		const zip = new JSZip();
		const fileContents: Promise<string>[] = [];

		try {
			await zip.loadAsync(encodedZip, { base64: true });
		} catch (error) {
			const message = (error as Error).message;
			return Promise.reject(new InsightError("Invalid ZIP file format" + message));
		}

		if (!this.validateZipStructure(zip)) {
			return Promise.reject(new InsightError("Missing 'courses/' folder"));
		}

		// Extract text content from each file
		zip.forEach((path, file) => {
			fileContents.push(file.async("text"));
		});

		return Promise.all(fileContents);
	}

	// Ensures the ZIP file contains the required "courses/" folder
	private validateZipStructure(zip: JSZip): boolean {
		return Object.keys(zip.files).some((filename) => filename.startsWith("courses/"));
	}

	// Parses extracted text files into an array of Section objects
	private parseSectionFiles(files: string[]): Section[] {
		const sectionList: Section[] = [];

		for (const fileContent of files) {
			if (!fileContent.startsWith('{"result":[')) {
				continue; // Skip invalid files
			}

			const extractedSections = JSON.parse(fileContent).result;

			for (const sectionData of extractedSections) {
				const section: Section = this.createSectionObject(sectionData);
				if (this.isValidSection(section)) {
					sectionList.push(section);
				}
			}
		}

		if (sectionList.length === 0) {
			throw new InsightError("No valid sections found");
		}

		return sectionList;
	}

	// Constructs a Section object from raw JSON data
	private createSectionObject(data: any): Section {
		return {
			dept: data.Subject,
			id: data.Course,
			avg: data.Avg,
			instructor: data.Professor,
			title: data.Title,
			pass: data.Pass,
			fail: data.Fail,
			audit: data.Audit,
			uuid: data.id.toString(),
			year: data.Year,
		};
	}

	// Checks if a section contains all required properties
	private isValidSection(section: Section): boolean {
		return Object.values(section).every((value) => value !== undefined);
	}
}
