import { Mastra } from "@mastra/core";
import { plannerAgent } from "./agents/planner";
import { browserAgent } from "./agents/browser";
import { fileAgent } from "./agents/file";

export const mastra = new Mastra({
  agents: {
    karya: plannerAgent,
    browser: browserAgent,
    file: fileAgent,
  },
});
