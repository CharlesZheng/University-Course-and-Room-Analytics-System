import express, { Application, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Log } from "@ubccpsc310/project-support";
import * as http from "http";
import cors from "cors";
import InsightFacade from "../controller/InsightFacade";
import { InsightDatasetKind, InsightError, NotFoundError } from "../controller/IInsightFacade";
import path from "path";
import fs from "fs-extra";

export default class Server {
	private readonly port: number;
	private express: Application;
	private server: http.Server | undefined;
	public static InsightFacade: InsightFacade;

	constructor(port: number) {
		Log.info(`Server::<init>( ${port} )`);
		this.port = port;
		this.express = express();
		Server.InsightFacade = new InsightFacade();

		this.registerMiddleware();
		this.registerRoutes();

		// NOTE: you can serve static frontend files in from your express server
		// by uncommenting the line below. This makes files in ./frontend/public
		// accessible at http://localhost:<port>/
		// this.express.use(express.static("./frontend/public"))
	}

	/**
	 * Starts the server. Returns a promise that resolves if success. Promises are used
	 * here because starting the server takes some time and we want to know when it
	 * is done (and if it worked).
	 *
	 * @returns {Promise<void>}
	 */
	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			Log.info("Server::start() - start");
			if (this.server !== undefined) {
				Log.error("Server::start() - server already listening");
				reject();
			} else {
				this.server = this.express
					.listen(this.port, () => {
						Log.info(`Server::start() - server listening on port: ${this.port}`);
						resolve();
					})
					.on("error", (err: Error) => {
						// catches errors in server start
						Log.error(`Server::start() - server ERROR: ${err.message}`);
						reject(err);
					});
			}
		});
	}

	/**
	 * Stops the server. Again returns a promise so we know when the connections have
	 * actually been fully closed and the port has been released.
	 *
	 * @returns {Promise<void>}
	 */
	public async stop(): Promise<void> {
		Log.info("Server::stop()");
		return new Promise((resolve, reject) => {
			if (this.server === undefined) {
				Log.error("Server::stop() - ERROR: server not started");
				reject();
			} else {
				this.server.close(() => {
					Log.info("Server::stop() - server closed");
					resolve();
				});
			}
		});
	}

	// Registers middleware to parse request before passing them to request handlers
	private registerMiddleware(): void {
		// JSON parser must be place before raw parser because of wildcard matching done by raw parser below
		this.express.use(express.json());
		this.express.use(express.raw({ type: "application/*", limit: "10mb" }));

		// enable cors in request headers to allow cross-origin HTTP requests
		this.express.use(cors());
		this.express.use(express.static(path.join(__dirname, "../../frontend/public")));
	}

	// Registers all request handlers to routes
	private registerRoutes(): void {
		// This is an example endpoint this you can invoke by accessing this URL in your browser:
		// http://localhost:4321/echo/hello
		this.express.get("/echo/:msg", Server.echo);

		// TODO: your other endpoints should go here
		this.express.put("/dataset/:id/:kind", Server.addDataset);
		this.express.delete("/dataset/:id", Server.removeDataset);
		this.express.get("/datasets", Server.listDatasets);
		this.express.get("/dataset/:id", Server.getDataset);
		this.express.post("/query", Server.performQuery);
	}

	private static async addDataset(req: Request, res: Response): Promise<void> {
		try {
			const { id, kind } = req.params;
			const base64Data = req.body.toString("base64");

			let kindEnum: InsightDatasetKind;
			if (kind === "rooms") {
				kindEnum = InsightDatasetKind.Rooms;
			} else if (kind === "sections") {
				kindEnum = InsightDatasetKind.Sections;
			} else {
				throw new InsightError("Invalid dataset kind");
			}

			// Use the static InsightFacade instance
			const result = await Server.InsightFacade.addDataset(id, base64Data, kindEnum);

			res.status(StatusCodes.OK).json({ result });
		} catch (error) {
			const errMessage = error instanceof Error ? error.message : "Unknown error occurred";
			Log.error(`Server::addDataset(..) - ERROR: ${errMessage}`);
			res.status(StatusCodes.BAD_REQUEST).json({ error: errMessage });
		}
	}

	private static async removeDataset(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;

			// Call InsightFacade's removeDataset method
			const result = await Server.InsightFacade.removeDataset(id);

			// Send a 200 response with the removed dataset ID
			res.status(StatusCodes.OK).json({ result });
		} catch (error) {
			// Check for different error types
			if (error instanceof NotFoundError) {
				res.status(StatusCodes.NOT_FOUND).json({ error: error.message });
			} else if (error instanceof InsightError) {
				res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
			} else {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Unknown error occurred" });
			}

			Log.error(`Server::removeDataset(..) - ERROR: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private static async listDatasets(req: Request, res: Response): Promise<void> {
		try {
			// Call InsightFacade's listDatasets method
			const result = await Server.InsightFacade.listDatasets();

			// Send a 200 response with the list of datasets
			res.status(StatusCodes.OK).json({ result });
		} catch (error) {
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Unknown error occurred" });

			Log.error(`Server::listDatasets(..) - ERROR: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private static async getDataset(req: Request, res: Response): Promise<void> {
		try {
			const id = req.params.id;
			const content = await fs.readFile(`data/content_${id}.json`, "utf-8");
			const data = JSON.parse(content);
			res.status(StatusCodes.OK).json({ result: data });
		} catch (error) {
			Log.error(`Server::listDatasets(..) - ERROR: ${error instanceof Error ? error.message : "Dataset not found"}`);
		}
	}

	/**
	 * Perform query
	 * @param req HTTP request to add a dataset GET: "/query"
	 * @param res Response from the backend
	 */
	private static async performQuery(req: Request, res: Response): Promise<void> {
		try {
			const queryFile = req.body;
			const queryResult = await Server.InsightFacade.performQuery(queryFile);
			res.status(StatusCodes.OK).json({ result: queryResult });
		} catch (err: any) {
			res.status(StatusCodes.BAD_REQUEST).json({ error: err.message });
		}
		return;
	}

	// The next two methods handle the echo service.
	// These are almost certainly not the best place to put these, but are here for your reference.
	// By updating the Server.echo function pointer above, these methods can be easily moved.
	private static echo(req: Request, res: Response): void {
		try {
			Log.info(`Server::echo(..) - params: ${JSON.stringify(req.params)}`);
			const response = Server.performEcho(req.params.msg);
			res.status(StatusCodes.OK).json({ result: response });
		} catch (err) {
			res.status(StatusCodes.BAD_REQUEST).json({ error: err });
		}
	}

	private static performEcho(msg: string): string {
		if (typeof msg !== "undefined" && msg !== null) {
			return `${msg}...${msg}`;
		} else {
			return "Message not provided";
		}
	}
}
