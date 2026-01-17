import { Room } from "./Interface/RoomInterface";
import { Building } from "./Interface/BuildingInterface";
import HTMLParser from "./HTMLParser";

export default class RoomProcessor {
	private htmlParser: HTMLParser;

	constructor() {
		this.htmlParser = new HTMLParser();
	}

	//  Extracts all rooms from a given building's room file.
	public async extractRooms(building: Building): Promise<Room[]> {
		const filePath = this.getRoomFilePath(building.link);
		const tableRows = await this.htmlParser.extractTableRows(filePath);

		if (!tableRows) {
			return [];
		}

		return this.processRoomData(tableRows, building);
	}

	//  Converts a building's relative link into an absolute file path.
	private getRoomFilePath(link: string): string {
		return link.replace(".", "data/campus");
	}

	// Processes extracted table rows to generate Room objects.
	private processRoomData(tableRows: any[], building: Building): Room[] {
		const rooms: Room[] = [];

		for (const row of tableRows) {
			const room = this.extractRoomAttributes(row, building);
			if (room) {
				rooms.push(room);
			}
		}

		return rooms;
	}

	//  * Extracts attributes of a room from a given row.
	private extractRoomAttributes(row: any, building: Building): Room | null {
		const roomNumber = row["views-field-field-room-number"];
		const roomFurniture = row["views-field-field-room-furniture"];
		const roomType = row["views-field-field-room-type"];
		const roomCapacity = row["views-field-field-room-capacity"];
		const roomHref = row["views-field-nothing"];

		if (!roomNumber || !roomFurniture || !roomType || !roomCapacity || !roomHref) {
			return null;
		}

		return {
			fullname: building.fullname,
			shortname: building.shortname,
			number: roomNumber,
			name: `${building.shortname}_${roomNumber}`,
			address: building.address,
			lat: building.lat,
			lon: building.lon,
			seats: parseInt(roomCapacity, 10),
			furniture: roomFurniture,
			type: roomType,
			href: roomHref,
		};
	}
}
