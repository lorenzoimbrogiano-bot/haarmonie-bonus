import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Reward = {
  id: string;
  title: string;
  description: string;
  pointsRequired: number;
};

const REWARDS: Reward[] = [
  {
    id: "pflege",
    title: "Pflege-Upgrade",
    description: "Luxuspflege oder Maske zu deinem nächsten Termin.",
    pointsRequired: 150,
  },
  {
    id: "foehnen",
    title: "Föhnen inklusive",
    description: "Einmal Föhnen/Styling ohne Aufpreis.",
    pointsRequired: 250,
  },
  {
    id: "rabatt10",
    title: "10 € Haarmonie Bonus",
    description: "10 € Rabatt auf deine Wunschbehandlung.",
    pointsRequired: 400,
  },
  {
    id: "luxus",
    title: "Luxus-Verwöhnmoment",
    description: "Exklusive Verwöhnbehandlung – für Stammkund:innen.",
    pointsRequired: 600,
  },
];

export default function RewardsScreen() {
  const params = useLocalSearchParams<{ points?: string }>();
  const parsedPoints =
    params?.points && !Array.isArray(params.points)
      ? Number.parseInt(params.points, 10)
      : Number.NaN;
  const hasPoints = Number.isFinite(parsedPoints);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Prämienübersicht</Text>
        <Text style={styles.subtitle}>
          Hier siehst du alle Bonus-Prämien und die benötigten Punkte.
        </Text>

        <View style={styles.pointsBanner}>
          <Text style={styles.pointsBannerLabel}>Dein Punktestand</Text>
          <Text style={styles.pointsBannerValue}>
            {hasPoints ? `${parsedPoints} P` : "noch nicht geladen"}
          </Text>
        </View>

        {REWARDS.map((reward) => {
          const canRedeem =
            hasPoints && parsedPoints >= reward.pointsRequired;
          const missing = hasPoints
            ? reward.pointsRequired - parsedPoints
            : null;

          return (
            <View
              key={reward.id}
              style={[
                styles.rewardRow,
                canRedeem && styles.rewardRowActive,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rewardTitle}>{reward.title}</Text>
                <Text style={styles.rewardDescription}>
                  {reward.description}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.rewardPoints}>
                  {reward.pointsRequired} P
                </Text>
                <Text
                  style={[
                    styles.rewardStatus,
                    canRedeem
                      ? styles.rewardStatusActive
                      : styles.rewardStatusInactive,
                  ]}
                >
                  {canRedeem
                    ? "Einlösbar im Salon"
                    : missing !== null
                    ? `Es fehlen ${missing} P`
                    : "Punktestand unbekannt"}
                </Text>
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.backButton, { marginTop: 20 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Zurück</Text>
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
    paddingBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
  },
  subtitle: {
    fontSize: 13,
    color: "#777",
    marginTop: 6,
    marginBottom: 18,
  },
  pointsBanner: {
    backgroundColor: "#fdf4ea",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eaded1",
  },
  pointsBannerLabel: {
    fontSize: 12,
    color: "#777",
  },
  pointsBannerValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#c49a6c",
    marginTop: 4,
  },
  rewardRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eaded1",
  },
  rewardRowActive: {
    backgroundColor: "#fdf4ea",
  },
  rewardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  rewardDescription: {
    fontSize: 12,
    color: "#777",
    marginTop: 3,
    marginRight: 8,
  },
  rewardPoints: {
    fontSize: 13,
    fontWeight: "700",
    color: "#c49a6c",
  },
  rewardStatus: {
    fontSize: 11,
    marginTop: 3,
  },
  rewardStatusActive: {
    color: "#256029",
  },
  rewardStatusInactive: {
    color: "#a87132",
  },
  backButton: {
    backgroundColor: "#c49a6c",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
