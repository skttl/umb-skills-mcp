import catalog from "../.generated/catalog.json";
import { createWorker } from "./worker.js";
export default createWorker(catalog);
