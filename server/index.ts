import "dotenv/config";
import cors from "cors";
import express from "express";
import { indexMovies, type Movie } from "./plex.js";
import {
  authUrlForPin,
  checkPin,
  createPin,
  getAccount,
  getServers,
  resolveConnection,
  type PlexResource,
} from "./plexTv.js";
import { getSession, updateSession } from "./session.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

let cachedMovies: Movie[] = [];
let cachedServers: PlexResource[] = [];
let indexing = false;

async function indexMoviesTracked() {
  indexing = true;
  try {
    cachedMovies = await indexMovies();
  } finally {
    indexing = false;
  }
}

function publicStatus() {
  const session = getSession();
  return {
    authenticated: Boolean(session.authToken),
    account: session.account,
    servers: cachedServers.map((server) => ({
      name: server.name,
      clientIdentifier: server.clientIdentifier,
    })),
    connectedServer: session.server
      ? {
          name: session.server.name,
          clientIdentifier: session.server.clientIdentifier,
        }
      : null,
    movieCount: cachedMovies.length,
    indexing,
  };
}

app.get("/api/auth/status", async (_req, res) => {
  const session = getSession();
  if (session.authToken && (cachedServers.length === 0 || !session.account?.thumb)) {
    try {
      const [account, servers] = await Promise.all([getAccount(session.authToken), getServers(session.authToken)]);
      updateSession({ account });
      cachedServers = servers;
    } catch {
      // plex.tv unreachable right now; the client can retry
    }
  }
  res.json(publicStatus());
});

app.post("/api/auth/pin", async (_req, res) => {
  try {
    const pin = await createPin();
    res.json({ id: pin.id, code: pin.code, authUrl: authUrlForPin(pin) });
  } catch (error) {
    res
      .status(502)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Plex sign-in.",
      });
  }
});

app.get("/api/auth/pin/:id", async (req, res) => {
  try {
    const pin = await checkPin(Number(req.params.id));
    if (!pin.authToken) return res.json({ authenticated: false });
    const account = await getAccount(pin.authToken);
    updateSession({ authToken: pin.authToken, account });
    cachedServers = await getServers(pin.authToken);
    res.json(publicStatus());
  } catch (error) {
    res
      .status(502)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm sign-in yet.",
      });
  }
});

app.post("/api/auth/server", async (req, res) => {
  const session = getSession();
  if (!session.authToken)
    return res.status(401).json({ error: "Sign in with Plex first." });
  const clientIdentifier = String(req.body.clientIdentifier ?? "");
  const resource = cachedServers.find(
    (server) => server.clientIdentifier === clientIdentifier,
  );
  if (!resource)
    return res
      .status(404)
      .json({
        error: "Unknown server. Refresh the server list and try again.",
      });
  try {
    const uri = await resolveConnection(resource);
    updateSession({
      server: {
        name: resource.name,
        clientIdentifier: resource.clientIdentifier,
        uri,
        accessToken: resource.accessToken,
      },
    });
    await indexMoviesTracked();
    res.json(publicStatus());
  } catch (error) {
    res
      .status(502)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to reach that Plex server.",
      });
  }
});

app.post("/api/manual-connect", async (req, res) => {
  const uri = String(req.body.url ?? "")
    .trim()
    .replace(/\/$/, "");
  const accessToken = String(req.body.token ?? "").trim();
  if (!uri || !accessToken)
    return res
      .status(400)
      .json({ error: "Server URL and token are required." });
  const previous = getSession().server;
  updateSession({
    server: {
      name: "Manual server",
      clientIdentifier: "manual",
      uri,
      accessToken,
    },
  });
  try {
    await indexMoviesTracked();
    res.json(publicStatus());
  } catch (error) {
    updateSession({ server: previous });
    res
      .status(502)
      .json({
        error:
          error instanceof Error ? error.message : "Unable to connect to Plex.",
      });
  }
});

app.post("/api/refresh-library", async (_req, res) => {
  try {
    await indexMoviesTracked();
    res.json(publicStatus());
  } catch (error) {
    res
      .status(502)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to refresh the library.",
      });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  updateSession({ authToken: null, account: null, server: null });
  cachedServers = [];
  cachedMovies = [];
  res.json(publicStatus());
});

app.get("/api/movies", (_req, res) => res.json(cachedMovies));

app.listen(port, () =>
  console.log(`Plex Picker API listening on http://localhost:${port}`),
);

async function bootstrap() {
  const session = getSession();
  if (session.server) indexing = true;
  if (session.authToken) {
    try {
      const [account, servers] = await Promise.all([getAccount(session.authToken), getServers(session.authToken)]);
      updateSession({ account });
      cachedServers = servers;
    } catch {
      // plex.tv unreachable at boot; status endpoint will retry
    }
  }
  if (session.server) {
    try {
      await indexMoviesTracked();
    } catch {
      // stale connection; user can reconnect or refresh from the UI
    }
  }
}

bootstrap();
