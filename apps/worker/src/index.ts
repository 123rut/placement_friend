import { runPipeline } from "./pipeline";

const result = runPipeline();

console.log("Placement worker pipeline");
console.log(JSON.stringify(result, null, 2));
