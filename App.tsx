import { ExpoRoot } from "expo-router";
import { AppRegistry } from "react-native";
import appJson from "./app.json";
const appName = appJson.expo.name;

export default function App() {
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}

AppRegistry.registerComponent(appName, () => App);