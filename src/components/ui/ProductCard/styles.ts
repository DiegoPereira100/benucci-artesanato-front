import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    flexShrink: 1,
    marginHorizontal: 8,
  },
  gradient: {
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
    minHeight: 220,
    justifyContent: "space-between",
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E0F2F7",
  },
  placeholderText: {
    fontSize: 42,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    minHeight: 40,
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00BCD4",
  },
});
