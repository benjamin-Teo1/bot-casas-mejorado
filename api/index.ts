import { app } from "../src/app.js";

// Vercel invoca esta aplicación ante cada solicitud HTTP.
// No usamos app.listen: Vercel administra el servidor y el puerto.
export default app;
