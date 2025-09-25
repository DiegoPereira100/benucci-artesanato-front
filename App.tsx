import { ExpoRoot } from "expo-router";
import { AppRegistry } from "react-native";
import { name as appName } from "./app.json";

// Must be exported or Fast Refresh won't update the context
export default function App() {
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}

AppRegistry.registerComponent(appName, () => App);