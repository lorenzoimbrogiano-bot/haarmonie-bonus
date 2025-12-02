import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CLOUD_FUNCTION_PUSH_URL =
  "https://us-central1-haarmonie-bonus.cloudfunctions.net/sendPushHttp";

export default function ManagePushScreen() {
  const router = useRouter();
  const [pushBody, setPushBody] = useState("");
  const [pushBusy, setPushBusy] = useState(false);

  const handleSendPush = async () => {
    if (!pushBody.trim()) {
      Alert.alert("Angaben fehlen", "Bitte Nachricht ausfüllen.");
      return;
    }
    if (!CLOUD_FUNCTION_PUSH_URL.startsWith("https://")) {
      Alert.alert("Push-Endpoint fehlt", "Bitte CLOUD_FUNCTION_PUSH_URL konfigurieren.");
      return;
    }

    setPushBusy(true);
    try {
      const resp = await fetch(CLOUD_FUNCTION_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Wir nutzen einen Standard-Titel, nur das Nachrichten-Feld wird eingegeben.
          title: "Haarmonie",
          body: pushBody.trim(),
          target: "all",
        }),
      });
      if (!resp.ok) {
        throw new Error("push_failed");
      }
      Alert.alert("Gesendet", "Push-Nachricht wurde ausgelöst.");
      setPushBody("");
    } catch (err) {
      console.error("Push senden fehlgeschlagen:", err);
      Alert.alert(
        "Fehler",
        "Push konnte nicht gesendet werden. Bitte Endpoint prüfen."
      );
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Push Nachrichten</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.primaryButton, styles.backButton]}
          >
            <Text style={styles.primaryButtonText}>Zurück</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Versende Push-Nachrichten an alle Kunden.
        </Text>

        <Text style={styles.label}>Nachricht</Text>
        <TextInput
          style={[styles.input, { height: 90 }]}
          value={pushBody}
          onChangeText={setPushBody}
          placeholder="Nachrichtentext"
          multiline
        />

        <Text style={[styles.label, { marginTop: 14 }]}>Hinweis</Text>
        <Text style={styles.subtitle}>
          Pushs werden an alle vorhandenen Push-Tokens versendet.
        </Text>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            { marginTop: 16, opacity: pushBusy ? 0.6 : 1 },
          ]}
          onPress={handleSendPush}
          disabled={pushBusy}
        >
          <Text style={styles.primaryButtonText}>
            {pushBusy ? "Sende..." : "Push senden"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF7F2",
  },
  scroll: {
    padding: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  subtitle: {
    fontSize: 12,
    color: "#777",
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    color: "#555",
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e1d3c5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#c49a6c",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
