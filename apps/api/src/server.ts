import { buildApp } from "./app";
import { attachRealtime } from "./realtime";

const app = buildApp();
attachRealtime(app);
const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((e: unknown) => {
  app.log.error(e);
  process.exit(1);
});
