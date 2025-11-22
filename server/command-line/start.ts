import log from "../log";
import colors from "chalk";
import fs from "fs";
import path from "path";
import {Command} from "commander";
import Config from "../config";
import Utils from "./utils";

const program = new Command("start");
program
	.description("Start the server")
	.option("--dev", "Development mode with hot module reloading")
	.on("--help", Utils.extraHelp)
	.action(function (options) {
		initalizeConfig();

		const newLocal = "../server";
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const server = require(newLocal);
		server.default(options);
	});

function initalizeConfig() {
	// ZUBR-WEB: Stateless mode - minimal directory setup
	// No config file, no user files

	// Create home directory for logs/storage only
	fs.mkdirSync(Config.getHomePath(), {recursive: true});
	fs.chmodSync(Config.getHomePath(), "0700");

	// Note: users/ directory not needed in stateless mode
}

export default program;
