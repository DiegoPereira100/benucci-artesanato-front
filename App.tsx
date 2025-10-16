import { ExpoRoot } from "expo-router";
import { AppRegistry, View } from "react-native";
import appJson from "./app.json";
import Toast from 'react-native-toast-message';
import React from 'react';
import { Text, View as RNView } from 'react-native';

const toastConfig = {
  success: (props: any) => (
    <RNView style={{ width: '100%', padding: 12, backgroundColor: '#4BB543', borderRadius: 8, marginHorizontal: 8 }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{props.text1}</Text>
      {props.text2 ? <Text style={{ color: '#fff', marginTop: 4 }}>{props.text2}</Text> : null}
    </RNView>
  ),
  error: (props: any) => (
    <RNView style={{ width: '100%', padding: 12, backgroundColor: '#E53935', borderRadius: 8, marginHorizontal: 8 }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{props.text1}</Text>
      {props.text2 ? <Text style={{ color: '#fff', marginTop: 4 }}>{props.text2}</Text> : null}
    </RNView>
  ),
  info: (props: any) => (
    <RNView style={{ width: '100%', padding: 12, backgroundColor: '#2196F3', borderRadius: 8, marginHorizontal: 8 }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{props.text1}</Text>
      {props.text2 ? <Text style={{ color: '#fff', marginTop: 4 }}>{props.text2}</Text> : null}
    </RNView>
  ),
};
const appName = appJson.expo.name;

export default function App() {
  const ctx = require.context("./app");
  return (
    <View style={{ flex: 1 }}>
      <ExpoRoot context={ctx} />
      <Toast config={toastConfig} />
    </View>
  );
}

AppRegistry.registerComponent(appName, () => App);