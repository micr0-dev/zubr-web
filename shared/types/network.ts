import {SharedChan} from "./chan";

export type SharedPrefixObject = {
	symbol: string;
	mode: string;
};

export type SharedNetworkChan = SharedChan & {
	totalMessages: number;
};

export type SharedPrefix = {
	prefix: SharedPrefixObject[];
	modeToSymbol: {[mode: string]: string};
	symbols: string[];
};

export type SharedServerOptions = {
	CHANTYPES: string[];
	PREFIX: SharedPrefix;
	NETWORK: string;
};

export type SharedNetworkStatus = {
	connected: boolean;
	secure: boolean;
	serverType?: "zubr" | "irc"; // ZUBR-WEB: Server type detection
	zubrRole?: "owner" | "admin" | "user"; // ZUBR-WEB: User's role on Zubr server
	instanceName?: string; // ZUBR-WEB: Instance name
	instanceVersion?: string; // ZUBR-WEB: Instance version
	instanceSignupMode?: string; // ZUBR-WEB: Signup mode
	instanceSourceCode?: string; // ZUBR-WEB: Source code URL
};

export type SharedNetwork = {
	uuid: string;
	name: string;
	nick: string;
	host: string; // ZUBR-WEB: Host for home server detection
	serverOptions: SharedServerOptions;
	status: SharedNetworkStatus;
	channels: SharedNetworkChan[];
	serverType?: "zubr" | "irc"; // ZUBR-WEB: Server type detection
};
