import { Mastra } from "@mastra/core";
import { supervisorAgent } from "./agents/supervisor";

export const mastra = new Mastra({
  agents: {
    karya: supervisorAgent,
  },
});
