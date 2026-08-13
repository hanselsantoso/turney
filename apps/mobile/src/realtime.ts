import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./stores/auth";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

function getSocket(token: string | null) {
  if (!socket) {
    socket = io(BASE, { auth: token ? { token } : {}, transports: ["websocket", "polling"] });
  }
  return socket;
}

/* Join a tournament room; server emits IDs only, we refetch through the
   normal query path (single source of truth, no cache-merge drift). */
export function useTournamentRoom(tournamentId: string | undefined) {
  const qc = useQueryClient();
  const token = useAuth((s) => s.accessToken);

  useEffect(() => {
    if (!tournamentId) return;
    const s = getSocket(token);
    s.emit("join", tournamentId);

    const onMatch = (payload: { matchId: string; stageId?: string }) => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["battles", payload.matchId] });
      qc.invalidateQueries({ queryKey: ["participants", tournamentId] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    };
    s.on("match:updated", onMatch);
    s.io.on("reconnect", () => {
      s.emit("join", tournamentId);
      qc.invalidateQueries({ queryKey: ["matches"] });
    });

    return () => {
      s.off("match:updated", onMatch);
      s.emit("leave", tournamentId);
    };
  }, [tournamentId, token, qc]);
}
