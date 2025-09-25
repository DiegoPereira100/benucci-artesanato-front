import { View, Text, StyleSheet } from 'react-native';

export default function ExploreTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tab Explorar</Text>
      <Text style={styles.text}>Aqui você pode explorar conteúdos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    color: '#666',
  },
});