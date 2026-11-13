import { MOCK } from "./config";
import { http, setToken } from "./http";
import { mock } from "./mock";
import type { Backend } from "./types";

export const api: Backend = MOCK ? mock : http;
export { setToken };
