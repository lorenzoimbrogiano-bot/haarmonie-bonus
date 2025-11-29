import { router, useLocalSearchParams } from "expo-router";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../src/firebaseConfig";

type Reward = {
  id: string;
  title: string;
  description: string;
  pointsRequired: number;
  active?: boolean;
};

const DEFAULT_REWARDS: Reward[] = [
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
  const currentPoints = hasPoints ? parsedPoints : 0;

  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(true);

  useEffect(() => {
    const rewardsRef = collection(db, "rewards");
    const q = query(rewardsRef, orderBy("pointsRequired", "asc"), orderBy("createdAt", "desc"));

    let unsub = () => {};
    try {
      unsub = onSnapshot(
        q,
        (snap) => {
          const list: Reward[] = [];
          snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            title: d.title || "",
            description: d.description || "",
            pointsRequired: typeof d.pointsRequired === "number" ? d.pointsRequired : 0,
            active: d.active !== false,
            createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : undefined,
          });
        });
        setRewards(list);
          setRewardsLoading(false);
        },
        (err) => {
          console.error("Prämien konnten nicht geladen werden:", err);
          setRewards(DEFAULT_REWARDS);
          setRewardsLoading(false);
        }
      );
    } catch (err) {
      console.error("Prämien konnten nicht geladen werden:", err);
      setRewards(DEFAULT_REWARDS);
      setRewardsLoading(false);
    }

    return () => unsub();
  }, []);

  const availableRewards = useMemo(() => {
    const base = rewards.length > 0 ? rewards : DEFAULT_REWARDS;
    return base
      .filter((r) => r.active !== false)
      .sort((a, b) => a.pointsRequired - b.pointsRequired);
  }, [rewards]);

  const nextReward = useMemo(() => {
    return availableRewards.find((r) => r.pointsRequired > currentPoints);
  }, [availableRewards, currentPoints]);

  const progressRatio = useMemo(() => {
    if (!nextReward) return 1;
    if (nextReward.pointsRequired === 0) return 1;
    return Math.min(1, currentPoints / nextReward.pointsRequired);
  }, [nextReward, currentPoints]);

  const missingToNext =
    nextReward && hasPoints
      ? Math.max(0, nextReward.pointsRequired - currentPoints)
      : null;

  const closeModal = () => setSelectedReward(null);

  const confirmClaim = async () => {
    if (!selectedReward) return;
    const user = auth.currentUser;
    if (!user?.uid) {
      Alert.alert("Anmeldung erforderlich", "Bitte melde dich erneut an.");
      return;
    }

    setClaimingId(selectedReward.id);
    try {
      const redemptionsRef = collection(
        db,
        "users",
        user.uid,
        "rewardRedemptions"
      );
      await addDoc(redemptionsRef, {
        rewardId: selectedReward.id,
        title: selectedReward.title,
        pointsRequired: selectedReward.pointsRequired,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setFeedback(
        `Prämie "${selectedReward.title}" angefragt. Bitte im Salon bestätigen lassen.`
      );
      setSelectedReward(null);
    } catch (err) {
      console.error("Fehler beim Anfragen der Prämie:", err);
      Alert.alert(
        "Fehler",
        "Die Prämie konnte nicht angefragt werden. Bitte später erneut versuchen."
      );
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Prämienübersicht</Text>
          <TouchableOpacity
            style={[styles.primaryButton, styles.backButton]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Zurück</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Hier siehst du alle Bonus-Prämien und die benötigten Punkte.
        </Text>

        <View style={styles.pointsBannerWrapper}>
          <View style={styles.pointsBannerGlow} />
          <View style={[styles.pointsBanner, styles.pointsBannerGradient]}>
            <Text style={styles.pointsBannerLabel}>Dein Punktestand</Text>
            <Text style={styles.pointsBannerValue}>
              {hasPoints ? `${parsedPoints} P` : "noch nicht geladen"}
            </Text>
          </View>
        </View>

        <View style={styles.progressCardWrapper}>
          <View style={styles.progressCardGlow} />
          <View style={[styles.progressCard, styles.progressCardGradient]}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Fortschritt</Text>
              <Text style={styles.progressValue}>
                {hasPoints && nextReward
                  ? `${currentPoints} / ${nextReward.pointsRequired} P`
                  : hasPoints
                  ? "Alles erreicht"
                  : "Punkte laden..."}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progressRatio * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressHint}>
              {nextReward && hasPoints
                ? `Noch ${missingToNext} P bis "${nextReward.title}"`
                : nextReward
                ? `Nächste Prämie: ${nextReward.title}`
                : "Du hast bereits alle Prämien freigeschaltet."}
            </Text>
          </View>
        </View>

        {feedback && (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackText}>{feedback}</Text>
            <TouchableOpacity onPress={() => setFeedback(null)}>
              <Text style={styles.feedbackAction}>OK</Text>
            </TouchableOpacity>
          </View>
        )}

        {rewardsLoading && availableRewards.length === 0 ? (
          <View style={{ marginTop: 12 }}>
            <ActivityIndicator />
          </View>
        ) : availableRewards.length === 0 ? (
          <Text style={styles.emptyText}>Keine Prämien verfügbar.</Text>
        ) : (
          availableRewards.map((reward) => {
            const canRedeem = hasPoints && parsedPoints >= reward.pointsRequired;
            const missing = hasPoints ? reward.pointsRequired - parsedPoints : null;

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
                  <TouchableOpacity
                    onPress={() => setSelectedReward(reward)}
                    disabled={!canRedeem}
                    style={[
                      styles.claimButton,
                      !canRedeem && styles.claimButtonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.claimButtonText,
                        !canRedeem && styles.claimButtonTextDisabled,
                      ]}
                    >
                      {canRedeem
                        ? "Jetzt einlösen"
                        : missing !== null
                        ? `${missing} P fehlen`
                        : "Punktestand offen"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

      </ScrollView>

      <Modal
        visible={!!selectedReward}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Prämie einlösen</Text>
            <Text style={styles.modalRewardTitle}>
              {selectedReward?.title}
            </Text>
            <Text style={styles.modalDescription}>
              Für diese Prämie werden{" "}
              {selectedReward?.pointsRequired} Punkte verwendet.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={closeModal}
              >
                <Text style={styles.modalButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalConfirm,
                  claimingId === selectedReward?.id && { opacity: 0.7 },
                ]}
                disabled={claimingId === selectedReward?.id}
                onPress={confirmClaim}
              >
                <Text style={[styles.modalButtonText, { color: "#fff" }]}>
                  {claimingId === selectedReward?.id ? "Sende..." : "Bestätigen"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 12,
    color: "#777",
    marginTop: 6,
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: "#c49a6c",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  pointsBannerWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  pointsBannerGlow: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 6,
    bottom: 6,
    borderRadius: 22,
    backgroundColor: "rgba(255, 204, 128, 0.35)",
    shadowColor: "#f4b860",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  pointsBanner: {
    backgroundColor: "#fdf4ea",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eaded1",
  },
  pointsBannerGradient: {
    backgroundColor: "#fff7ec",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 0,
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
  progressCardWrapper: {
    position: "relative",
    marginBottom: 18,
  },
  progressCardGlow: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 6,
    bottom: 6,
    borderRadius: 22,
    backgroundColor: "rgba(255, 204, 128, 0.35)",
    shadowColor: "#f4b860",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  progressCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eaded1",
    marginBottom: 0,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  progressCardGradient: {
    backgroundColor: "#fff7ec",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 0,
    borderColor: "transparent",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  progressValue: {
    fontSize: 12,
    color: "#a87132",
    fontWeight: "600",
  },
  progressBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#f0e4d8",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#c49a6c",
    borderRadius: 999,
  },
  progressHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#555",
  },
  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#e9f7ef",
    borderColor: "#c8e6d4",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    color: "#256029",
    marginRight: 10,
  },
  feedbackAction: {
    fontSize: 12,
    fontWeight: "700",
    color: "#256029",
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
  claimButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#c49a6c",
  },
  claimButtonDisabled: {
    backgroundColor: "#f0e4d8",
  },
  claimButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  claimButtonTextDisabled: {
    color: "#9c8a73",
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eaded1",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  modalRewardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#c49a6c",
    marginTop: 6,
  },
  modalDescription: {
    fontSize: 13,
    color: "#555",
    marginTop: 8,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eaded1",
    marginLeft: 10,
  },
  modalCancel: {
    backgroundColor: "#fff",
  },
  modalConfirm: {
    backgroundColor: "#c49a6c",
    borderColor: "#c49a6c",
  },
  modalButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
});
