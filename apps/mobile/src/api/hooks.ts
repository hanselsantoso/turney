import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { useAuth } from "../stores/auth";

function useToken() {
  return useAuth((s) => s.accessToken);
}

export type Tournament = {
  id: string;
  name: string;
  status: string;
  bannerUrl: string | null;
  prizePool: Array<{ place: number; prize: string }> | null;
  entryFee: number;
  maxParticipants: number;
  startsAt: string;
  communityId: string;
  stages?: Stage[];
};
export type Stage = {
  id: string;
  seq: number;
  name: string;
  format: string;
  scoring: string;
  roundsPlanned: number | null;
  advanceCount: number | null;
};
export type Community = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  accentColor: string | null;
};
export type LeaderboardRow = {
  id: string;
  displayName: string;
  playerCode: string;
  elo: number;
  city: string | null;
};

export function useTournaments() {
  return useQuery<Tournament[]>({
    queryKey: ["tournaments"],
    queryFn: () => api("/tournaments"),
  });
}

export function useTournament(id: string) {
  return useQuery<Tournament>({
    queryKey: ["tournament", id],
    queryFn: () => api(`/tournaments/${id}`),
    enabled: !!id,
  });
}

export function useCommunities(city?: string | null) {
  return useQuery<Community[]>({
    queryKey: ["communities", city ?? "all"],
    queryFn: () => api(city ? `/communities?city=${encodeURIComponent(city)}` : "/communities"),
  });
}

export function useLeaderboard() {
  return useQuery<LeaderboardRow[]>({
    queryKey: ["leaderboard"],
    queryFn: () => api("/leaderboard"),
  });
}

export function useMyRegistrations(tournamentId: string) {
  return useQuery<Array<{ id: string; userId: string; status: string; qrToken: string }>>({
    queryKey: ["registrations", tournamentId],
    queryFn: () => api(`/tournaments/${tournamentId}/registrations`),
    enabled: !!tournamentId,
  });
}

export function useRegister(tournamentId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api(`/tournaments/${tournamentId}/registrations`, { method: "POST" }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
  });
}

export function usePlayerStats(userId?: string) {
  return useQuery<{
    displayName: string;
    playerCode: string;
    elo: number;
    matches: number;
    wins: number;
    winRate: number;
    history: Array<{ delta: number; eloAfter: number; createdAt: string }>;
  }>({
    queryKey: ["stats", userId],
    queryFn: () => api(`/players/${userId}/stats`),
    enabled: !!userId,
  });
}
