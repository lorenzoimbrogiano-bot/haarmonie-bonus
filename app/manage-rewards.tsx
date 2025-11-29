import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth, db } from "../src/firebaseConfig";

const ALLOWED_ADMINS = ["info@haarmonie-sha.de"];

type Reward = {
  id: string;
  title: string;
  description: string;
  pointsRequired: number;
  order?: number;
  active?: boolean;
};

const isEmailAdmin = (mail: string | null | undefined) => {
  if (!mail) return false;
  return ALLOWED_ADMINS.includes(mail.toLowerCase());
};

export default function ManageRewards() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsBusyId, setRewardsBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsRequired, setPointsRequired] = useState("");
  const [order, setOrder] = useState("");
  const [active, setActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [orderDropdownOpen, setOrderDropdownOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const allowed = isEmailAdmin(user?.email);
      setIsAdmin(!!allowed);
      setAuthChecked(true);

      if (!allowed) {
        Alert.alert("Kein Zugriff", "Nur Admins können Prämien verwalten.", [
          { text: "OK", onPress: () => router.replace("/") },
        ]);
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!authChecked || !isAdmin) return undefined;
    const rewardsRef = collection(db, "rewards");
    const q = query(rewardsRef, orderBy("pointsRequired", "asc"), orderBy("createdAt", "desc"));
    setRewardsLoading(true);
    const unsub = onSnapshot(
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
            order: typeof d.order === "number" ? d.order : undefined,
            active: d.active !== false,
          });
        });
        setRewards(list);
        setRewardsLoading(false);
      },
      (err) => {
        console.error("Prämien konnten nicht geladen werden:", err);
        setRewardsLoading(false);
      }
    );

    return () => unsub();
  }, [authChecked, isAdmin]);

  const sortedRewards = useMemo(
    () =>
      [...rewards].sort(
        (a, b) => (a.pointsRequired ?? 0) - (b.pointsRequired ?? 0) || (a.order ?? 9999) - (b.order ?? 9999)
      ),
    [rewards]
  );

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPointsRequired("");
    setOrder("");
    setActive(true);
    setEditingId(null);
    setOrderDropdownOpen(false);
  };

  const handleEdit = (reward: Reward) => {
    setEditingId(reward.id);
    setTitle(reward.title);
    setDescription(reward.description);
    setPointsRequired(String(reward.pointsRequired));
    setOrder(typeof reward.order === "number" ? String(reward.order) : "");
    setActive(reward.active !== false);
    setOrderDropdownOpen(false);
  };

  const handleSave = async () => {
    if (!isAdmin) return;

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const pointsNum = Number.parseInt(pointsRequired.trim(), 10);
    const orderNum = order.trim() ? Number.parseInt(order.trim(), 10) : undefined;

    if (!trimmedTitle || !trimmedDesc) {
      Alert.alert("Angaben fehlen", "Bitte Titel und Beschreibung ausfüllen.");
      return;
    }
    if (!Number.isFinite(pointsNum) || pointsNum <= 0) {
      Alert.alert("Punkte prüfen", "Bitte Punkte größer 0 angeben.");
      return;
    }

    const payload: any = {
      title: trimmedTitle,
      description: trimmedDesc,
      pointsRequired: pointsNum,
      order: orderNum,
      active,
      updatedAt: serverTimestamp(),
    };

    try {
      setRewardsBusyId(editingId || "new");
      if (editingId) {
        await updateDoc(doc(db, "rewards", editingId), payload);
      } else {
        await addDoc(collection(db, "rewards"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      resetForm();
      Alert.alert("Gespeichert", "Prämie wurde gespeichert.");
    } catch (err) {
      console.error("Prämie speichern fehlgeschlagen:", err);
      Alert.alert("Fehler", "Die Prämie konnte nicht gespeichert werden.");
    } finally {
      setRewardsBusyId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (!isAdmin || !id) return;
    Alert.alert("Prämie löschen", "Prämie wirklich löschen?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          try {
            setRewardsBusyId(id);
            await deleteDoc(doc(db, "rewards", id));
            if (editingId === id) resetForm();
          } catch (err) {
            console.error("Prämie löschen fehlgeschlagen:", err);
            Alert.alert("Fehler", "Prämie konnte nicht gelöscht werden.");
          } finally {
            setRewardsBusyId(null);
          }
        },
      },
    ]);
  };

  const handleToggleActive = async (reward: Reward) => {
    if (!isAdmin || !reward.id) return;
    try {
      setRewardsBusyId(reward.id);
      await setDoc(
        doc(db, "rewards", reward.id),
        { active: reward.active === false, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Status ändern fehlgeschlagen:", err);
      Alert.alert("Fehler", "Status konnte nicht geändert werden.");
    } finally {
      setRewardsBusyId(null);
    }
  };

  if (!authChecked) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Lade...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.sectionTitle}>Kein Zugriff</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 12 }]}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.primaryButtonText}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Prämien verwalten</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.primaryButton, styles.backButton]}
          >
            <Text style={styles.primaryButtonText}>Zurück</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Titel</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="z. B. Pflege-Upgrade"
          />

          <Text style={styles.label}>Beschreibung</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Kurzbeschreibung"
            multiline
          />

          <Text style={styles.label}>Benötigte Punkte</Text>
          <TextInput
            style={styles.input}
            value={pointsRequired}
            onChangeText={setPointsRequired}
            placeholder="z. B. 150"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Sortierung (optional)</Text>
          <TouchableOpacity
            style={[styles.input, styles.dropdownTrigger, { paddingVertical: 6 }]}
            onPress={() => setOrderDropdownOpen((prev) => !prev)}
          >
            <Text style={styles.dropdownTriggerText}>
              {order ? `Position ${order}` : "Bitte wählen (1-10)"}
            </Text>
            <Text style={styles.dropdownChevron}>{orderDropdownOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {orderDropdownOpen && (
            <View style={[styles.dropdownList, { marginTop: 8 }]}>
              {[...Array(10)].map((_, idx) => {
                const value = String(idx + 1);
                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.dropdownItem,
                      order === value && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setOrder(value);
                      setOrderDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        order === value && styles.dropdownItemTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.switchRow}>
            <Text style={styles.label}>Aktiv</Text>
            <Switch
              value={active}
              onValueChange={setActive}
              thumbColor={active ? "#c49a6c" : "#f4f3f4"}
              trackColor={{ false: "#ccc", true: "#f0e0cf" }}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.primaryButton, { flex: 1, opacity: rewardsBusyId ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={!!rewardsBusyId}
            >
              <Text style={styles.primaryButtonText}>
                {rewardsBusyId
                  ? "Bitte warten..."
                  : editingId
                  ? "Änderungen speichern"
                  : "Prämie speichern"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { flex: 1 }]}
              onPress={resetForm}
              disabled={!!rewardsBusyId}
            >
              <Text style={styles.secondaryButtonText}>Zurücksetzen</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bestehende Prämien</Text>
          {rewardsLoading && sortedRewards.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 10 }} />
          ) : sortedRewards.length === 0 ? (
            <Text style={styles.emptyText}>Keine Prämien gespeichert.</Text>
          ) : (
            sortedRewards.map((reward) => {
              const isActive = reward.active !== false;
              return (
                <View key={reward.id} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{reward.title}</Text>
                    <Text style={styles.itemMeta}>
                      {reward.pointsRequired} P
                      {reward.order ? ` • Ordnung ${reward.order}` : ""}
                    </Text>
                    <Text style={styles.itemDescription}>{reward.description}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: isActive ? "#256029" : "#a87132", marginBottom: 6 },
                      ]}
                    >
                      {isActive ? "Aktiv" : "Inaktiv"}
                    </Text>
                    <TouchableOpacity
                      style={[styles.smallButton, { marginBottom: 6 }]}
                      disabled={rewardsBusyId === reward.id}
                      onPress={() => handleEdit(reward)}
                    >
                      <Text style={styles.smallButtonText}>Bearbeiten</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.smallButton,
                        { marginBottom: 6, backgroundColor: isActive ? "#c0392b" : "#2e8b57" },
                        rewardsBusyId === reward.id && styles.actionButtonDisabled,
                      ]}
                      disabled={rewardsBusyId === reward.id}
                      onPress={() => handleToggleActive(reward)}
                    >
                      <Text style={styles.smallButtonText}>
                        {isActive ? "Deaktivieren" : "Aktivieren"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.smallButton,
                        { backgroundColor: "#c0392b" },
                        rewardsBusyId === reward.id && styles.actionButtonDisabled,
                      ]}
                      disabled={rewardsBusyId === reward.id}
                      onPress={() => handleDelete(reward.id)}
                    >
                      <Text style={styles.smallButtonText}>Löschen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
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
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eaded1",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  label: {
    fontSize: 13,
    color: "#555",
    marginBottom: 6,
    marginTop: 10,
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
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
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#c49a6c",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  secondaryButtonText: {
    color: "#c49a6c",
    fontWeight: "600",
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  emptyText: {
    fontSize: 13,
    color: "#777",
    marginTop: 8,
  },
  listItem: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eaded1",
    gap: 10,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  itemMeta: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
  },
  itemDescription: {
    fontSize: 12,
    color: "#555",
    marginTop: 4,
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#c49a6c",
  },
  smallButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  dropdownTrigger: {
    justifyContent: "center",
  },
  dropdownTriggerText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: "#e1d3c5",
    borderRadius: 12,
    backgroundColor: "#fff",
    marginTop: 6,
  },
  dropdownChevron: {
    fontSize: 14,
    color: "#777",
    position: "absolute",
    right: 12,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eaded1",
  },
  dropdownItemActive: {
    backgroundColor: "#fdf4ea",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownItemTextActive: {
    color: "#c49a6c",
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
});
