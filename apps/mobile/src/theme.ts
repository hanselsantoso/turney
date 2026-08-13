import { useQuery } from "@tanstack/react-query";
import { tokens } from "@turney/shared";
import { api } from "./api/client";

type Community = { id: string; accentColor: string | null };

/* Community accent resolution: community's color > platform default.
   Semantic colors (live/win) never themed - spec rule. */
export function useCommunityAccent(communityId: string | undefined) {
  const { data } = useQuery<Community[]>({
    queryKey: ["communities", "all"],
    queryFn: () => api("/communities"),
    staleTime: 5 * 60 * 1000,
  });
  const community = data?.find((c) => c.id === communityId);
  return community?.accentColor ?? tokens.color.accent;
}
