import { useRouter } from "expo-router";
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
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../src/firebaseConfig";

const ALLOWED_ADMINS = ["info@haarmonie-sha.de"];

type RewardAction = {
  id: string;
  title: string;
  description: string;
  points: number;
  url?: string;
  active?: boolean;
  order?: number;
  startDate?: string;
  endDate?: string;
};

const isEmailAdmin = (mail: string | null | undefined) => {
  if (!mail) return false;
  return ALLOWED_ADMINS.includes(mail.toLowerCase());
};

export default function ManageRewardActions() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [rewardActions, setRewardActions] = useState<RewardAction[]>([]);
  const [rewardActionsLoading, setRewardActionsLoading] = useState(false);
  const [rewardActionsBusyId, setRewardActionsBusyId] = useState<string | null>(null);

  const [rewardActionTitle, setRewardActionTitle] = useState("");
  const [rewardActionDescription, setRewardActionDescription] = useState("");
  const [rewardActionPoints, setRewardActionPoints] = useState("");
  const [rewardActionUrl, setRewardActionUrl] = useState("");
  const [rewardActionOrder, setRewardActionOrder] = useState("");
  const [rewardActionStartDate, setRewardActionStartDate] = useState("");
  const [rewardActionEndDate, setRewardActionEndDate] = useState("");
  const [rewardActionActive, setRewardActionActive] = useState(true);
  const [editingRewardActionId, setEditingRewardActionId] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [orderDropdownOpen, setOrderDropdownOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const allowed = isEmailAdmin(user?.email);
      setIsAdmin(!!allowed);
      setAuthChecked(true);

      if (!allowed) {
        Alert.alert(
          "Kein Zugriff",
          "Nur Admins können Prämien-Aktionen verwalten.",
          [{ text: "OK", onPress: () => router.replace("/") }]
        );
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!authChecked || !isAdmin) return undefined;

    const actionsRef = collection(db, "rewardActions");
    const qActions = query(actionsRef, orderBy("order", "asc"), orderBy("createdAt", "desc"));

    setRewardActionsLoading(true);
    const unsub = onSnapshot(
      qActions,
      (snap) => {
        const list: RewardAction[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            title: d.title || "",
            description: d.description || "",
            points: typeof d.points === "number" ? d.points : 0,
            url: typeof d.url === "string" ? d.url : "",
            active: d.active !== false,
            order: typeof d.order === "number" ? d.order : undefined,
            startDate: typeof d.startDate === "string" ? d.startDate : undefined,
            endDate: typeof d.endDate === "string" ? d.endDate : undefined,
          });
        });
        setRewardActions(list);
        setRewardActionsLoading(false);
      },
      (err) => {
        console.error("Reward-Aktionen konnten nicht geladen werden:", err);
        setRewardActionsLoading(false);
      }
    );

    return () => unsub();
  }, [authChecked, isAdmin]);

  const sortedRewardActions = useMemo(
    () =>
      [...rewardActions].sort(
        (a, b) => (a.order ?? 9999) - (b.order ?? 9999) || (a.title || "").localeCompare(b.title || "")
      ),
    [rewardActions]
  );

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const parseDateOrToday = (value?: string) => {
    const ts = value ? Date.parse(value) : Number.NaN;
    return Number.isNaN(ts) ? new Date() : new Date(ts);
  };

  const handleStartDateChange = (_: any, selected?: Date) => {
    setShowStartPicker(false);
    if (selected) {
      setRewardActionStartDate(formatDate(selected));
    }
  };

  const handleEndDateChange = (_: any, selected?: Date) => {
    setShowEndPicker(false);
    if (selected) {
      setRewardActionEndDate(formatDate(selected));
    }
  };

  const resetRewardActionForm = () => {
    setRewardActionTitle("");
    setRewardActionDescription("");
    setRewardActionPoints("");
    setRewardActionUrl("");
    setRewardActionOrder("");
    setRewardActionStartDate("");
    setRewardActionEndDate("");
    setRewardActionActive(true);
    setEditingRewardActionId(null);
  };

  const handleEditRewardAction = (action: RewardAction) => {
    setEditingRewardActionId(action.id);
    setRewardActionTitle(action.title);
    setRewardActionDescription(action.description);
    setRewardActionPoints(String(action.points));
    setRewardActionUrl(action.url || "");
    setRewardActionOrder(typeof action.order === "number" ? String(action.order) : "");
    setRewardActionStartDate(action.startDate || "");
    setRewardActionEndDate(action.endDate || "");
    setRewardActionActive(action.active !== false);
  };

  const handleSaveRewardAction = async () => {
    if (!isAdmin) return;

    const title = rewardActionTitle.trim();
    const description = rewardActionDescription.trim();
    const url = rewardActionUrl.trim();
    const order = rewardActionOrder.trim() ? Number.parseInt(rewardActionOrder.trim(), 10) : 0;
    const points = Number.parseInt(rewardActionPoints.trim(), 10);
    const startDate = rewardActionStartDate.trim();
    const endDate = rewardActionEndDate.trim();

    if (!title || !description) {
      Alert.alert("Angaben fehlen", "Bitte Titel und Beschreibung ausfüllen.");
      return;
    }
    if (!Number.isFinite(points) || points <= 0) {
      Alert.alert("Punkte prüfen", "Bitte eine Punktzahl größer 0 angeben.");
      return;
    }

    try {
      setRewardActionsBusyId(editingRewardActionId || "new");
      const payload: any = {
        title,
        description,
        points,
        url,
        active: rewardActionActive,
        order,
        startDate,
        endDate,
        updatedAt: serverTimestamp(),
      };

      if (editingRewardActionId) {
        const ref = doc(db, "rewardActions", editingRewardActionId);
        await updateDoc(ref, payload);
      } else {
        await addDoc(collection(db, "rewardActions"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetRewardActionForm();
      Alert.alert("Gespeichert", "Prämien-Aktion wurde gespeichert.");
    } catch (err) {
      console.error("Reward-Aktion speichern fehlgeschlagen:", err);
      Alert.alert("Fehler", "Die Aktion konnte nicht gespeichert werden.");
    } finally {
      setRewardActionsBusyId(null);
    }
  };

  const handleDeleteRewardAction = async (actionId: string) => {
    if (!isAdmin || !actionId) return;
    Alert.alert(
      "Aktion löschen",
      "Möchtest du diese Prämien-Aktion wirklich löschen?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            try {
              setRewardActionsBusyId(actionId);
              const ref = doc(db, "rewardActions", actionId);
              await deleteDoc(ref);
              if (editingRewardActionId === actionId) {
                resetRewardActionForm();
              }
            } catch (err) {
              console.error("Aktion löschen fehlgeschlagen:", err);
              Alert.alert("Fehler", "Die Aktion konnte nicht gelöscht werden.");
            } finally {
              setRewardActionsBusyId(null);
            }
          },
        },
      ]
    );
  };

  const handleToggleRewardActionActive = async (action: RewardAction) => {
    if (!isAdmin || !action?.id) return;

    const currentActive = action.active !== false;
    const nextActive = !currentActive;
    const ref = doc(db, "rewardActions", action.id);

    try {
      setRewardActionsBusyId(action.id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        const fallbackOrder =
          typeof action.order === "number" && Number.isFinite(action.order) ? action.order : 0;

        await setDoc(
          ref,
          {
            title: action.title || "",
            description: action.description || "",
            points: typeof action.points === "number" ? action.points : 0,
            url: action.url || "",
            order: fallbackOrder,
            startDate: action.startDate || "",
            endDate: action.endDate || "",
            active: nextActive,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await updateDoc(ref, { active: nextActive, updatedAt: serverTimestamp() });
      }
    } catch (err) {
      console.error("Aktiv-Status aendern fehlgeschlagen:", err);
      Alert.alert("Fehler", "Status konnte nicht geändert werden. Bitte erneut versuchen.");
    } finally {
      setRewardActionsBusyId(null);
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
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Zurück</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Prämien-Aktionen verwalten</Text>
        </View>

        <Text style={styles.helperText}>
          Aktionen erscheinen in der Kundensicht, wenn sie aktiv sind und innerhalb des Start- /
          Enddatums liegen.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Titel</Text>
          <TextInput
            style={styles.input}
            value={rewardActionTitle}
            onChangeText={setRewardActionTitle}
            placeholder="z. B. 5-Sterne Bewertung"
          />

          <Text style={styles.label}>Beschreibung</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            value={rewardActionDescription}
            onChangeText={setRewardActionDescription}
            placeholder="Kurzbeschreibung"
            multiline
          />

          <Text style={styles.label}>Punkte</Text>
          <TextInput
            style={styles.input}
            value={rewardActionPoints}
            onChangeText={setRewardActionPoints}
            placeholder="z. B. 50"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Link (optional)</Text>
          <TextInput
            style={styles.input}
            value={rewardActionUrl}
            onChangeText={setRewardActionUrl}
            placeholder="https://..."
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Sortierung (Order)</Text>
          <TouchableOpacity
            style={[styles.input, styles.dropdownTrigger, { paddingVertical: 6 }]}
            onPress={() => setOrderDropdownOpen((prev) => !prev)}
          >
            <Text style={styles.dropdownTriggerText}>
              {rewardActionOrder ? `Position ${rewardActionOrder}` : "Bitte wählen (1-10)"}
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
                      rewardActionOrder === value && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setRewardActionOrder(value);
                      setOrderDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        rewardActionOrder === value && styles.dropdownItemTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Startdatum</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateInput]}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={styles.dropdownTriggerText}>
                  {rewardActionStartDate ? rewardActionStartDate : "Startdatum wählen"}
                </Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={parseDateOrToday(rewardActionStartDate)}
                  mode="date"
                  display="calendar"
                  onChange={handleStartDateChange}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Enddatum (optional)</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateInput]}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={styles.dropdownTriggerText}>
                  {rewardActionEndDate ? rewardActionEndDate : "Enddatum wählen"}
                </Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={parseDateOrToday(rewardActionEndDate)}
                  mode="date"
                  display="calendar"
                  onChange={handleEndDateChange}
                />
              )}
              {rewardActionEndDate ? (
                <TouchableOpacity
                  style={[styles.smallButton, { marginTop: 6, alignSelf: "flex-start" }]}
                  onPress={() => setRewardActionEndDate("")}
                >
                  <Text style={styles.smallButtonText}>Enddatum entfernen</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Aktiv</Text>
            <Switch
              value={rewardActionActive}
              onValueChange={setRewardActionActive}
              thumbColor={rewardActionActive ? "#c49a6c" : "#f4f3f4"}
              trackColor={{ false: "#ccc", true: "#f0e0cf" }}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { flex: 1, opacity: rewardActionsBusyId ? 0.7 : 1 },
              ]}
              onPress={handleSaveRewardAction}
              disabled={!!rewardActionsBusyId}
            >
              <Text style={styles.primaryButtonText}>
                {rewardActionsBusyId
                  ? "Bitte warten..."
                  : editingRewardActionId
                  ? "Änderungen speichern"
                  : "Aktion speichern"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { flex: 1 }]}
              onPress={resetRewardActionForm}
              disabled={!!rewardActionsBusyId}
            >
              <Text style={styles.secondaryButtonText}>Zurücksetzen</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bestehende Aktionen</Text>
          {rewardActionsLoading && sortedRewardActions.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 10 }} />
          ) : sortedRewardActions.length === 0 ? (
            <Text style={styles.emptyText}>Keine Aktionen gespeichert.</Text>
          ) : (
            sortedRewardActions.map((action) => {
              const active = action.active !== false;
              return (
                <View key={action.id} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{action.title}</Text>
                    <Text style={styles.itemMeta}>
                      +{action.points} P
                      {action.order ? ` • Ordnung ${action.order}` : ""}
                      {action.startDate ? ` • Start ${action.startDate}` : ""}
                      {action.endDate ? ` • Ende ${action.endDate}` : ""}
                    </Text>
                    <Text style={styles.itemDescription}>{action.description}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: active ? "#256029" : "#a87132", marginBottom: 6 },
                      ]}
                    >
                      {active ? "Aktiv" : "Inaktiv"}
                    </Text>
                    <TouchableOpacity
                      style={[styles.smallButton, { marginBottom: 6 }]}
                      disabled={rewardActionsBusyId === action.id}
                      onPress={() => handleEditRewardAction(action)}
                    >
                      <Text style={styles.smallButtonText}>Bearbeiten</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.smallButton,
                        { marginBottom: 6, backgroundColor: active ? "#c0392b" : "#2e8b57" },
                        rewardActionsBusyId === action.id && styles.actionButtonDisabled,
                      ]}
                      disabled={rewardActionsBusyId === action.id}
                      onPress={() => handleToggleRewardActionActive(action)}
                    >
                      <Text style={styles.smallButtonText}>
                        {active ? "Deaktivieren" : "Aktivieren"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.smallButton,
                        { backgroundColor: "#c0392b" },
                        rewardActionsBusyId === action.id && styles.actionButtonDisabled,
                      ]}
                      disabled={rewardActionsBusyId === action.id}
                      onPress={() => handleDeleteRewardAction(action.id)}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backLink: {
    color: "#c49a6c",
    fontWeight: "600",
    fontSize: 14,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  helperText: {
    fontSize: 12,
    color: "#555",
    marginTop: 6,
    marginBottom: 2,
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
  dateInput: {
    justifyContent: "center",
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
});
