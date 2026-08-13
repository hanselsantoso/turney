import { Redirect } from "expo-router";
import { useAuth } from "../src/stores/auth";

export default function Index() {
  const user = useAuth((s) => s.user);
  return <Redirect href={user ? "/home" : "/login"} />;
}
