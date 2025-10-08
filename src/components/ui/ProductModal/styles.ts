import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "92%",
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    maxHeight: "90%",
  },
  headerImage: {
    width: "100%",
    height: 260,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 4,
  },
  content: {
    padding: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  price: {
    fontSize: 20,
    color: "#00BCD4",
    fontWeight: "700",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 20,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  qtyBtn: {
    backgroundColor: "#00BCD4",
    borderRadius: 20,
    padding: 10,
  },
  qty: {
    fontSize: 18,
    fontWeight: "600",
    marginHorizontal: 16,
  },
  cartBtn: {
    backgroundColor: "#00BCD4",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  cartText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
