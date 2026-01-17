import { InsightError } from "./IInsightFacade";
import { Room } from "./Interface/RoomInterface";
import { Building } from "./Interface/BuildingInterface";
import BuildingProcessor from "./BuildingProcessor";
import RoomProcessor from "./RoomProcessor";

export default class CampusDataProcessor {
	private buildingProcessor: BuildingProcessor;
	private roomProcessor: RoomProcessor;

	constructor() {
		this.buildingProcessor = new BuildingProcessor();
		this.roomProcessor = new RoomProcessor();
	}

	//Extracts all buildings and rooms from the dataset. Return a list of Room objects across all buildings
	public async extractBuildingsAndRooms(): Promise<Room[]> {
		const buildings = await this.extractBuildings();
		if (buildings.length === 0) {
			throw new InsightError("No valid buildings found.");
		}

		return this.extractRooms(buildings);
	}

	//  Extracts building data from `index.htm` and fetches geolocation.
	private async extractBuildings(): Promise<Building[]> {
		return await this.buildingProcessor.extractBuildings();
	}

	//  Extracts room information for all buildings.
	private async extractRooms(buildings: Building[]): Promise<Room[]> {
		const roomPromises = buildings.map(async (building) => this.roomProcessor.extractRooms(building));
		const roomsArray = await Promise.all(roomPromises);

		const allRooms: Room[] = roomsArray.flat();

		if (allRooms.length === 0) {
			throw new InsightError("No rooms found in any building.");
		}

		return allRooms;
	}
}
