import express from "express";
import cors from "cors";
// import authRoutes from "./routes/auth.routes.js";
import { initDb, closeDb } from "./db/index.js";
import { startCronJobs } from "./lib/cron.js";
import compression from "compression";
import aiRoutes from "./routes/ai.routes.js";

const app = express();
app.use(compression());
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);

export const JWT_SECRET =
  process.env.JWT_SECRET || "super-secret-key-2026-km-am";
export const JWT_EXPIRES_IN = "5h";

app.use(cors());

app.use(express.json());

// app.use("/api/v1/auth", authRoutes);
app.use("/api/ai", aiRoutes);
initDb()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });

    startCronJobs();

    const shutdown = async () => {
      server.close(() => console.log("HTTP Сервер махкам шуд"));
      await closeDb();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
  });
