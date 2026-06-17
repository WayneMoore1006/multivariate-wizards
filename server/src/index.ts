// ============================================================================
// server/src/index.ts
// Express HTTP API + Socket.IO realtime server.
//   npm run dev:server   (or part of `npm run dev`)
// ============================================================================
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/types";
import { loadBank, getBank } from "./questionService";
import { registerSocketHandlers } from "./socket";

import path from "path";
import { fileURLToPath } from "url";

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());
app.use(express.json());

loadBank();

app.get("/api/health", (_req, res) => res.json({ ok: true, questions: getBank().length }));

// Full bank (used by 1vBot and the stats page). Online play never trusts this.
app.get("/api/questions", (_req, res) => res.json(getBank()));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDistPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
});
registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`\n🧙 Multivariate Wizards server on http://localhost:${PORT}`);
  console.log(`   GET /api/health   GET /api/questions   (Socket.IO ready)\n`);
});
