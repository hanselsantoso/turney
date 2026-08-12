import { buildApp } from "./app";

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((e: unknown) => {
  app.log.error(e);
  process.exit(1);
});
