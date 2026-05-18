import { Redirect, type Href } from "expo-router";

export default function OAuthRedirectScreen() {
  return <Redirect href={"/account" as Href} />;
}
