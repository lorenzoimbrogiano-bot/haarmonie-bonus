// app/(tabs)/index.tsx

import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth, db } from "../../src/firebaseConfig";

// >>> Admin-E-Mails <<<
const ALLOWED_ADMINS = [
  "info@haarmonie-sha.de",
];

const EMPLOYEE_NAMES = [
  "Cynthia",
  "Elena",
  "Jeniffer",
  "Valentina",
  "Sarina",
  "Xenia",
];

const EXPORT_PASSWORD = "MiaLina&76429074";
const CLOUD_FUNCTION_PUSH_URL =
  "https://hellohaarmonie-cz1lyrucwa-uc.a.run.app"; // TODO: ersetzen

type Visit = {
  id: string;
  date: string;
  points: number;
  amount?: number;
  reason?: string;
  employeeName?: string;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  points: number;
  phone?: string;
  street?: string;
  zip?: string;
  city?: string;
  createdAt?: string;
  rewardClaims?: Record<string, string | boolean>;
};

type RewardAction = {
  id: string;
  title: string;
  description: string;
  points: number;
  url?: string;
};

const REWARD_ACTIONS: RewardAction[] = [
  {
    id: "google-review",
    title: "5-Sterne Google Bewertung",
    description: "Bewerte uns mit 5 Sternen auf Google und erhalte",
    points: 50,
    url: "https://g.page/r/Cf0hqXnNeVkAEAE/review",
  },
  {
    id: "facebook-follow",
    title: "Facebook folgen",
    description: "Folge uns auf Facebook und erhalte",
    points: 30,
    url: "https://www.facebook.com/haarmoniebycynthia",
  },
  {
    id: "instagram-follow",
    title: "Instagram folgen",
    description: "Folge uns auf Instagram und erhalte",
    points: 30,
    url: "https://www.instagram.com/haarmonie_by_cynthia",
  },
];

// >>> Prämienliste <<<
export default function BonusApp() {
  // --- Auth-Status ---
  const router = useRouter();
  const keyboardOffset = Platform.OS === "ios" ? 10 : 80;
  const [firebaseUser, setFirebaseUser] = useState<{
    uid: string;
    email: string;
    name: string;
    isAdmin: boolean;
  } | null>(null);

  const [authChecked, setAuthChecked] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Login/Registrierung
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Registrierung – Stammdaten
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [consentMarketing, setConsentMarketing] = useState(false);

  // Kundensicht (eigene Punkte)
  const [points, setPoints] = useState(0);
  const [visitHistory, setVisitHistory] = useState<Visit[]>([]);
  const [rewardClaims, setRewardClaims] = useState<Record<string, string | boolean>>({});
  const [rewardClaimBusy, setRewardClaimBusy] = useState<string | null>(null);
  const [rewardExpandedId, setRewardExpandedId] = useState<string | null>(null);
  const [selectedCustomerRewardClaims, setSelectedCustomerRewardClaims] = useState<
    Record<string, string | boolean>
  >({});
  const [adminRewardBusy, setAdminRewardBusy] = useState<string | null>(null);

  // Admin-/Mitarbeiterbereich
  const [isAdminView, setIsAdminView] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editPoints, setEditPoints] = useState("");
  const [editEmployeeName, setEditEmployeeName] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [rewardEmployeeName, setRewardEmployeeName] = useState("");
  const [rewardEmployeeDropdownOpen, setRewardEmployeeDropdownOpen] = useState(false);
  const [rewardActionsExpanded, setRewardActionsExpanded] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState<string>("");
  const [editCustomerEmail, setEditCustomerEmail] = useState<string>("");
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>("");
  const [editCustomerStreet, setEditCustomerStreet] = useState<string>("");
  const [editCustomerZip, setEditCustomerZip] = useState<string>("");
  const [editCustomerCity, setEditCustomerCity] = useState<string>("");
  const [customerEditExpanded, setCustomerEditExpanded] = useState(false);
  const [customerEditUnlocked, setCustomerEditUnlocked] = useState(false);
  const [showCustomerPasswordModal, setShowCustomerPasswordModal] = useState(false);
  const [customerPasswordInput, setCustomerPasswordInput] = useState("");
  const [customerPasswordError, setCustomerPasswordError] = useState("");
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushTarget, setPushTarget] = useState<"all" | "selected">("selected");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushSectionExpanded, setPushSectionExpanded] = useState(false);
  const [pushUnlocked, setPushUnlocked] = useState(false);
  const [showPushPasswordModal, setShowPushPasswordModal] = useState(false);
  const [pushPasswordInput, setPushPasswordInput] = useState("");
  const [pushPasswordError, setPushPasswordError] = useState("");
  const [showExportPasswordModal, setShowExportPasswordModal] = useState(false);
  const [exportPasswordInput, setExportPasswordInput] = useState("");
  const [exportPasswordError, setExportPasswordError] = useState("");
  const [exportBusy, setExportBusy] = useState(false);

useEffect(() => {
  if (selectedCustomer) {
    setEditCustomerName(selectedCustomer.name || "");
    setEditCustomerEmail(selectedCustomer.email || "");
    setEditCustomerPhone(selectedCustomer.phone || "");
    setEditCustomerStreet(selectedCustomer.street || "");
    setEditCustomerZip(selectedCustomer.zip || "");
    setEditCustomerCity(selectedCustomer.city || "");
  } else {
    setEditCustomerName("");
    setEditCustomerEmail("");
    setEditCustomerPhone("");
    setEditCustomerStreet("");
    setEditCustomerZip("");
    setEditCustomerCity("");
  }
}, [selectedCustomer]);


    // Hilfsfunktion: prüfen, ob E-Mail admin ist
  const isEmailAdmin = (mail: string | null | undefined) => {
    if (!mail) return false;
    return ALLOWED_ADMINS.includes(mail.toLowerCase());
  };

  // -----------------------------------
  // Kundendaten (eigener User) laden
  // -----------------------------------
  const loadUserData = useCallback(
    async (
      uid: string,
      fallbackEmail: string,
      defaults?: { firstName?: string; lastName?: string }
    ) => {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      let nameFromDb = "";
      let pointsFromDb = 50;
      let claimsFromDb: Record<string, string | boolean> = {};

      if (snap.exists()) {
        const data = snap.data() as any;
        const combinedName = `${data.firstName || ""} ${data.lastName || ""}`.trim();

        nameFromDb = data.name || combinedName || "";
        pointsFromDb = typeof data.points === "number" ? data.points : 0;
        claimsFromDb =
          data.rewardClaims && typeof data.rewardClaims === "object"
            ? data.rewardClaims
            : {};
      } else {
        await setDoc(userRef, {
          email: fallbackEmail,
          firstName: (defaults?.firstName || "").trim(),
          lastName: (defaults?.lastName || "").trim(),
          name: `${(defaults?.firstName || "").trim()} ${(defaults?.lastName || "").trim()}`.trim(),
          street: "",
          zip: "",
          city: "",
          phone: "",
          marketingConsent: false,
          points: 0, // KEIN Bonus hier
          registrationBonusGranted: false,
          rewardClaims: {},
          createdAt: serverTimestamp(),
        });

        nameFromDb = `${(defaults?.firstName || "").trim()} ${(defaults?.lastName || "").trim()}`.trim();
        pointsFromDb = 0;
      }
      const adminFlag = isEmailAdmin(fallbackEmail);

      setFirebaseUser({
        uid,
        email: fallbackEmail,
        name: nameFromDb,
        isAdmin: adminFlag,
      });
      setPoints(pointsFromDb);
      setRewardClaims(claimsFromDb);

      try {
        const visitsRef = collection(userRef, "visits");
        const visitsSnap = await getDocs(
          query(visitsRef, orderBy("createdAt", "desc"))
        );

        const visits: Visit[] = [];
        visitsSnap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          visits.push({
            id: docSnap.id,
            date: d.createdAt?.toDate
              ? d.createdAt.toDate().toLocaleString()
              : "",
            points: typeof d.points === "number" ? d.points : 0,
            amount:
              typeof d.amount === "number" ? d.amount : undefined,
            reason: typeof d.reason === "string" ? d.reason : undefined,
            employeeName:
              typeof d.employeeName === "string" ? d.employeeName : undefined,
          });
        });

        setVisitHistory(visits);
      } catch (e) {
        console.error("Fehler beim Laden der Historie:", e);
        setVisitHistory([]);
      }
    },
    []
  );

  // -----------------------------------
  // Auto-Login
  // -----------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          await loadUserData(user.uid, user.email || "");
        } else {
          setFirebaseUser(null);
          setPoints(0);
          setVisitHistory([]);
        }
      } catch (e) {
        console.error("Fehler beim Wiederanmelden:", e);
      } finally {
        setAuthChecked(true);
      }
    });

    return () => unsub();
  }, [loadUserData]);

  // -----------------------------------
  // Live-Updates für User-Daten
  // -----------------------------------
  useEffect(() => {
    if (!firebaseUser) return undefined;
    const userRef = doc(db, "users", firebaseUser.uid);

    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const pointsFromDb =
          typeof data.points === "number" ? data.points : 0;
        const claimsFromDb =
          data.rewardClaims && typeof data.rewardClaims === "object"
            ? data.rewardClaims
            : {};
        const nameFromDb = data.name || firebaseUser.name || "";
        const emailFromDb = data.email || firebaseUser.email || "";

        setPoints(pointsFromDb);
        setRewardClaims(claimsFromDb);
        setFirebaseUser((prev) =>
          prev
            ? {
                ...prev,
                name: nameFromDb,
                email: emailFromDb,
              }
            : prev
        );
      },
      (err) => console.error("Live-Update userRef Fehler:", err)
    );

    return () => unsubUser();
  }, [firebaseUser]);

  // -----------------------------------
  // Live-Updates für Besuchshistorie
  // -----------------------------------
  useEffect(() => {
    if (!firebaseUser) return undefined;
    const userRef = doc(db, "users", firebaseUser.uid);
    const visitsRef = collection(userRef, "visits");
    const q = query(visitsRef, orderBy("createdAt", "desc"));

    const unsubVisits = onSnapshot(
      q,
      (snap) => {
        const visits: Visit[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          visits.push({
            id: docSnap.id,
            date: d.createdAt?.toDate
              ? d.createdAt.toDate().toLocaleString()
              : "",
            points: typeof d.points === "number" ? d.points : 0,
            amount:
              typeof d.amount === "number" ? d.amount : undefined,
            reason: typeof d.reason === "string" ? d.reason : undefined,
            employeeName:
              typeof d.employeeName === "string" ? d.employeeName : undefined,
          });
        });
        setVisitHistory(visits);
      },
      (err) => console.error("Live-Update visits Fehler:", err)
    );

    return () => unsubVisits();
  }, [firebaseUser]);

  // -----------------------------------
  // Home-Tab-Fokus: wenn kein User,
  // immer zurück auf Login (nicht Registrieren)
  // -----------------------------------
  useFocusEffect(
    useCallback(() => {
      if (!firebaseUser) {
        setIsRegisterMode(false);
        setIsAdminView(false);
        setSelectedCustomer(null);
        setPushTitle("");
        setPushBody("");
        setPushSectionExpanded(false);
        setPushUnlocked(false);
      }
      return undefined;
    }, [firebaseUser])
  );

  // -----------------------------------
  // Login / Registrierung
  // -----------------------------------
  const handleAuthSubmit = async () => {
    setAuthError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setAuthError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }
    if (!trimmedPassword) {
      setAuthError("Bitte gib dein Passwort ein.");
      return;
    }

    // Nur im Registriermodus: Pflichtfelder prüfen
    if (isRegisterMode) {
      if (!firstName.trim()) {
        setAuthError("Bitte gib deinen Vornamen ein.");
        return;
      }
      if (!lastName.trim()) {
        setAuthError("Bitte gib deinen Nachnamen ein.");
        return;
      }
      if (!street.trim()) {
        setAuthError("Bitte gib deine Straße ein.");
        return;
      }
      if (!zip.trim()) {
        setAuthError("Bitte gib deine PLZ ein.");
        return;
      }
      if (!city.trim()) {
        setAuthError("Bitte gib deinen Ort ein.");
        return;
      }
      if (!phone.trim()) {
        setAuthError("Bitte gib deine Telefonnummer ein.");
        return;
      }
      if (!consentMarketing) {
        setAuthError(
          "Bitte bestätige, dass wir dich per Push- und E-Mail informieren dürfen."
        );
        return;
      }
    }

    setAuthBusy(true);

    try {
      if (isRegisterMode) {
        // ---------- REGISTRIEREN mit 50 Bonuspunkten ----------
        const cred = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          trimmedPassword
        );

        const uid = cred.user.uid;
        const userRef = doc(db, "users", uid);

        // Startkonto mit Bonus
        await setDoc(userRef, {
          email: trimmedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          street: street.trim(),
          zip: zip.trim(),
          city: city.trim(),
          phone: phone.trim(),
          marketingConsent: consentMarketing,
          points: 50, // Registrierungsbonus
          registrationBonusGranted: true,
          createdAt: serverTimestamp(),
        });

        // Historie-Eintrag für den Bonus
        const visitsRef = collection(userRef, "visits");
        await setDoc(doc(visitsRef), {
          reason: "Registrierungsbonus",
          points: 50,
          amount: null,
          createdAt: serverTimestamp(),
        });

        await loadUserData(uid, trimmedEmail, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
        setIsRegisterMode(false); // nach Registrierung zurück auf Login-Ansicht
      } else {
        // ---------- EINLOGGEN ----------
        const cred = await signInWithEmailAndPassword(
          auth,
          trimmedEmail,
          trimmedPassword
        );
        await loadUserData(cred.user.uid, trimmedEmail);
      }

      // Passwortfeld leeren nach erfolgreicher Aktion
      setPassword("");
    } catch (err: any) {
      console.error("Auth-Fehler:", err);

      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setAuthError("E-Mail oder Passwort ist falsch.");
      } else if (err.code === "auth/invalid-email") {
        setAuthError("Die E-Mail-Adresse ist ungültig.");
      } else if (err.code === "auth/weak-password") {
        setAuthError("Das Passwort ist zu schwach (mind. 6 Zeichen).");
      } else if (err.code === "auth/email-already-in-use") {
        setAuthError("Für diese E-Mail existiert bereits ein Konto.");
      } else {
        setAuthError("Es ist ein Fehler aufgetreten. Bitte später erneut versuchen.");
      }
    } finally {
      setAuthBusy(false);
    }
  };

 const handlePasswordReset = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert(
        "E-Mail fehlt",
        "Bitte gib oben deine E-Mail ein, um ein neues Passwort anzufordern."
      );
      return;
    }

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      Alert.alert(
        "E-Mail gesendet",
        "Wenn ein Konto existiert, erhältst du gleich eine E-Mail zum Zurücksetzen des Passworts."
      );
    } catch (e) {
      console.error(e);
      Alert.alert(
        "Fehler",
        "Die Passwort-Zurücksetzen-E-Mail konnte nicht gesendet werden."
      );
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setPoints(0);
      setVisitHistory([]);
      setRewardClaims({});
      setRewardClaimBusy(null);
      setIsAdminView(false);
      setCustomers([]);
      setSelectedCustomer(null);
      setSelectedCustomerRewardClaims({});
      setEditPoints("");
      setCustomerSearch("");
      setPushTitle("");
      setPushBody("");
      setPushSectionExpanded(false);
      setPushUnlocked(false);
    } catch (e) {
      console.error("Fehler beim Logout:", e);
      Alert.alert("Fehler", "Logout ist fehlgeschlagen.");
    }
  };

  // -----------------------------------
  // Admin: Kunden laden & bearbeiten
  // -----------------------------------
  const loadAllCustomers = useCallback(async () => {
    if (!firebaseUser?.isAdmin) return;
    setCustomersLoading(true);

    try {
      const usersRef = collection(db, "users");
      const snap = await getDocs(usersRef);

      const list: Customer[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          name: data.name || "",
          email: data.email || "",
          points: typeof data.points === "number" ? data.points : 0,
          phone: data.phone || "",
          street: data.street || "",
          zip: data.zip || "",
          city: data.city || "",
          rewardClaims:
            data.rewardClaims && typeof data.rewardClaims === "object"
              ? data.rewardClaims
              : {},
        });
      });

      // nach Name sortieren
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(list);
    } catch (e) {
      console.error("Fehler beim Laden der Kunden:", e);
      Alert.alert("Fehler", "Kunden konnten nicht geladen werden.");
    } finally {
      setCustomersLoading(false);
    }
  }, [firebaseUser?.isAdmin]);

  // -----------------------------------
  // Admin: Kundenliste automatisch
  // laden, wenn Admin-Ansicht aktiv
  // -----------------------------------
  useEffect(() => {
    if (firebaseUser?.isAdmin && isAdminView && customers.length === 0) {
      loadAllCustomers();
    }
  }, [firebaseUser, isAdminView, customers.length, loadAllCustomers]);
  
  const handleExportCustomers = useCallback(async () => {
    if (exportBusy) return;
    if (!firebaseUser?.isAdmin) {
      Alert.alert("Fehler", "Nur Mitarbeiter können Kundendaten exportieren.");
      return;
    }

    const providedPassword = exportPasswordInput.trim();
    if (providedPassword !== EXPORT_PASSWORD) {
      setExportPasswordError("Passwort ist falsch.");
      return;
    }

    setExportPasswordError("");
    setShowExportPasswordModal(false);
    setExportBusy(true);

    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);

      const rows: string[] = [];

      rows.push(
        [
          "Name",
          "E-Mail",
          "Telefon",
          "Straße",
          "PLZ",
          "Ort",
          "Punkte",
          "Registriert am",
        ].join(";")
      );

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;

        const name = data.name || "";
        const email = data.email || "";
        const phone = data.phone || "";
        const street = data.street || "";
        const zip = data.zip || "";
        const city = data.city || "";
        const points =
          typeof data.points === "number" ? data.points.toString() : "0";
        const createdAt =
          data.createdAt && data.createdAt.toDate
            ? data.createdAt.toDate().toISOString()
            : "";

        rows.push(
          [
            name,
            email,
            phone,
            street,
            zip,
            city,
            points,
            createdAt,
          ].map((value) => `"${(value || "").replace(/"/g, '""')}"`).join(";")
        );
      });

      const csvContent = rows.join("\n");
      const fileUri = FileSystem.documentDirectory + "haarmonie-kundenexport.csv";

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Kundendaten exportieren",
        UTI: "public.comma-separated-values-text",
      });
    } catch (err) {
      console.error("Fehler beim Kundenexport:", err);
      Alert.alert(
        "Fehler",
        "Der Kundenexport konnte nicht durchgeführt werden."
      );
    } finally {
      setExportBusy(false);
      setExportPasswordInput("");
    }
  }, [exportBusy, exportPasswordInput, firebaseUser?.isAdmin]);

  const handleSelectCustomer = (c: Customer) => {
    // Toggle: bei erneutem Klick den Kunden wieder abwählen und Felder schließen
    if (selectedCustomer?.id === c.id) {
      setSelectedCustomer(null);
      setSelectedCustomerRewardClaims({});
      setEditPoints("");
      setEditEmployeeName("");
      setRewardEmployeeName("");
      setEmployeeDropdownOpen(false);
      setRewardEmployeeDropdownOpen(false);
      setRewardActionsExpanded(false);
      setCustomerEditExpanded(false);
      setCustomerEditUnlocked(false);
      setCustomerPasswordInput("");
      setCustomerPasswordError("");
      setEditCustomerName("");
      setEditCustomerEmail("");
      setEditCustomerPhone("");
      setEditCustomerStreet("");
      setEditCustomerZip("");
      setEditCustomerCity("");
      return;
    }

    setSelectedCustomer(c);
    setSelectedCustomerRewardClaims(c.rewardClaims || {});
    setEditPoints("");
    setEditEmployeeName("");
    setRewardEmployeeName("");
    setRewardEmployeeDropdownOpen(false);
    setEmployeeDropdownOpen(false);
    setRewardActionsExpanded(false);
    setCustomerEditExpanded(false);
    setCustomerEditUnlocked(false);
    setCustomerPasswordInput("");
    setCustomerPasswordError("");
    setEditCustomerName(c.name || "");
    setEditCustomerEmail(c.email || "");
    setEditCustomerPhone(c.phone || "");
    setEditCustomerStreet(c.street || "");
    setEditCustomerZip(c.zip || "");
    setEditCustomerCity(c.city || "");
  };

const registerForPushNotificationsAsync = async (uid: string) => {
  try {
    if (Constants.appOwnership === "expo") {
      console.warn("Push-Token wird in Expo Go übersprungen (nur Dev Build).");
      return;
    }
    if (!Device.isDevice) return;
    const Notifications = await import("expo-notifications");
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.warn("Push-Berechtigung verweigert");
      return;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    const userRef = doc(db, "users", uid);
    const pushRef = collection(userRef, "pushTokens");
    await setDoc(doc(pushRef, token), {
      token,
      deviceName: Device.deviceName || "",
      createdAt: serverTimestamp(),
      platform: Platform.OS,
    });
  } catch (e) {
    console.warn("Push-Token konnte nicht gespeichert werden / nicht unterstützt:", e);
  }
};

  useEffect(() => {
    if (firebaseUser?.uid) {
      registerForPushNotificationsAsync(firebaseUser.uid);
    }
  }, [firebaseUser?.uid]);

  const handleRequestPushAccess = () => {
    if (pushSectionExpanded) {
      setPushSectionExpanded(false);
      return;
    }
    if (pushUnlocked) {
      setPushSectionExpanded(true);
      return;
    }
    setPushPasswordError("");
    setPushPasswordInput("");
    setShowPushPasswordModal(true);
  };

  const handleConfirmPushPassword = () => {
    const providedPassword = pushPasswordInput.trim();
    if (providedPassword !== EXPORT_PASSWORD) {
      setPushPasswordError("Passwort ist falsch.");
      return;
    }

    setPushPasswordError("");
    setPushPasswordInput("");
    setPushUnlocked(true);
    setShowPushPasswordModal(false);
    setPushSectionExpanded(true);
  };

  const handleSendPush = async () => {
    if (!pushUnlocked) {
      handleRequestPushAccess();
      return;
    }
    if (!pushTitle.trim() || !pushBody.trim()) {
      Alert.alert("Angaben fehlen", "Bitte Titel und Nachricht ausf?llen.");
      return;
    }
    if (pushTarget === "selected" && !selectedCustomer) {
      Alert.alert("Kunde fehlt", "Bitte zuerst einen Kunden ausw?hlen.");
      return;
    }
    if (!CLOUD_FUNCTION_PUSH_URL.startsWith("https://")) {
      Alert.alert("Push-Endpoint fehlt", "Bitte CLOUD_FUNCTION_PUSH_URL konfigurieren.");
      return;
    }

    setPushBusy(true);

    try {
      const targetUserId =
        pushTarget === "selected" ? selectedCustomer?.id : undefined;
      await fetch(CLOUD_FUNCTION_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pushTitle.trim(),
          body: pushBody.trim(),
          target: pushTarget,
          userId: targetUserId,
          password: EXPORT_PASSWORD,
        }),
      });
      Alert.alert("Gesendet", "Push-Nachricht wurde ausgel?st.");
      setPushBody("");
      setPushTitle("");
    } catch (e) {
      console.error("Push senden fehlgeschlagen", e);
      Alert.alert("Fehler", "Push konnte nicht gesendet werden. Bitte Endpoint pr?fen.");
    } finally {
      setPushBusy(false);
    }
  };

const handleSaveCustomerPoints = async () => {
  if (!selectedCustomer) return;

  const raw = editPoints.replace(",", ".").trim();
  const euro = parseFloat(raw);
  const employeeName = editEmployeeName.trim();

  if (!employeeName) {
    Alert.alert(
      "Pflichtfeld fehlt",
      "Bitte Mitarbeiter/in eintragen, bevor die Buchung gespeichert wird."
    );
    return;
  }

  if (!raw || isNaN(euro) || euro <= 0) {
    Alert.alert(
      "Bitte einen gültigen Betrag in Euro eingeben (z. B. 145,00 €)."
    );
    return;
  }

  const addedPoints = Math.round(euro); // bei Cent-Beträgen runden
  const currentPoints =
    typeof selectedCustomer.points === "number" ? selectedCustomer.points : 0;
  const newPoints = currentPoints + addedPoints;

  try {
    const userRef = doc(db, "users", selectedCustomer.id);

    // Punkte beim Kundenkonto aktualisieren
    await updateDoc(userRef, { points: newPoints });

    // Besuch / Buchung in der Historie speichern
    const visitsRef = collection(userRef, "visits");
    await addDoc(visitsRef, {
      createdAt: serverTimestamp(),
      amount: euro,
      points: addedPoints,
      employeeName,
      reason: "Salonbesuch",
      source: "admin",
    });

    // Ausgewählten Kunden im State aktualisieren
    setSelectedCustomer((prev) =>
      prev && prev.id === selectedCustomer.id
        ? { ...prev, points: newPoints }
        : prev
    );

    // Kundenliste im State aktualisieren
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === selectedCustomer.id ? { ...c, points: newPoints } : c
      )
    );

    setEditPoints("");
    setEditEmployeeName("");
    Alert.alert(
      "Buchung erfolgreich",
      `${addedPoints} Punkte wurden gutgeschrieben.`
    );
  } catch (err) {
    console.error("Fehler beim Verbuchen der Punkte:", err);
    Alert.alert(
      "Fehler",
      "Die Buchung konnte nicht gespeichert werden. Bitte prüfen und erneut versuchen."
    );
  }
};

  const handleUpdateCustomerData = async () => {
    if (!selectedCustomer) return;

    const name = editCustomerName.trim();
    const email = editCustomerEmail.trim();
    const phone = editCustomerPhone.trim();
    const street = editCustomerStreet.trim();
    const zip = editCustomerZip.trim();
    const city = editCustomerCity.trim();

    if (!name || !email) {
      Alert.alert(
        "Fehlende Angaben",
        "Bitte mindestens Name und E-Mail ausfüllen."
      );
      return;
    }

    try {
      const userRef = doc(db, "users", selectedCustomer.id);

      await updateDoc(userRef, {
        name,
        email,
        phone,
        street,
        zip,
        city,
      });

      // ausgewählten Kunden im State aktualisieren
      setSelectedCustomer((prev: any) =>
        prev && prev.id === selectedCustomer.id
          ? { ...prev, name, email, phone, street, zip, city }
          : prev
      );

      // Kundenliste im State aktualisieren
      setCustomers((prev: any[]) =>
        prev.map((c) =>
          c.id === selectedCustomer.id
            ? { ...c, name, email, phone, street, zip, city }
            : c
        )
      );

      Alert.alert("Gespeichert", "Die Kundendaten wurden aktualisiert.");
    } catch (err) {
      console.error("Fehler beim Aktualisieren der Kundendaten:", err);
      Alert.alert("Fehler", "Die Kundendaten konnten nicht gespeichert werden.");
    }
  };

  const handleDeleteCustomer = () => {
    if (!selectedCustomer) return;

    Alert.alert(
      "Kunde löschen",
      `Möchtest du "${selectedCustomer.name}" wirklich dauerhaft löschen?`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            try {
              const userRef = doc(db, "users", selectedCustomer.id);
              await deleteDoc(userRef);

              setCustomers((prev: any[]) =>
                prev.filter((c) => c.id !== selectedCustomer.id)
              );

              setSelectedCustomer(null);
              setEditPoints("");
              Alert.alert("Gelöscht", "Der Kunde wurde gelöscht.");
            } catch (err) {
              console.error("Fehler beim Löschen des Kunden:", err);
              Alert.alert("Fehler", "Der Kunde konnte nicht gelöscht werden.");
            }
          },
        },
      ]
    );
  };

const handleAdminApproveRewardAction = async (action: RewardAction) => {
    if (!firebaseUser?.isAdmin || !selectedCustomer) return;

    if (!rewardEmployeeName.trim()) {
      Alert.alert(
        "Mitarbeiter auswählen",
        "Bitte Mitarbeiter auswählen, der die Punkte freigibt."
      );
      return;
    }

    const status = selectedCustomerRewardClaims[action.id];
    const pending = status === "pending";
    const alreadyClaimed = selectedCustomerRewardClaims[action.id] === true;
    if (alreadyClaimed) {
      Alert.alert("Bereits eingelöst", "Diese Aktion wurde schon gutgeschrieben.");
      return;
    }
    if (!pending) {
      Alert.alert(
        "Keine Anfrage",
        "Die Aktion wurde noch nicht vom Kunden angefragt (Punkte anfragen)."
      );
      return;
    }
    if (adminRewardBusy === action.id) return;

    const newPoints = (selectedCustomer.points || 0) + action.points;

    setAdminRewardBusy(action.id);
    try {
      const userRef = doc(db, "users", selectedCustomer.id);
      await updateDoc(userRef, {
        points: newPoints,
        [`rewardClaims.${action.id}`]: true,
      });

      const visitsRef = collection(userRef, "visits");
      await addDoc(visitsRef, {
        createdAt: serverTimestamp(),
        amount: null,
        points: action.points,
        reason: `Prämienaktion bestätigt: ${action.title}`,
        source: "reward-action-admin",
        employeeName: rewardEmployeeName.trim(),
      });

      setCustomers((prev) =>
        prev.map((c) =>
          c.id === selectedCustomer.id ? { ...c, points: newPoints } : c
        )
      );
      setSelectedCustomer((prev) =>
        prev
          ? {
              ...prev,
              points: newPoints,
              rewardClaims: {
                ...(prev.rewardClaims || {}),
                [action.id]: true,
              },
            }
          : prev
      );
      setSelectedCustomerRewardClaims((prev) => ({
        ...prev,
        [action.id]: true,
      }));

      if (selectedCustomer.id === firebaseUser.uid) {
        setPoints(newPoints);
        setRewardClaims((prev) => ({ ...prev, [action.id]: true }));
      }

      Alert.alert(
        "Punkte gutgeschrieben",
        `${action.points} Punkte wurden gutgeschrieben.`
      );
    } catch (err) {
      console.error("Fehler beim Bestätigen der Aktion:", err);
      Alert.alert("Fehler", "Die Aktion konnte nicht bestätigt werden.");
    } finally {
      setAdminRewardBusy(null);
    }
  };

  const handleClaimRewardAction = async (action: RewardAction) => {
    if (!firebaseUser) return;
    const status = rewardClaims[action.id];
    if (status === true) {
      Alert.alert("Schon eingelöst", "Diese Aktion wurde bereits bestätigt.");
      return;
    }
    if (status === "pending") {
      Alert.alert(
        "In Prüfung",
        "Diese Aktion wird noch geprüft. Bitte zeige uns deine Bewertung im Salon."
      );
      return;
    }

    setRewardClaimBusy(action.id);
    try {
      const userRef = doc(db, "users", firebaseUser.uid);
      await updateDoc(userRef, {
        [`rewardClaims.${action.id}`]: "pending",
      });
      setRewardClaims((prev) => ({ ...prev, [action.id]: "pending" }));

      if (action.url) {
        Linking.openURL(action.url).catch(() => {
          Alert.alert(
            "Link öffnen",
            "Bitte öffne den Link manuell und zeige uns danach den Nachweis im Salon."
          );
        });
      }

      Alert.alert(
        "Bitte Nachweis zeigen",
        "Öffne den Link, erledige die Aktion und zeige uns den Nachweis im Salon. Ein Mitarbeiter schaltet die Punkte dann frei."
      );
    } catch (err) {
      console.error("Fehler beim Setzen der Aktion auf pending:", err);
      Alert.alert("Fehler", "Die Prämienaktion konnte nicht gestartet werden.");
    } finally {
      setRewardClaimBusy(null);
    }
  };

  const openRewardLink = (action: RewardAction) => {
    if (!action.url) return;
    Linking.openURL(action.url).catch(() => {
      Alert.alert(
        "Link öffnen",
        "Bitte öffne den Link manuell und zeige uns danach den Nachweis im Salon."
      );
    });
  };



  // -----------------------------------
  // Rendering
  // -----------------------------------

  if (!authChecked) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Lade...</Text>
      </SafeAreaView>
    );
  }

  // --- Login-Screen ---
  if (!firebaseUser) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardOffset}
        >
          <ScrollView
            contentContainerStyle={styles.loginScroll}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
          >
          <Text style={styles.logoText}>Haarmonie by Cynthia</Text>

          <Text style={styles.loginTitle}>
            {isRegisterMode
              ? "Registriere dich für deine Bonuspunkte"
              : "Willkommen in deiner Haarmonie Friseur und Wohlfühlwelt"}
          </Text>

                    {isRegisterMode && (
            <>
              <View style={styles.loginField}>
                <Text style={styles.loginLabel}>Vorname*</Text>
                <TextInput
                  style={styles.loginInput}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="z. B. Cynthia"
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="givenName"
                  importantForAutofill="yes"
                  autoComplete="name-given"
                />
              </View>

              <View style={styles.loginField}>
                <TextInput
                  style={styles.loginInput}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="z. B. Imbrogiano"
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="familyName"
                  importantForAutofill="yes"
                  autoComplete="name-family"
                />
              </View>

              <View style={styles.loginField}>
                <TextInput
                  style={styles.loginInput}
                  value={street}
                  onChangeText={setStreet}
                  placeholder="z. B. Musterstraße 12"
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="streetAddressLine1"
                  importantForAutofill="yes"
                  autoComplete="street-address"
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={[styles.loginField, { flex: 1 }]}>
                  <Text style={styles.loginLabel}>PLZ*</Text>
                  <TextInput
                    style={styles.loginInput}
                    value={zip}
                    onChangeText={setZip}
                    placeholder="z. B. 74523"
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="postalCode"
                    importantForAutofill="yes"
                    autoComplete="postal-code"
                  />
                </View>
                <View style={[styles.loginField, { flex: 2 }]}>
                  <Text style={styles.loginLabel}>Ort*</Text>
                  <TextInput
                    style={styles.loginInput}
                    value={city}
                    onChangeText={setCity}
                    placeholder="z. B. Schwäbisch Hall"
                    autoCapitalize="words"
                    autoCorrect={false}
                    importantForAutofill="yes"
                    textContentType="addressCity"
                  />
                </View>
              </View>

              <View style={styles.loginField}>
                <Text style={styles.loginLabel}>Telefonnummer*</Text>
                <TextInput
                  style={styles.loginInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="z. B. 0176 12345678"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="telephoneNumber"
                  importantForAutofill="yes"
                  autoComplete="tel"
                />
              </View>

              <View
                style={[
                  styles.loginField,
                  { flexDirection: "row", alignItems: "center" },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.loginLabel}>
                    Zustimmung zu Push- und E-Mail-Nachrichten*
                  </Text>
                  <Text style={{ fontSize: 11, color: "#777" }}>
                    Ich bin einverstanden, dass Haarmonie by Cynthia mich zu
                    Angeboten und Terminen per App-Push und E-Mail informiert.
                  </Text>
                </View>
                <Switch
                  value={consentMarketing}
                  onValueChange={setConsentMarketing}
                  thumbColor={consentMarketing ? "#c49a6c" : "#f4f3f4"}
                  trackColor={{ false: "#ccc", true: "#f0e0cf" }}
                />
              </View>
            </>
          )}

          <View style={styles.loginField}>
            <Text style={styles.loginLabel}>E-Mail</Text>
            <TextInput
  style={styles.loginInput}
  value={email}
  onChangeText={setEmail}
  placeholder="Deine E-Mail-Adresse"
  keyboardType="email-address"
  autoCapitalize="none"
  autoCorrect={false}
  textContentType="emailAddress"
  importantForAutofill="yes"
  autoComplete="email"
/>
          </View>

          <View style={styles.loginField}>
            <Text style={styles.loginLabel}>Passwort</Text>
            <TextInput
  style={styles.loginInput}
  value={password}
  onChangeText={setPassword}
  placeholder="Passwort"
  secureTextEntry
  autoCapitalize="none"
  autoCorrect={false}
  textContentType="password"
  importantForAutofill="yes"
  autoComplete="password"
/>
          </View>

          {authError && (
            <Text style={styles.loginError}>{authError}</Text>
          )}

          <TouchableOpacity
            style={styles.adminActionButton}
            onPress={handleAuthSubmit}
            disabled={authBusy}
          >
            <Text style={styles.primaryButtonText}>
              {authBusy
                ? "Bitte warten..."
                : isRegisterMode
                ? "Registrieren"
                : "Einloggen"}
            </Text>
          </TouchableOpacity>

          {!isRegisterMode && (
            <TouchableOpacity
              style={{ marginTop: 10 }}
              onPress={handlePasswordReset}
            >
              <Text style={styles.loginLink}>Passwort vergessen?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={{ marginTop: 16 }}
            onPress={() => {
              setIsRegisterMode((m) => !m);
              setAuthError(null);
            }}
          >
            <Text style={styles.loginLink}>
              {isRegisterMode
                ? "Du hast schon ein Konto? Jetzt einloggen."
                : "Noch kein Konto? Jetzt registrieren."}
            </Text>
          </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // --- Eingeloggt: Kunde + ggf. Adminbereich ---
  const isAdmin = firebaseUser.isAdmin;
  
  const filteredCustomers = customers.filter((c) => {
    const s = customerSearch.toLowerCase();
    if (!s) return true;
    return (
      c.name.toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s)
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView
          contentContainerStyle={styles.mainScroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
        >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              Hallo {firebaseUser.name || "Schönheit"} 🌸
            </Text>
            <Text style={styles.subGreeting}>
              Eingeloggt als {firebaseUser.email}
              {isAdmin ? " (Mitarbeiterzugang)" : ""}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Admin Toggle */}
        {isAdmin && (
          <View style={styles.adminToggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                !isAdminView && styles.toggleButtonActive,
              ]}
              onPress={() => setIsAdminView(false)}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  !isAdminView && styles.toggleButtonTextActive,
                ]}
              >
                Kundensicht
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                isAdminView && styles.toggleButtonActive,
              ]}
              onPress={() => setIsAdminView(true)}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  isAdminView && styles.toggleButtonTextActive,
                ]}
              >
                Mitarbeiterbereich
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Kundensicht: eigener Punktestand + Historie (nur lesen) */}
                {/* Kundensicht: eigener Punktestand + Historie (nur lesen) */}
        {!isAdminView && (
          <>
            <View style={styles.pointsCard}>
              <Text style={styles.pointsLabel}>Dein Punktestand</Text>
              <Text style={styles.pointsValue}>{points}</Text>
              <Text style={styles.pointsHint}>
                Du sammelst bei jedem Besuch Punkte, die du gegen Verwöhnmomente
                einlösen kannst.
              </Text>

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 12 }]}
                onPress={() =>
                  router.push({
                    pathname: "/rewards",
                    params: { points: String(points) },
                  })
                }
              >
                <Text style={styles.primaryButtonText}>Prämien ansehen</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prämien-Aktionen</Text>
              {REWARD_ACTIONS.map((action) => {
                const status = rewardClaims[action.id];
                const claimed = status === true;
                const pending = status === "pending";
                const busy = rewardClaimBusy === action.id;
                const isExpanded = rewardExpandedId === action.id;

                const statusLabel = claimed
                  ? "Eingelöst"
                  : pending
                  ? "In Prüfung"
                  : "Offen";

                return (
                  <View key={action.id} style={styles.actionCard}>
                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                      onPress={() =>
                        setRewardExpandedId((prev) =>
                          prev === action.id ? null : action.id
                        )
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.actionTitle}>{action.title}</Text>
                        <Text style={styles.actionPoints}>+{action.points} Punkte</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <View
                          style={[
                            styles.statusChip,
                            claimed
                              ? styles.statusChipDone
                              : pending
                              ? styles.statusChipPending
                              : styles.statusChipOpen,
                          ]}
                        >
                          <Text style={styles.statusChipText}>{statusLabel}</Text>
                        </View>
                        <Text style={styles.dropdownChevron}>
                          {isExpanded ? "▼" : "▶"}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <>
                        <Text style={[styles.actionDescription, { marginTop: 6 }]}>
                          {action.description}
                        </Text>
                        {pending && (
                          <Text style={styles.actionPending}>
                            In Prüfung - zeige die Bewertung im Salon, damit wir sie freischalten.
                          </Text>
                        )}
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                          {action.url ? (
                            <TouchableOpacity
                              style={[styles.secondaryButton, { flex: 1 }]}
                              onPress={() => openRewardLink(action)}
                            >
                              <Text style={styles.secondaryButtonText}>Link öffnen</Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity
                            style={[
                              styles.primaryButton,
                              styles.actionButton,
                              { flex: 1 },
                              (claimed || busy || pending) && styles.actionButtonDisabled,
                            ]}
                            disabled={claimed || busy || pending}
                            onPress={() => handleClaimRewardAction(action)}
                          >
                            <Text style={styles.primaryButtonText}>
                              {claimed
                                ? "Bereits eingelöst"
                                : pending
                                ? "In Prüfung"
                                : busy
                                ? "Bitte warten"
                                : "Punkte anfragen"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Deine Besuche</Text>

              {visitHistory.length === 0 ? (
                <Text style={styles.emptyText}>
                  Noch keine Buchungen vorhanden.
                </Text>
              ) : (
                visitHistory.map((v) => {
                  const reason =
                    v.reason ||
                    (typeof v.amount === "number"
                      ? "Salonmitarbeiter"
                      : undefined);
                  const employee = v.employeeName;

                  return (
                    <View key={v.id} style={styles.visitItem}>
                      <Text style={styles.visitDate}>{v.date}</Text>
                      <Text style={styles.visitPoints}>
                        +{v.points} Punkte
                        {typeof v.amount === "number"
                          ? ` (aus ${v.amount.toFixed(2)} €)`
                          : ""}
                      </Text>
                      {reason && (
                        <Text style={styles.visitReason}>
                          Grund: {reason}
                          {employee ? ` · Mitarbeiter: ${employee}` : ""}
                        </Text>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* Admin-/Mitarbeiterbereich: Kunden verwalten */}
        {isAdmin && isAdminView && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Kundenverwaltung (nur Mitarbeiter)
            </Text>

            <View style={styles.loginField}>
              <TextInput
              style={styles.searchInput}
              value={customerSearch}
              onChangeText={setCustomerSearch}
              placeholder="Kunden suchen (Name oder E-Mail)…"
              autoCapitalize="none"
              autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.adminActionButton,
                { marginTop: 1, opacity: exportBusy ? 0.6 : 1 },
              ]}
              disabled={exportBusy}
              onPress={() => {
                setExportPasswordError("");
                setShowExportPasswordModal(true);
              }}
            >
              <Text style={styles.primaryButtonText}>
                {exportBusy
                  ? "Export läuft..."
                  : "Kundendaten exportieren"}
              </Text>
            </TouchableOpacity>


            <TouchableOpacity
              style={styles.adminActionButton}
              onPress={loadAllCustomers}
            >
              <Text style={styles.adminActionButtonText}>
                Kundendaten aktualisieren
              </Text>
            </TouchableOpacity>

      {customersLoading ? (
        <View style={{ marginTop: 12 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 4, fontSize: 12 }}>
            Kunden werden geladen...
          </Text>
        </View>
      ) : (
        <>
          {filteredCustomers.length === 0 ? (
            <Text style={[styles.emptyText, { marginTop: 12 }]}>
              Keine Kunden gefunden.
            </Text>
          ) : (
            <View style={{ marginTop: 12 }}>
              {filteredCustomers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.customerRow,
                    selectedCustomer?.id === c.id &&
                      styles.customerRowActive,
                  ]}
                  onPress={() => handleSelectCustomer(c)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>
                      {c.name || "(ohne Namen)"}
                    </Text>
                    <Text style={styles.customerEmail}>{c.email}</Text>
                  </View>
                  <Text style={styles.customerPoints}>
                    {c.points} P
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

            

                  {selectedCustomer && (
                    <>
                      {/* Punktestand bearbeiten */}
                      <View style={[styles.pointsCard, { marginTop: 20 }]}>
                        <Text style={styles.sectionTitle}>
                          Punkte verbuchen (Euro = Punkte)
                        </Text>
                        <Text style={{ fontSize: 13, marginBottom: 8 }}>
                          {selectedCustomer.name} ({selectedCustomer.email})
                        </Text>

                        <Text style={styles.loginLabel}>Mitarbeiter/in</Text>
                        <TouchableOpacity
                          style={styles.dropdownTrigger}
                          onPress={() => setEmployeeDropdownOpen((prev) => !prev)}
                        >
                          <Text style={styles.dropdownTriggerText}>
                            {editEmployeeName || "Mitarbeiter auswählen"}
                          </Text>
                          <Text style={styles.dropdownChevron}>
                            {employeeDropdownOpen ? "▼" : "▶"}
                          </Text>
                        </TouchableOpacity>
                        {employeeDropdownOpen && (
                          <View style={styles.dropdownList}>
                            {EMPLOYEE_NAMES.map((name) => (
                              <TouchableOpacity
                                key={name}
                                style={[
                                  styles.dropdownItem,
                                  editEmployeeName === name && styles.dropdownItemActive,
                                ]}
                                onPress={() => {
                                  setEditEmployeeName(name);
                                  setEmployeeDropdownOpen(false);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.dropdownItemText,
                                    editEmployeeName === name && styles.dropdownItemTextActive,
                                  ]}
                                >
                                  {name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}

                        <Text style={styles.loginLabel}>Betrag in Euro</Text>
                        <TextInput
                          style={styles.pointsInput}
                          value={editPoints}
                          onChangeText={setEditPoints}
                          placeholder="z. B. 145,00 €"
                          keyboardType="decimal-pad"
                          autoCorrect={false}
                          autoCapitalize="none"
                          textContentType="none"
                        />

                        <TouchableOpacity
                          style={[styles.adminActionButton, { marginTop: 10 }]}
                          onPress={handleSaveCustomerPoints}
                        >
                          <Text style={styles.primaryButtonText}>Punkte speichern</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.pointsCard, { marginTop: 20 }]}>
                        <TouchableOpacity
                          style={styles.accordionHeader}
                          onPress={() => setRewardActionsExpanded((prev) => !prev)}
                        >
                          <Text style={styles.sectionTitle}>Prämien-Aktionen freischalten</Text>
                          <Text style={styles.accordionChevron}>
                            {rewardActionsExpanded ? "\u25BC" : "\u25B6"}
                          </Text>
                        </TouchableOpacity>

                        {rewardActionsExpanded && (
                          <>
                            <Text style={styles.loginLabel}>Mitarbeiter/in</Text>
                            <TouchableOpacity
                              style={styles.dropdownTrigger}
                              onPress={() =>
                                setRewardEmployeeDropdownOpen((prev) => !prev)
                              }
                            >
                              <Text style={styles.dropdownTriggerText}>
                                {rewardEmployeeName || "Mitarbeiter auswählen"}
                              </Text>
                              <Text style={styles.dropdownChevron}>
                                {rewardEmployeeDropdownOpen ? "\u25BC" : "\u25B6"}
                              </Text>
                            </TouchableOpacity>
                            {rewardEmployeeDropdownOpen && (
                              <View style={styles.dropdownList}>
                                {EMPLOYEE_NAMES.map((name) => (
                                  <TouchableOpacity
                                    key={name}
                                    style={[
                                      styles.dropdownItem,
                                      rewardEmployeeName === name &&
                                        styles.dropdownItemActive,
                                    ]}
                                    onPress={() => {
                                      setRewardEmployeeName(name);
                                      setRewardEmployeeDropdownOpen(false);
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.dropdownItemText,
                                        rewardEmployeeName === name &&
                                          styles.dropdownItemTextActive,
                                      ]}
                                    >
                                      {name}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}

                            {REWARD_ACTIONS.map((action) => {
                              const status = selectedCustomerRewardClaims[action.id];
                              const claimed = status === true;
                              const pending = status === "pending";
                              const busy = adminRewardBusy === action.id;
                              const disabled = claimed || busy || !pending;
                              const approveLabel = claimed
                                ? "Schon gutgeschrieben"
                                : busy
                                ? "Bitte warten..."
                                : pending
                                ? "Bestätigen & Punkte geben"
                                : "Noch nicht angefragt";
                              return (
                                <View key={action.id} style={{ marginBottom: 12 }}>
                                  <Text style={styles.actionTitle}>{action.title}</Text>
                                  <Text style={styles.actionDescription}>{action.description}</Text>
                                  <Text style={styles.actionPoints}>+{action.points} Punkte</Text>
                                  <TouchableOpacity
                                    style={[
                                      styles.adminActionButton,
                                      styles.actionButton,
                                      pending && styles.adminActionButtonPending,
                                      disabled && styles.actionButtonDisabled,
                                      { marginTop: 6 },
                                    ]}
                                    disabled={disabled}
                                    onPress={() => handleAdminApproveRewardAction(action)}
                                  >
                                    <Text style={styles.primaryButtonText}>
                                      {approveLabel}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </>
                        )}
                      </View>

                      {/* Kundendaten bearbeiten */}
                      <View style={[styles.pointsCard, { marginTop: 20 }]}>
                        <TouchableOpacity
                          style={styles.accordionHeader}
                          onPress={() => {
                            if (!customerEditUnlocked) {
                              setCustomerPasswordError("");
                              setCustomerPasswordInput("");
                              setShowCustomerPasswordModal(true);
                              return;
                            }
                            setCustomerEditExpanded((prev) => !prev);
                          }}
                        >
                          <Text style={styles.sectionTitle}>Kundendaten bearbeiten</Text>
                          <Text style={styles.accordionChevron}>
                            {customerEditExpanded ? "▼" : "▶"}
                          </Text>
                        </TouchableOpacity>

                        {customerEditExpanded && (
                          <>
                            <Text style={styles.loginLabel}>Name</Text>
                            <TextInput
                              style={styles.loginInput}
                              value={editCustomerName}
                              onChangeText={setEditCustomerName}
                              placeholder="Name"
                              autoCapitalize="words"
                              autoCorrect={false}
                            />

                            <Text style={styles.loginLabel}>E-Mail</Text>
                            <TextInput
                              style={styles.loginInput}
                              value={editCustomerEmail}
                              onChangeText={setEditCustomerEmail}
                              placeholder="E-Mail"
                              keyboardType="email-address"
                              autoCapitalize="none"
                              autoCorrect={false}
                              textContentType="emailAddress"
                              autoComplete="email"
                            />

                            <Text style={styles.loginLabel}>Telefon</Text>
                            <TextInput
                              style={styles.loginInput}
                              value={editCustomerPhone}
                              onChangeText={setEditCustomerPhone}
                              placeholder="Telefonnummer"
                              keyboardType="phone-pad"
                              autoCapitalize="none"
                              autoCorrect={false}
                              textContentType="telephoneNumber"
                              autoComplete="tel"
                            />

                            <Text style={styles.loginLabel}>Straße & Hausnummer</Text>
                            <TextInput
                              style={styles.loginInput}
                              value={editCustomerStreet}
                              onChangeText={setEditCustomerStreet}
                              placeholder="Straße & Hausnummer"
                              autoCapitalize="words"
                              autoCorrect={false}
                            />

                            <Text style={styles.loginLabel}>PLZ</Text>
                            <TextInput
                              style={styles.loginInput}
                              value={editCustomerZip}
                              onChangeText={setEditCustomerZip}
                              placeholder="PLZ"
                              keyboardType="number-pad"
                              autoCapitalize="none"
                              autoCorrect={false}
                            />

                            <Text style={styles.loginLabel}>Ort</Text>
                            <TextInput
                              style={styles.loginInput}
                              value={editCustomerCity}
                              onChangeText={setEditCustomerCity}
                              placeholder="Ort"
                              autoCapitalize="words"
                              autoCorrect={false}
                            />

                            <TouchableOpacity
                              style={[styles.adminActionButton, { marginTop: 16 }]}
                              onPress={handleUpdateCustomerData}
                            >
                              <Text style={styles.primaryButtonText}>Kundendaten speichern</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.dangerButton, { marginTop: 10 }]}
                              onPress={handleDeleteCustomer}
                            >
                              <Text style={styles.dangerButtonText}>Kunde löschen</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </>
                  )}
          </View>
        )}

        {isAdmin && isAdminView && (
          <>
            {/* Push-Nachricht senden */}
            <View style={[styles.pointsCard, { marginTop: 1 }]}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={handleRequestPushAccess}
              >
                <Text style={styles.sectionTitle}>Push-Nachricht senden</Text>
                <Text style={styles.accordionChevron}>
                  {pushSectionExpanded ? "\u25BC" : "\u25B6"}
                </Text>
              </TouchableOpacity>

              {pushSectionExpanded && (
                <>
                  <Text style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
                    Senden an ausgewählten Kunden oder alle Kunden
                  </Text>
                  <Text style={styles.loginLabel}>Titel</Text>
                  <TextInput
                    style={styles.loginInput}
                    value={pushTitle}
                    onChangeText={setPushTitle}
                    placeholder="Titel"
                  />

                  <Text style={styles.loginLabel}>Nachricht</Text>
                  <TextInput
                    style={[styles.loginInput, { height: 80 }]}
                    value={pushBody}
                    onChangeText={setPushBody}
                    placeholder="Nachrichtentext"
                    multiline
                  />

                  <View style={{ flexDirection: "row", marginTop: 10 }}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        pushTarget === "selected" && styles.toggleButtonActive,
                        { flex: 1, marginRight: 6 },
                      ]}
                      onPress={() => setPushTarget("selected")}
                    >
                      <Text
                        style={[
                          styles.toggleButtonText,
                          pushTarget === "selected" && styles.toggleButtonTextActive,
                        ]}
                      >
                        Ausgewaehlter Kunde
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        pushTarget === "all" && styles.toggleButtonActive,
                        { flex: 1, marginLeft: 6 },
                      ]}
                      onPress={() => setPushTarget("all")}
                    >
                      <Text
                        style={[
                          styles.toggleButtonText,
                          pushTarget === "all" && styles.toggleButtonTextActive,
                        ]}
                      >
                        Alle Kunden
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.adminActionButton,
                      { marginTop: 12, opacity: pushBusy ? 0.6 : 1 },
                    ]}
                    disabled={pushBusy}
                    onPress={handleSendPush}
                  >
                    <Text style={styles.primaryButtonText}>
                      {pushBusy ? "Sende..." : "Push senden"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showPushPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPushPasswordModal(false);
          setPushPasswordError("");
          setPushPasswordInput("");
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Passwort erforderlich</Text>
            <Text style={styles.modalText}>
              Bitte Admin-Passwort eingeben, um eine Push-Nachricht zu senden.
            </Text>

            <TextInput
              style={styles.loginInput}
              value={pushPasswordInput}
              onChangeText={setPushPasswordInput}
              placeholder="Passwort"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {pushPasswordError ? (
              <Text style={styles.loginError}>{pushPasswordError}</Text>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowPushPasswordModal(false);
                  setPushPasswordError("");
                  setPushPasswordInput("");
                }}
              >
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { marginLeft: 10, opacity: pushBusy ? 0.6 : 1 },
                ]}
                disabled={pushBusy}
                onPress={handleConfirmPushPassword}
              >
                <Text style={styles.primaryButtonText}>
                  {pushBusy ? "Bitte warten..." : "Bestätigen"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showExportPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportPasswordModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Passwort für Export</Text>
            <Text style={styles.modalText}>
              Bitte das Mitarbeiter-Passwort eingeben, um den Export zu starten.
            </Text>

            <TextInput
              style={styles.loginInput}
              value={exportPasswordInput}
              onChangeText={setExportPasswordInput}
              placeholder="Passwort"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {exportPasswordError ? (
              <Text style={styles.loginError}>{exportPasswordError}</Text>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowExportPasswordModal(false);
                  setExportPasswordError("");
                  setExportPasswordInput("");
                }}
              >
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { opacity: exportBusy ? 0.6 : 1, marginLeft: 10 },
                ]}
                disabled={exportBusy}
                onPress={handleExportCustomers}
              >
                <Text style={styles.primaryButtonText}>
                  {exportBusy ? "Bitte warten..." : "Export starten"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCustomerPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCustomerPasswordModal(false);
          setCustomerPasswordError("");
          setCustomerPasswordInput("");
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Passwort erforderlich</Text>
            <Text style={styles.modalText}>
              Bitte Admin-Passwort eingeben, um Kundendaten zu bearbeiten.
            </Text>

            <TextInput
              style={styles.loginInput}
              value={customerPasswordInput}
              onChangeText={setCustomerPasswordInput}
              placeholder="Passwort"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {customerPasswordError ? (
              <Text style={styles.loginError}>{customerPasswordError}</Text>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowCustomerPasswordModal(false);
                  setCustomerPasswordError("");
                  setCustomerPasswordInput("");
                }}
              >
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { marginLeft: 10 }]}
                onPress={() => {
                  if (customerPasswordInput.trim() !== EXPORT_PASSWORD) {
                    setCustomerPasswordError("Passwort ist falsch.");
                    return;
                  }
                  setCustomerPasswordError("");
                  setCustomerPasswordInput("");
                  setShowCustomerPasswordModal(false);
                  setCustomerEditUnlocked(true);
                  setCustomerEditExpanded(true);
                }}
              >
                <Text style={styles.primaryButtonText}>Freischalten</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// -----------------------------------
// Styles
// -----------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF7F2",
  },
  loginScroll: {
    padding: 20,
    paddingTop: 40,
  },
  mainScroll: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  logoText: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
    color: "#c49a6c",
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 24,
    color: "#333",
  },
  loginField: {
    marginBottom: 14,
  },
  loginLabel: {
    fontSize: 13,
    marginBottom: 4,
    color: "#555",
  },
  loginInput: {
    borderWidth: 1,
    borderColor: "#e1d3c5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    fontSize: 14,
  },
  loginError: {
    marginTop: 4,
    marginBottom: 6,
    fontSize: 13,
    color: "#b3261e",
  },
  loginLink: {
    fontSize: 13,
    color: "#c49a6c",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  primaryButton: {
    backgroundColor: "#c49a6c",
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  smallButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#c49a6c",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  smallButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  greeting: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  subGreeting: {
    fontSize: 12,
    color: "#777",
  },
  logoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e1d3c5",
    backgroundColor: "#fff",
  },
  logoutButtonText: {
    fontSize: 12,
    color: "#555",
    fontWeight: "500",
  },
  pointsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  pointsLabel: {
    fontSize: 14,
    color: "#777",
    marginBottom: 8,
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#c49a6c",
  },
  pointsHint: {
    marginTop: 8,
    fontSize: 13,
    color: "#777",
  },
  section: {
    marginTop: 4,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    color: "#333",
  },
  emptyText: {
    fontSize: 13,
    color: "#777",
  },
  visitItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eaded1",
  },
  visitDate: {
    fontSize: 12,
    color: "#777",
    marginBottom: 2,
  },
  visitPoints: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  visitReason: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  adminToggleRow: {
    flexDirection: "row",
    backgroundColor: "#f1e3d5",
    borderRadius: 999,
    padding: 4,
    marginBottom: 14,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  toggleButtonText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
  },
  toggleButtonTextActive: {
    color: "#c49a6c",
    fontWeight: "600",
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eaded1",
  },
  customerRowActive: {
    backgroundColor: "#f3e5d0",
    borderRadius: 8,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  customerEmail: {
    fontSize: 12,
    color: "#777",
  },
  customerPoints: {
    fontSize: 13,
    fontWeight: "600",
    color: "#c49a6c",
    marginLeft: 8,
  },
  actionCard: {
    flexDirection: "column",
    alignItems: "stretch",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 10,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  actionDescription: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
  },
  actionPoints: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#c49a6c",
  },
  actionPending: {
    marginTop: 6,
    fontSize: 11,
    color: "#a87132",
  },
  actionButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 4,
  },
  statusChipOpen: {
    backgroundColor: "#f5e8d7",
  },
  statusChipPending: {
    backgroundColor: "#fff4d6",
  },
  statusChipDone: {
    backgroundColor: "#d7f5e2",
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5c4632",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#c49a6c",
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  secondaryButtonText: {
    color: "#c49a6c",
    fontWeight: "600",
    fontSize: 14,
  },
    dangerButton: {
    backgroundColor: "#c0392b",
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  pointsInput: {
    borderWidth: 1,
    borderColor: "#d1b08a",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: "#333",
    marginTop: 6,
  },
  employeeChipsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
  },
  employeeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1b08a",
    backgroundColor: "#fff",
    marginRight: 8,
    marginBottom: 8,
  },
  employeeChipActive: {
    backgroundColor: "#c49a6c",
    borderColor: "#c49a6c",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  employeeChipText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
  },
  employeeChipTextActive: {
    color: "#fff",
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: "#d1b08a",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  dropdownTriggerText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownChevron: {
    fontSize: 14,
    color: "#777",
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: "#d1b08a",
    borderRadius: 10,
    backgroundColor: "#fff",
    marginTop: 6,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eaded1",
  },
  dropdownItemActive: {
    backgroundColor: "#f3e5d0",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownItemTextActive: {
    color: "#a06f34",
    fontWeight: "600",
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  accordionChevron: {
    fontSize: 16,
    color: "#555",
    fontWeight: "600",
  },
  adminActionButton: {
  backgroundColor: "#c49a6c",
  borderRadius: 999,
  paddingVertical: 12,
  paddingHorizontal: 16,
  alignItems: "center",
  justifyContent: "center",
  width: "100%",        // <- macht beide gleich breit
  marginBottom: 10,
},
adminActionButtonPending: {
  backgroundColor: "#2e8b57",
},
adminActionButtonText: {
  color: "#fff",
  fontSize: 14,
  fontWeight: "600",
},
  searchInput: {
  borderWidth: 1,
  borderColor: "#caaa85",
  borderRadius: 10,
  backgroundColor: "#fff",
  padding: 12,
  fontSize: 16,
  color: "#000",
  marginTop: 8,
  marginBottom: 10
},
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  modalText: {
    fontSize: 13,
    color: "#555",
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  modalButton: {
    backgroundColor: "#c49a6c",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e1d3c5",
  },
  modalCancelText: {
    color: "#555",
    fontWeight: "600",
    fontSize: 14,
  }
});
