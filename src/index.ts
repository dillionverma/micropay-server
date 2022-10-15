import { config } from "./config";
import { init } from "./server";

// Entry point of the application
export const server = init(config);
