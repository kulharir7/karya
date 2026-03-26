import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

export const memory = new Memory({
  storage: new LibSQLStore({
    id: "karya-memory",
    url: "file:karya-memory.db",
  }),
  options: {
    lastMessages: 20,
    semanticRecall: false,
  },
});
