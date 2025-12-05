// app/(tabs)/index.tsx

import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import LottieView from "lottie-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
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
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
} from "firebase/auth";

import AuthForm from "../../components/AuthForm";
import CustomerHome from "../../components/CustomerHome";
import { useAuthFormState } from "../../hooks/useAuthFormState";
import { auth, db, functions as fbFunctions } from "../../src/firebaseConfig";
import {
  defaultBirthDate,
  getBirthDayMonth,
  normalizeBirthDate,
  parseBirthDate,
} from "../../utils/birthDate";

const VERIFY_ADMIN_PASSWORD_URL =
  "https://us-central1-haarmonie-bonus.cloudfunctions.net/verifyAdminPasswordHttp";

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

const DEFAULT_REWARD_ACTIONS: RewardAction[] = [
  {
    id: "google-review",
    title: "5-Sterne Google Bewertung",
    description: "Bewerte uns mit 5 Sternen auf Google und erhalte",
    points: 50,
    url: "https://g.page/r/Cf0hqXnNeVkAEAE/review",
    active: true,
    order: 1,
  },
  {
    id: "facebook-follow",
    title: "Facebook folgen",
    description: "Folge uns auf Facebook und erhalte",
    points: 30,
    url: "https://www.facebook.com/haarmoniebycynthia",
    active: true,
    order: 2,
  },
  {
    id: "instagram-follow",
    title: "Instagram folgen",
    description: "Folge uns auf Instagram und erhalte",
    points: 30,
    url: "https://www.instagram.com/haarmonie_by_cynthia",
    active: true,
    order: 3,
  },
];

const PUSH_INFO_STORAGE_KEY = "haarmonie:lastPushInfo";
const PUSH_INFO_TTL_MS = 24 * 60 * 60 * 1000;

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
  dateOfBirth?: string;
  birthDay?: number;
  birthMonth?: number;
  birthdayVoucherAvailable?: boolean;
  birthdayVoucherYear?: number;
  birthdayVoucherRedeemedYear?: number;
  lastBirthdayGiftYear?: number;
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
  active?: boolean;
  order?: number;
  startDate?: string;
  endDate?: string;
};

type RewardRedemption = {
  id: string;
  rewardId: string;
  title: string;
  pointsRequired: number;
  status: "pending" | "approved";
  createdAt?: string;
  employeeName?: string;
};

// >>> Prämienliste <<<
export default function BonusApp() {
  // --- Auth-Status ---
  const router = useRouter();
  const keyboardOffset = Platform.OS === "ios" ? 10 : 80;
  const [showIntro, setShowIntro] = useState(true);
  const {
    authChecked,
    setAuthChecked,
    authBusy,
    setAuthBusy,
    authError,
    setAuthError,
    authNotice,
    setAuthNotice,
    verificationEmail,
    setVerificationEmail,
    verificationEmailTimestampRef,
    isRegisterMode,
    setIsRegisterMode,
    email,
    setEmail,
    password,
    setPassword,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    birthDate,
    setBirthDate,
    street,
    setStreet,
    zip,
    setZip,
    city,
    setCity,
    phone,
    setPhone,
    consentMarketing,
    setConsentMarketing,
    birthDatePickerVisible,
    setBirthDatePickerVisible,
    birthDatePickerDate,
    setBirthDatePickerDate,
    birthDatePickerTarget,
    setBirthDatePickerTarget,
    resetAuthFeedback,
  } = useAuthFormState();

  const [firebaseUser, setFirebaseUser] = useState<{
    uid: string;
    email: string;
    name: string;
    isAdmin: boolean;
  } | null>(null);

  // Kundensicht (eigene Punkte)
  const [points, setPoints] = useState(0);
  const [visitHistory, setVisitHistory] = useState<Visit[]>([]);
  const [rewardClaims, setRewardClaims] = useState<Record<string, string | boolean>>({});
  const [rewardClaimBusy, setRewardClaimBusy] = useState<string | null>(null);
  const [rewardExpandedId, setRewardExpandedId] = useState<string | null>(null);
  const [birthdayVoucherAvailable, setBirthdayVoucherAvailable] = useState(false);
  const [birthdayVoucherYear, setBirthdayVoucherYear] = useState<number | null>(null);
  const [rewardActions, setRewardActions] = useState<RewardAction[]>([]);
  const [rewardActionsLoading, setRewardActionsLoading] = useState(false);
  const [rewardActionsExpanded, setRewardActionsExpanded] = useState(false);
  const hasSeededRewardActions = useRef(false);
  const [selectedCustomerRewardClaims, setSelectedCustomerRewardClaims] = useState<
    Record<string, string | boolean>
  >({});
  const [adminRewardBusy, setAdminRewardBusy] = useState<string | null>(null);
  const [adminBirthdayBusy, setAdminBirthdayBusy] = useState(false);
  const [selectedCustomerRedemptions, setSelectedCustomerRedemptions] = useState<
    RewardRedemption[]
  >([]);
  const [redemptionBusyId, setRedemptionBusyId] = useState<string | null>(null);
  const [redemptionEmployeeName, setRedemptionEmployeeName] = useState("");

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
  const [redemptionsExpanded, setRedemptionsExpanded] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState<string>("");
  const [editCustomerEmail, setEditCustomerEmail] = useState<string>("");
  const [editCustomerDateOfBirth, setEditCustomerDateOfBirth] = useState<string>("");
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>("");
  const [editCustomerStreet, setEditCustomerStreet] = useState<string>("");
  const [editCustomerZip, setEditCustomerZip] = useState<string>("");
  const [editCustomerCity, setEditCustomerCity] = useState<string>("");
  const [customerEditExpanded, setCustomerEditExpanded] = useState(false);
  const [customerEditUnlocked, setCustomerEditUnlocked] = useState(false);
  const [showCustomerPasswordModal, setShowCustomerPasswordModal] = useState(false);
  const [customerPasswordInput, setCustomerPasswordInput] = useState("");
  const [customerPasswordError, setCustomerPasswordError] = useState("");
  const [showExportPasswordModal, setShowExportPasswordModal] = useState(false);
  const [exportPasswordInput, setExportPasswordInput] = useState("");
  const [exportPasswordError, setExportPasswordError] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [showPushPasswordModal, setShowPushPasswordModal] = useState(false);
  const [pushPasswordInput, setPushPasswordInput] = useState("");
  const [pushPasswordError, setPushPasswordError] = useState("");
  const [showPushPassword, setShowPushPassword] = useState(false);
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [showCustomerPassword, setShowCustomerPassword] = useState(false);
  const [pushInfo, setPushInfo] = useState<{
    title: string;
    body: string;
    timestamp: number;
  } | null>(null);
  const [showAllVisits, setShowAllVisits] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);
  const clearPushInfo = useCallback(async () => {
    setPushInfo(null);
    try {
      await AsyncStorage.removeItem(PUSH_INFO_STORAGE_KEY);
    } catch (e) {
      console.warn("PushInfo löschen fehlgeschlagen:", e);
    }
  }, []);

  const persistPushInfo = useCallback(
    async (info: { title: string; body: string; timestamp: number }) => {
      setPushInfo(info);
      try {
        await AsyncStorage.setItem(PUSH_INFO_STORAGE_KEY, JSON.stringify(info));
      } catch (e) {
        console.warn("PushInfo speichern fehlgeschlagen:", e);
      }
    },
    []
  );

  const updatePushInfoFromContent = useCallback(
    (content: any) => {
      if (!content) return;
      const info = {
        title: content.title || "Haarmonie by Cynthia",
        body: content.body || "Neue Nachricht",
        timestamp: Date.now(),
      };
      persistPushInfo(info);
    },
    [persistPushInfo]
  );

  const loadServerPushInfo = useCallback(
    async (uid?: string | null) => {
      try {
        const messagesRef = collection(db, "pushMessages");
        const snap = await getDocs(
          query(messagesRef, orderBy("createdAt", "desc"), limit(20))
        );
        const now = Date.now();
        for (const docSnap of snap.docs) {
          const data = docSnap.data() as any;
          const ts = data?.createdAt?.toDate?.() ? data.createdAt.toDate().getTime() : 0;
          if (!ts || now - ts > PUSH_INFO_TTL_MS) continue;
          const target = data?.target || "all";
          const matchesTarget =
            target === "all" || (target === "selected" && uid && data?.userId === uid);
          if (!matchesTarget) continue;
          persistPushInfo({
            title: data?.title || "Haarmonie by Cynthia",
            body: data?.body || "Neue Nachricht",
            timestamp: ts,
          });
          break;
        }
      } catch (e) {
        console.warn("Server PushInfo laden fehlgeschlagen:", e);
      }
    },
    [persistPushInfo]
  );

  useEffect(() => {
    if (!firebaseUser?.uid) return undefined;
    const messagesRef = collection(db, "pushMessages");
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(20));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const now = Date.now();
        for (const docSnap of snap.docs) {
          const data = docSnap.data() as any;
          const ts = data?.createdAt?.toDate?.() ? data.createdAt.toDate().getTime() : 0;
          if (!ts || now - ts > PUSH_INFO_TTL_MS) continue;
          const target = data?.target || "all";
          const matchesTarget =
            target === "all" ||
            (target === "selected" && firebaseUser?.uid && data?.userId === firebaseUser.uid);
          if (!matchesTarget) continue;
          persistPushInfo({
            title: data?.title || "Haarmonie by Cynthia",
            body: data?.body || "Neue Nachricht",
            timestamp: ts,
          });
          break;
        }
      },
      (err) => console.warn("PushInfo Snapshot Fehler:", err)
    );
    return () => unsub();
  }, [firebaseUser?.uid, persistPushInfo]);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 3200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PUSH_INFO_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const ts = typeof parsed?.timestamp === "number" ? parsed.timestamp : 0;
        if (!ts || Date.now() - ts >= PUSH_INFO_TTL_MS) {
          await clearPushInfo();
          return;
        }
        setPushInfo({
          title: parsed?.title || "Haarmonie by Cynthia",
          body: parsed?.body || "",
          timestamp: ts,
        });
      } catch (e) {
        console.warn("PushInfo laden fehlgeschlagen:", e);
      }
    })();
  }, [clearPushInfo]);

  useEffect(() => {
    const handleNotification = (notification: any) => {
      const content = notification?.request?.content;
      updatePushInfoFromContent(content);
    };

    const checkLastNotification = async () => {
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse?.notification?.request?.content) {
          updatePushInfoFromContent(lastResponse.notification.request.content);
          return;
        }
        const presented = await Notifications.getPresentedNotificationsAsync();
        if (presented && presented.length > 0) {
          const latest = presented[0];
          updatePushInfoFromContent(latest?.request?.content);
        }
      } catch (e) {
        console.warn("Letzte Notification abrufen fehlgeschlagen:", e);
      }
    };

    checkLastNotification();

    const receivedSub = Notifications.addNotificationReceivedListener(handleNotification);
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) =>
      handleNotification(response.notification)
    );

    const appStateListener = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        checkLastNotification();
      }
      appState.current = nextState;
    });

    return () => {
      receivedSub?.remove();
      responseSub?.remove();
      appStateListener?.remove();
    };
  }, [updatePushInfoFromContent]);

  useEffect(() => {
    if (!pushInfo) return undefined;
    const age = Date.now() - pushInfo.timestamp;
    const remaining = PUSH_INFO_TTL_MS - age;
    if (remaining <= 0) {
      clearPushInfo();
      return undefined;
    }
    const timer = setTimeout(() => {
      clearPushInfo();
    }, remaining);
    return () => clearTimeout(timer);
  }, [pushInfo, clearPushInfo]);

useEffect(() => {
  if (selectedCustomer) {
    setEditCustomerName(selectedCustomer.name || "");
    setEditCustomerEmail(selectedCustomer.email || "");
    setEditCustomerDateOfBirth(selectedCustomer.dateOfBirth || "");
    setEditCustomerPhone(selectedCustomer.phone || "");
    setEditCustomerStreet(selectedCustomer.street || "");
    setEditCustomerZip(selectedCustomer.zip || "");
    setEditCustomerCity(selectedCustomer.city || "");
  } else {
    setEditCustomerName("");
    setEditCustomerEmail("");
    setEditCustomerDateOfBirth("");
    setEditCustomerPhone("");
    setEditCustomerStreet("");
    setEditCustomerZip("");
    setEditCustomerCity("");
  }
}, [selectedCustomer]);

  useEffect(() => {
    if (!selectedCustomer) {
      setSelectedCustomerRedemptions([]);
      return undefined;
    }

    const userRef = doc(db, "users", selectedCustomer.id);
    const redemptionsRef = collection(userRef, "rewardRedemptions");
    const q = query(redemptionsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: RewardRedemption[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          items.push({
            id: docSnap.id,
            rewardId: typeof d.rewardId === "string" ? d.rewardId : "",
            title: typeof d.title === "string" ? d.title : "",
            pointsRequired:
              typeof d.pointsRequired === "number" ? d.pointsRequired : 0,
            status: d.status === "approved" ? "approved" : "pending",
            createdAt: d.createdAt?.toDate
              ? d.createdAt.toDate().toLocaleString()
              : "",
            employeeName:
              typeof d.employeeName === "string" ? d.employeeName : undefined,
          });
        });
        setSelectedCustomerRedemptions(items);
      },
      (err) => console.error("Live-Update rewardRedemptions Fehler:", err)
    );

    return () => unsub();
  }, [selectedCustomer]);


    // Hilfsfunktion: prüfen, ob E-Mail admin ist
  const isEmailAdmin = (mail: string | null | undefined) => {
    if (!mail) return false;
    return ALLOWED_ADMINS.includes(mail.toLowerCase());
  };

  const remindEmailVerification = useCallback(
    (targetEmail: string) => {
      const normalized = targetEmail.trim().toLowerCase();
      const target = normalized || "deine E-Mail-Adresse";
      setVerificationEmail(normalized || null);
      setAuthError(null);
      setAuthNotice(
        `Bitte bestätige deine E-Mail-Adresse. Wir haben dir eine Mail an ${target} geschickt. Prüfe dein Postfach (auch Spam) und tippe danach erneut auf "Einloggen".`
      );
    },
    [setAuthError, setAuthNotice, setVerificationEmail]
  );

  const VERIFICATION_RESEND_COOLDOWN_MS = 5 * 60 * 1000; // 5 Minuten zwischen erneuten Verifizierungs-Mails

  const computeBirthdayVoucherState = (data: any) => {
    const nowYear = new Date().getFullYear();
    const voucherAvailable = data?.birthdayVoucherAvailable === true;
    const voucherYear =
      typeof data?.birthdayVoucherYear === "number" ? data.birthdayVoucherYear : null;
    const redeemedYear =
      typeof data?.birthdayVoucherRedeemedYear === "number"
        ? data.birthdayVoucherRedeemedYear
        : null;
    const lastGiftYear =
      typeof data?.lastBirthdayGiftYear === "number" ? data.lastBirthdayGiftYear : null;

    // Fallback: wenn keine Flags, aber Geschenk dieses Jahr gesendet und nicht eingelöst
    const derivedAvailable =
      voucherAvailable ||
      (!!lastGiftYear &&
        lastGiftYear === nowYear &&
        (voucherYear === null || voucherYear === nowYear) &&
        redeemedYear !== nowYear);

    return {
      available: derivedAvailable,
      year: voucherYear ?? lastGiftYear ?? null,
      redeemedYear,
    };
  };

  const verifyAdminPassword = useCallback(async (input: string) => {
    const pwd = input.trim();
    if (!pwd) {
      throw new Error("PASSWORD_REQUIRED");
    }
    const resp = await fetch(VERIFY_ADMIN_PASSWORD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    if (!resp.ok) {
      throw new Error("INVALID_PASSWORD");
    }
    return resp.json();
  }, []);

  const formatBirthDateFromDate = (d: Date) => {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // -----------------------------------
  // Kundendaten (eigener User) laden
  // -----------------------------------
  const loadUserData = useCallback(
    async (uid: string, fallbackEmail: string) => {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      let nameFromDb = "";
      let pointsFromDb = 50;
      let claimsFromDb: Record<string, string | boolean> = {};
      let voucherAvailable = false;
      let voucherYear: number | null = null;

      if (snap.exists()) {
        const data = snap.data() as any;
        const combinedName = `${data.firstName || ""} ${data.lastName || ""}`.trim();

        nameFromDb = data.name || combinedName || "";
        pointsFromDb = typeof data.points === "number" ? data.points : 0;
        claimsFromDb =
          data.rewardClaims && typeof data.rewardClaims === "object"
            ? data.rewardClaims
            : {};
        const voucher = computeBirthdayVoucherState(data);
        voucherAvailable = voucher.available;
        voucherYear = voucher.year;
      } else {
        console.error("Kein Benutzer-Profil in Firestore gefunden. UID:", uid);
        throw new Error("USER_PROFILE_MISSING");
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
      setBirthdayVoucherAvailable(voucherAvailable);
      setBirthdayVoucherYear(voucherYear);

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
          if (!user.emailVerified) {
            const lowerMail = (user.email || "").toLowerCase();
            let sent = false;
            const now = Date.now();
            const lastSentTs = verificationEmailTimestampRef.current;
            const sameMail = verificationEmail && verificationEmail === lowerMail;
            const withinCooldown =
              typeof lastSentTs === "number" && now - lastSentTs < VERIFICATION_RESEND_COOLDOWN_MS;

            if (!sameMail) {
              verificationEmailTimestampRef.current = null;
            }

            if (!sameMail && !withinCooldown) {
              try {
                await sendEmailVerification(user);
                sent = true;
                verificationEmailTimestampRef.current = now;
              } catch (err) {
                console.error("Verifizierungs-Mail konnte nicht gesendet werden:", err);
                if ((err as any)?.code === "auth/too-many-requests") {
                  setAuthError(
                    "Zu viele Verifizierungsversuche. Bitte warte einige Minuten, prüfe dein Postfach und versuche es erneut."
                  );
                } else {
                  setAuthError("Verifizierungs-E-Mail konnte nicht gesendet werden.");
                }
              }
            } else if (withinCooldown) {
              setAuthError(
                "Verifizierungs-E-Mail wurde gerade erst gesendet. Bitte warte ein paar Minuten, prüfe dein Postfach und versuche es erneut."
              );
            }
            if (sent || (verificationEmail && verificationEmail === lowerMail)) {
              remindEmailVerification(user.email || "");
            }
            await signOut(auth);
            return;
          }

        setAuthNotice(null);
        setVerificationEmail(null);
        await loadUserData(user.uid, user.email || "");
      } else {
        setFirebaseUser(null);
        setPoints(0);
        setVisitHistory([]);
      }
      } catch (e: any) {
        console.error("Fehler beim Wiederanmelden:", e);
        if (e?.message === "USER_PROFILE_MISSING") {
          setAuthError(
            "Dein Profil ist unvollständig. Bitte registriere dich erneut oder melde dich beim Team."
          );
          await signOut(auth);
        } else {
          setAuthError("Automatisches Anmelden fehlgeschlagen. Bitte erneut versuchen.");
        }
      } finally {
        setAuthChecked(true);
      }
    });

    return () => unsub();
  }, [
    loadUserData,
    verificationEmail,
    remindEmailVerification,
    VERIFICATION_RESEND_COOLDOWN_MS,
    setAuthChecked,
    setAuthNotice,
    setVerificationEmail,
    verificationEmailTimestampRef,
    setAuthError,
  ]);

  // -----------------------------------
  // Live-Updates für User-Daten
  // -----------------------------------
  useEffect(() => {
    if (!firebaseUser?.uid) return undefined;
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
  }, [firebaseUser?.uid, firebaseUser?.name, firebaseUser?.email]);

  // -----------------------------------
  // Reward-Aktionen laden (Firestore)
  // -----------------------------------
  useEffect(() => {
    if (!firebaseUser) {
      setRewardActions([]);
      return undefined;
    }

    const actionsRef = collection(db, "rewardActions");
    const qActions = query(
      actionsRef,
      orderBy("order", "asc"),
      orderBy("createdAt", "desc")
    );

    setRewardActionsLoading(true);
    const unsub = onSnapshot(
      qActions,
      async (snap) => {
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

        if (snap.empty && !hasSeededRewardActions.current) {
          hasSeededRewardActions.current = true;
          try {
            await seedDefaultRewardActions(actionsRef);
          } catch (err) {
            console.error("Seed Reward-Aktionen fehlgeschlagen:", err);
          }
        }
      },
      (err) => {
        console.error("Reward-Aktionen konnten nicht geladen werden:", err);
        setRewardActionsLoading(false);
      }
    );

    return () => unsub();
  }, [firebaseUser]);

  const handleSendAppFeedback = async () => {
    const message = feedbackMessage.trim();
    if (!message) {
      Alert.alert("Feedback fehlt", "Bitte dein Feedback eintragen.");
      return;
    }
    const user = auth.currentUser;
    const email = firebaseUser?.email || user?.email || "unbekannt";
    setFeedbackBusy(true);
    try {
      if (user) {
        await addDoc(collection(db, "appFeedback"), {
          message,
          userId: user?.uid || null,
          email,
          platform: Platform.OS,
          createdAt: serverTimestamp(),
        });
      }

      const userName = firebaseUser?.name || "Nutzer";
      const mailBody = `${userName}\nFeedback zur Handy APP\n\n${message}`;
      const mailto = `mailto:info@haarmonie-sha.de?subject=App%20Feedback&body=${encodeURIComponent(
        mailBody
      )}`;
      await Linking.openURL(mailto);

      setFeedbackSent(true);
      setFeedbackMessage("");
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackSent(false);
        feedbackTimerRef.current = null;
      }, 5000);
    } catch (err) {
      console.error("Feedback senden fehlgeschlagen:", err);
      const userName = firebaseUser?.name || "Nutzer";
      const mailBody = `${userName}\nFeedback zur Handy APP\n\n${message}`;
      const mailto = `mailto:info@haarmonie-sha.de?subject=App%20Feedback&body=${encodeURIComponent(
        mailBody
      )}`;
      try {
        await Linking.openURL(mailto);
      } catch {
        // ignore secondary failure
      }
      Alert.alert(
        "Fehler",
        "Feedback konnte nicht gesendet werden. Bitte später erneut versuchen."
      );
    } finally {
      setFeedbackBusy(false);
    }
  };

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, []);

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
      }
      return undefined;
    }, [firebaseUser, setIsRegisterMode])
  );

  // -----------------------------------
  // Login / Registrierung
  // -----------------------------------
  const handleAuthSubmit = async () => {
    setAuthError(null);
    setAuthNotice(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    let normalizedBirthDate = "";

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
      const normalized = normalizeBirthDate(birthDate);
      if (!normalized) {
        setAuthError(
          "Bitte gib dein Geburtsdatum im Format TT.MM.JJJJ ein (kein Datum in der Zukunft)."
        );
        return;
      }
      normalizedBirthDate = normalized;
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
        let cred: any = null;

        try {
          cred = await createUserWithEmailAndPassword(
            auth,
            trimmedEmail,
            trimmedPassword
          );

          const uid = cred.user.uid;
          const userRef = doc(db, "users", uid);
          const bonusVisitRef = doc(collection(userRef, "visits"));

          const batch = writeBatch(db);

          // Startkonto mit Bonus
          batch.set(userRef, {
            email: trimmedEmail,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            dateOfBirth: normalizedBirthDate,
            ...getBirthDayMonth(normalizedBirthDate),
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
          batch.set(bonusVisitRef, {
            reason: "Registrierungsbonus",
            points: 50,
            amount: null,
            createdAt: serverTimestamp(),
          });

          await batch.commit();
          setAuthNotice(
            "Registrierung erfolgreich. Bitte bestätige die Verifizierungs-E-Mail und logge dich danach ein."
          );
          setIsRegisterMode(false); // nach Registrierung zurück auf Login-Ansicht
        } catch (registerErr) {
          // Falls Firestore schlägt, Auth-Account aufräumen, damit keine halbfertigen Konten verbleiben
          if (cred?.user) {
            try {
              await deleteUser(cred.user);
            } catch (cleanupErr) {
              console.error(
                "Cleanup nach fehlgeschlagener Registrierung fehlgeschlagen:",
                cleanupErr
              );
            }
          }
          throw registerErr;
        }
      } else {
        // ---------- EINLOGGEN ----------
        const cred = await signInWithEmailAndPassword(
          auth,
          trimmedEmail,
          trimmedPassword
        );

        if (!cred.user.emailVerified) {
          setAuthError("Bitte bestätige zuerst deine E-Mail-Adresse.");
          return;
        }

        setAuthNotice(null);
        setVerificationEmail(null);
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
      } else if (err.code === "permission-denied") {
        setAuthError(
          "Deine Registrierung konnte nicht gespeichert werden. Bitte Internetverbindung prüfen oder später erneut versuchen."
        );
      } else if (err.code === "auth/too-many-requests") {
        setAuthError("Zu viele Anfragen. Bitte warte kurz und versuche es erneut.");
      } else if (err?.message === "USER_PROFILE_MISSING") {
        setAuthError(
          "Dein Profil konnte nicht geladen werden. Bitte melde dich erneut an oder registriere dich noch einmal."
        );
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
      setAuthNotice(null);
      setVerificationEmail(null);
      verificationEmailTimestampRef.current = null;
      setAuthError(null);
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
      setShowPushPasswordModal(false);
      setPushPasswordError("");
      setPushPasswordInput("");
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
        const voucher = computeBirthdayVoucherState(data);
        list.push({
          id: d.id,
          name: data.name || "",
          email: data.email || "",
          points: typeof data.points === "number" ? data.points : 0,
          dateOfBirth: data.dateOfBirth || "",
          birthDay: typeof data.birthDay === "number" ? data.birthDay : undefined,
          birthMonth: typeof data.birthMonth === "number" ? data.birthMonth : undefined,
          birthdayVoucherAvailable: voucher.available,
          birthdayVoucherYear: voucher.year ?? undefined,
          birthdayVoucherRedeemedYear: voucher.redeemedYear ?? undefined,
          lastBirthdayGiftYear:
            typeof data.lastBirthdayGiftYear === "number"
              ? data.lastBirthdayGiftYear
              : undefined,
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
    try {
      setExportPasswordError("");
      await verifyAdminPassword(providedPassword);
      setShowExportPasswordModal(false);
      setExportBusy(true);
    } catch (e) {
      console.error("Export Passwortcheck fehlgeschlagen:", e);
      setExportPasswordError("Passwort ist falsch oder Server nicht erreichbar.");
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);

      const rows: string[] = [];

      rows.push(
        [
          "Vorname",
          "Nachname",
          "Geburtsdatum",
          "Name (vollständig)",
          "E-Mail",
          "Telefon",
          "Straße",
          "PLZ",
          "Ort",
          "Punkte",
          "Marketing-Einwilligung",
          "Registriert am",
        ].join(";")
      );

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;

        const firstName = data.firstName || "";
        const lastName = data.lastName || "";
        const name = data.name || `${firstName} ${lastName}`.trim();
        const dateOfBirth = data.dateOfBirth || "";
        const email = data.email || "";
        const phone = data.phone || "";
        const street = data.street || "";
        const zip = data.zip || "";
        const city = data.city || "";
        const points =
          typeof data.points === "number" ? data.points.toString() : "0";
        const marketingConsent =
          data.marketingConsent === true ? "Ja" : data.marketingConsent === false ? "Nein" : "";
        const createdAt =
          data.createdAt && data.createdAt.toDate
            ? data.createdAt.toDate().toISOString()
            : "";

        rows.push(
          [
            firstName,
            lastName,
            dateOfBirth,
            name,
            email,
            phone,
            street,
            zip,
            city,
            points,
            marketingConsent,
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
  }, [exportBusy, exportPasswordInput, firebaseUser?.isAdmin, verifyAdminPassword]);

  const handleSelectCustomer = (c: Customer) => {
    // Toggle: bei erneutem Klick den Kunden wieder abwählen und Felder schließen
    if (selectedCustomer?.id === c.id) {
      setSelectedCustomer(null);
      setSelectedCustomerRewardClaims({});
      setSelectedCustomerRedemptions([]);
      setEditPoints("");
      setEditEmployeeName("");
      setRewardEmployeeName("");
      setRedemptionEmployeeName("");
      setEmployeeDropdownOpen(false);
      setRewardActionsExpanded(false);
      setRedemptionBusyId(null);
      setCustomerEditExpanded(false);
      setCustomerEditUnlocked(false);
      setCustomerPasswordInput("");
      setCustomerPasswordError("");
      setEditCustomerName("");
      setEditCustomerEmail("");
      setEditCustomerDateOfBirth("");
      setEditCustomerPhone("");
      setEditCustomerStreet("");
      setEditCustomerZip("");
      setEditCustomerCity("");
      return;
    }

    setSelectedCustomer(c);
    setSelectedCustomerRewardClaims(c.rewardClaims || {});
    setSelectedCustomerRedemptions([]);
    setEditPoints("");
    setEditEmployeeName("");
    setRewardEmployeeName("");
    setRedemptionEmployeeName("");
    setEmployeeDropdownOpen(false);
    setRewardActionsExpanded(false);
    setRedemptionBusyId(null);
    setCustomerEditExpanded(false);
    setCustomerEditUnlocked(false);
    setCustomerPasswordInput("");
    setCustomerPasswordError("");
    setEditCustomerName(c.name || "");
    setEditCustomerEmail(c.email || "");
    setEditCustomerDateOfBirth(c.dateOfBirth || "");
    setEditCustomerPhone(c.phone || "");
    setEditCustomerStreet(c.street || "");
    setEditCustomerZip(c.zip || "");
    setEditCustomerCity(c.city || "");
  };

const registerForPushNotificationsAsync = async (uid: string) => {
  try {
    if (!Device.isDevice) return;
  const isExpoGo =
      Constants.appOwnership === "expo" ||
      Constants.executionEnvironment === "storeClient";
    if (isExpoGo) {
      console.warn("Push wird in Expo Go nicht unterstützt. Bitte Dev-Build nutzen.");
      return;
    }
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
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      null;
  const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData?.data;
    if (!token) {
      console.warn("FCM-Token konnte nicht geholt werden (getDevicePushTokenAsync).");
      return;
    }

    const userRef = doc(db, "users", uid);
    const pushRef = collection(userRef, "pushTokens");
    await setDoc(doc(pushRef, token), {
      token,
      deviceName: Device.deviceName || "",
      createdAt: serverTimestamp(),
      platform: Platform.OS,
      provider: "fcm",
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
  useEffect(() => {
    if (firebaseUser?.uid) {
      loadServerPushInfo(firebaseUser.uid);
    }
  }, [firebaseUser?.uid, loadServerPushInfo]);

  const seedDefaultRewardActions = async (actionsRef: any) => {
    const now = new Date().toISOString();
    await Promise.all(
      DEFAULT_REWARD_ACTIONS.map((action, index) =>
        setDoc(doc(actionsRef, action.id), {
          title: action.title,
          description: action.description,
          points: action.points,
          url: action.url || "",
          active: action.active !== false,
          order: action.order ?? index + 1,
          startDate: action.startDate || now,
          endDate: action.endDate || "",
          createdAt: serverTimestamp(),
        })
      )
  );
};

  const handleOpenPushNavigation = () => {
    setPushPasswordError("");
    setPushPasswordInput("");
    setShowPushPassword(false);
    setShowPushPasswordModal(true);
  };

  const handleConfirmPushNavigation = async () => {
    try {
      await verifyAdminPassword(pushPasswordInput);
      setPushPasswordError("");
      setPushPasswordInput("");
      setShowPushPassword(false);
      setShowPushPasswordModal(false);
      router.push("/push-nachrichten");
    } catch (e) {
      console.error("Push-Navigation Passwortcheck fehlgeschlagen:", e);
      setPushPasswordError("Passwort ist falsch oder Server nicht erreichbar.");
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
    const birthDate = editCustomerDateOfBirth.trim();
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

    let normalizedBirthDate = "";
    if (birthDate) {
      const normalized = normalizeBirthDate(birthDate);
      if (!normalized) {
        Alert.alert(
          "Geburtsdatum prǬfen",
          "Bitte TT.MM.JJJJ eintragen (kein Datum in der Zukunft)."
        );
        return;
      }
      normalizedBirthDate = normalized;
    }

    try {
      const userRef = doc(db, "users", selectedCustomer.id);

      await updateDoc(userRef, {
        name,
        email,
        dateOfBirth: normalizedBirthDate,
        ...(normalizedBirthDate ? getBirthDayMonth(normalizedBirthDate) : {}),
        phone,
        street,
        zip,
        city,
      });

      // ausgewählten Kunden im State aktualisieren
      setSelectedCustomer((prev: any) =>
        prev && prev.id === selectedCustomer.id
          ? {
              ...prev,
              name,
              email,
              dateOfBirth: normalizedBirthDate,
              ...(normalizedBirthDate
                ? getBirthDayMonth(normalizedBirthDate)
                : { birthDay: undefined, birthMonth: undefined }),
              birthdayVoucherAvailable: prev.birthdayVoucherAvailable,
              birthdayVoucherYear: prev.birthdayVoucherYear,
              birthdayVoucherRedeemedYear: prev.birthdayVoucherRedeemedYear,
              phone,
              street,
              zip,
              city,
            }
          : prev
      );

      // Kundenliste im State aktualisieren
      setCustomers((prev: any[]) =>
        prev.map((c) =>
          c.id === selectedCustomer.id
            ? {
                ...c,
                name,
                email,
                dateOfBirth: normalizedBirthDate,
                ...(normalizedBirthDate
                  ? getBirthDayMonth(normalizedBirthDate)
                  : { birthDay: undefined, birthMonth: undefined }),
                birthdayVoucherAvailable: c.birthdayVoucherAvailable,
                birthdayVoucherYear: c.birthdayVoucherYear,
                birthdayVoucherRedeemedYear: c.birthdayVoucherRedeemedYear,
                phone,
                street,
                zip,
                city,
              }
            : c
        )
      );

      setEditCustomerDateOfBirth(normalizedBirthDate);

      Alert.alert("Gespeichert", "Die Kundendaten wurden aktualisiert.");
    } catch (err) {
      console.error("Fehler beim Aktualisieren der Kundendaten:", err);
      Alert.alert("Fehler", "Die Kundendaten konnten nicht gespeichert werden.");
    }
  };

  const handleRedeemBirthdayVoucher = async () => {
    if (!selectedCustomer) return;
    const employee = selectedAdminEmployee;
    if (!employee) {
      Alert.alert(
        "Mitarbeiter auswählen",
        "Bitte Mitarbeiter/in auswählen, bevor der Gutschein eingelöst wird."
      );
      return;
    }
    const hasVoucher =
      selectedCustomer.birthdayVoucherAvailable ||
      (selectedCustomer.id === firebaseUser?.uid && birthdayVoucherAvailable);
    if (!hasVoucher) {
      Alert.alert("Nicht verfügbar", "Kein Geburtstags-Gutschein aktiv.");
      return;
    }
    if (adminBirthdayBusy) return;

    setAdminBirthdayBusy(true);
    try {
      const userRef = doc(db, "users", selectedCustomer.id);
      await updateDoc(userRef, {
        birthdayVoucherAvailable: false,
        birthdayVoucherRedeemedYear: new Date().getFullYear(),
      });

    const visitsRef = collection(userRef, "visits");
    await addDoc(visitsRef, {
      createdAt: serverTimestamp(),
      amount: -5,
      points: 0,
      reason: "Geburtstags-Gutschein eingelöst",
      source: "birthday-voucher",
      employeeName: employee,
    });

      setSelectedCustomer((prev: any) =>
        prev && prev.id === selectedCustomer.id
          ? { ...prev, birthdayVoucherAvailable: false }
          : prev
      );
      setCustomers((prev: any[]) =>
        prev.map((c) =>
          c.id === selectedCustomer.id
            ? { ...c, birthdayVoucherAvailable: false }
            : c
        )
      );
      if (selectedCustomer.id === firebaseUser?.uid) {
        setBirthdayVoucherAvailable(false);
      }
      Alert.alert("Eingelöst", "Der Geburtstags-Gutschein wurde markiert.");
    } catch (err) {
      console.error("Fehler beim Einlösen des Gutscheins:", err);
      Alert.alert("Fehler", "Gutschein konnte nicht eingelöst werden.");
    } finally {
      setAdminBirthdayBusy(false);
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

  const isActionActiveForNow = (action: RewardAction) => {
    if (action.active === false) return false;
    const now = new Date();

    const startsOk =
      !action.startDate ||
      Number.isNaN(Date.parse(action.startDate)) ||
      new Date(action.startDate) <= now;
    const endsOk =
      !action.endDate ||
      Number.isNaN(Date.parse(action.endDate)) ||
      new Date(action.endDate) >= now;

    return startsOk && endsOk;
  };const handleAdminApproveRewardAction = async (action: RewardAction) => {
    if (!firebaseUser?.isAdmin || !selectedCustomer) return;

    const employee = selectedAdminEmployee;
    if (!employee) {
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
        employeeName: employee,
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

  const handleAdminApproveRedemption = async (redemption: RewardRedemption) => {
    if (!firebaseUser?.isAdmin || !selectedCustomer) return;

    if (!selectedAdminEmployee) {
      Alert.alert(
        "Mitarbeiter auswählen",
        "Bitte Mitarbeiter auswählen, der die Einlösung bestätigt."
      );
      return;
    }

    if (redemption.status === "approved") {
      Alert.alert("Bereits bestätigt", "Diese Prämie wurde schon eingelöst.");
      return;
    }
    if (redemptionBusyId === redemption.id) return;

    const employee = selectedAdminEmployee;
    let updatedPoints: number | null = null;

    setRedemptionBusyId(redemption.id);
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, "users", selectedCustomer.id);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) {
          throw new Error("user_not_found");
        }

        const currentPoints =
          typeof userSnap.data().points === "number"
            ? userSnap.data().points
            : 0;

        if (currentPoints < redemption.pointsRequired) {
          throw new Error("not_enough_points");
        }

        updatedPoints = currentPoints - redemption.pointsRequired;

        const redemptionRef = doc(
          collection(userRef, "rewardRedemptions"),
          redemption.id
        );
        tx.update(userRef, { points: updatedPoints });
        tx.update(redemptionRef, {
          status: "approved",
          approvedAt: serverTimestamp(),
          employeeName: employee,
        });
      });

      // Besuchshistorie-Eintrag nach erfolgreichem Transaction-Update
      if (updatedPoints !== null) {
        const userRef = doc(db, "users", selectedCustomer.id);
        const visitsRef = collection(userRef, "visits");
        await addDoc(visitsRef, {
          createdAt: serverTimestamp(),
          amount: null,
          points: -redemption.pointsRequired,
          reason: `Prämie eingelöst: ${redemption.title}`,
          source: "reward-redemption",
          employeeName: employee,
        });
      }

      setSelectedCustomer((prev) =>
        prev && updatedPoints !== null ? { ...prev, points: updatedPoints } : prev
      );
      if (selectedCustomer.id === firebaseUser.uid && updatedPoints !== null) {
        setPoints(updatedPoints);
      }

      Alert.alert(
        "Prämie bestätigt",
        `${redemption.title} wurde bestätigt und Punkte wurden abgezogen.`
      );
    } catch (err: any) {
      if (err?.message === "not_enough_points") {
        Alert.alert("Zu wenig Punkte", "Der Kunde hat nicht genug Punkte.");
      } else if (err?.message === "user_not_found") {
        Alert.alert("Fehler", "Kunde nicht gefunden.");
      } else {
        console.error("Fehler beim Bestätigen der Prämie:", err);
        Alert.alert("Fehler", "Die Prämie konnte nicht bestätigt werden.");
      }
    } finally {
      setRedemptionBusyId(null);
    }
  };

  const handleClaimRewardAction = async (action: RewardAction) => {
    if (!firebaseUser) return;
    if (!isActionActiveForNow(action)) {
      Alert.alert(
        "Aktion nicht verf?gbar",
        "Diese Aktion ist aktuell nicht freigeschaltet."
      );
      return;
    }
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
      const markPending = httpsCallable(fbFunctions, "requestRewardAction");
      const result = await markPending({ actionId: action.id });
      const status = (result as any)?.data?.status;

      if (status === "already-approved") {
        setRewardClaims((prev) => ({ ...prev, [action.id]: true }));
        Alert.alert("Schon bestätigt", "Diese Aktion wurde bereits gutgeschrieben.");
        setRewardClaimBusy(null);
        return;
      }

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
        "In Prüfung",
        "Bitte mit einem Salonmitarbeiter freischalten lassen"
      );
    } catch (err) {
      console.error("Fehler beim Setzen der Aktion auf pending:", err);
      Alert.alert("Fehler", "Die Prämienaktion konnte nicht gestartet werden.");
    } finally {
      setRewardClaimBusy(null);
    }
  };

  const applyBirthDateSelection = (
    date: Date | null,
    targetOverride?: "register" | "edit"
  ) => {
    if (!date) return;
    const formatted = formatBirthDateFromDate(date);
    const target = targetOverride || birthDatePickerTarget;
    if (target === "register") {
      setBirthDate(formatted);
    } else if (target === "edit") {
      setEditCustomerDateOfBirth(formatted);
    }
  };

  const closeBirthDatePicker = () => {
    setBirthDatePickerVisible(false);
    setBirthDatePickerTarget(null);
    setBirthDatePickerDate(null);
  };

  const handleBirthDateChange = (event: any, selectedDate?: Date) => {
    const chosen = selectedDate || birthDatePickerDate || defaultBirthDate();
    if (Platform.OS === "android") {
      if (event?.type === "dismissed") {
        closeBirthDatePicker();
        return;
      }
      applyBirthDateSelection(chosen);
      closeBirthDatePicker();
    } else {
      setBirthDatePickerDate(chosen);
    }
  };

  const openBirthDatePicker = (target: "register" | "edit") => {
    const currentValue =
      target === "register"
        ? parseBirthDate(birthDate) || defaultBirthDate()
        : parseBirthDate(editCustomerDateOfBirth) || defaultBirthDate();

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: currentValue,
        mode: "date",
        is24Hour: true,
        maximumDate: new Date(),
        onChange: (event, selected) => {
          if (event?.type === "set" && selected) {
            applyBirthDateSelection(selected, target);
          }
        },
      });
      return;
    }

    setBirthDatePickerDate(currentValue);
    setBirthDatePickerTarget(target);
    setBirthDatePickerVisible(true);
  };



  // -----------------------------------
  // Rendering
  // -----------------------------------

  if (showIntro) {
    return (
      <SafeAreaView style={[styles.container, styles.introContainer]}>
        <LottieView
          source={require("../../assets/intro.json")}
          autoPlay
          loop={false}
          onAnimationFinish={() => setShowIntro(false)}
          style={styles.introAnimation}
        />
      </SafeAreaView>
    );
  }

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
      <AuthForm
        isRegisterMode={isRegisterMode}
        authBusy={authBusy}
        authError={authError}
        authNotice={authNotice}
        email={email}
        password={password}
        firstName={firstName}
        lastName={lastName}
        street={street}
        zip={zip}
        city={city}
        phone={phone}
        birthDate={birthDate}
        consentMarketing={consentMarketing}
        setEmail={setEmail}
        setPassword={setPassword}
        setFirstName={setFirstName}
        setLastName={setLastName}
        setStreet={setStreet}
        setZip={setZip}
        setCity={setCity}
        setPhone={setPhone}
        setConsentMarketing={setConsentMarketing}
        openBirthDatePicker={openBirthDatePicker}
        handleAuthSubmit={handleAuthSubmit}
        handlePasswordReset={handlePasswordReset}
        setIsRegisterMode={setIsRegisterMode}
        resetAuthFeedback={resetAuthFeedback}
        styles={styles}
        keyboardOffset={keyboardOffset}
      />
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

  const sortedRewardActions = [...rewardActions].sort(
    (a, b) => (a.order ?? 9999) - (b.order ?? 9999)
  );
  const visibleRewardActions = sortedRewardActions.filter(
    (action) => isActionActiveForNow(action) && rewardClaims[action.id] !== true
  );
  const hasPendingRewardClaims = sortedRewardActions.some(
    (action) => selectedCustomerRewardClaims[action.id] === "pending"
  );
  const selectedAdminEmployee = (
    editEmployeeName ||
    rewardEmployeeName ||
    redemptionEmployeeName
  ).trim();
  const hasActionEmployee = selectedAdminEmployee.length > 0;

  const pendingRedemptions = selectedCustomerRedemptions.filter(
    (r) => r.status !== "approved"
  );
  const approvedRedemptions = selectedCustomerRedemptions.filter(
    (r) => r.status === "approved"
  );
  const visibleApprovedRedemptions = approvedRedemptions.slice(0, 4);
  const archivedApprovedCount = Math.max(
    0,
    approvedRedemptions.length - visibleApprovedRedemptions.length
  );

const renderRedemptionRow = (r: RewardRedemption) => {
  const busy = redemptionBusyId === r.id;
  const pending = r.status !== "approved";

  return (
      <View key={r.id} style={styles.redemptionCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.redemptionTitle}>{r.title}</Text>
          <Text style={styles.redemptionMeta}>
            {r.pointsRequired} P
            {r.createdAt ? ` • ${r.createdAt}` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View
            style={[
              styles.statusChip,
              pending ? styles.statusChipPending : styles.statusChipDone,
            ]}
          >
            <Text style={styles.statusChipText}>
              {pending ? "Offen" : "Bestätigt"}
            </Text>
          </View>
          {pending ? (
            <TouchableOpacity
              style={[
                styles.adminActionButton,
                styles.actionButton,
                { marginTop: 8 },
                (busy || !hasActionEmployee) &&
                  styles.actionButtonDisabled,
              ]}
              disabled={busy || !hasActionEmployee}
              onPress={() => handleAdminApproveRedemption(r)}
            >
              <Text style={styles.primaryButtonText}>
                {!hasActionEmployee
                  ? "Mitarbeiter auswählen"
                  : busy
                  ? "Bitte warten..."
                  : "Bestätigen"}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.redemptionApproved}>
              {r.employeeName
                ? `Bestätigt durch ${r.employeeName}`
                : "Bestätigt"}
            </Text>
          )}
        </View>
      </View>
    );
  };

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
              Hallo {firebaseUser.name || "Schönheit"}
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
          <CustomerHome
            styles={styles}
            points={points}
            onOpenRewards={() =>
              router.push({
                pathname: "/rewards",
                params: { points: String(points) },
              })
            }
            birthdayVoucherAvailable={birthdayVoucherAvailable}
            birthdayVoucherYear={birthdayVoucherYear}
            onBirthdayBook={() => {
              Linking.openURL("tel:+4979197825477").catch(() => {});
            }}
            rewardActionsLoading={rewardActionsLoading}
            visibleRewardActions={visibleRewardActions}
            rewardClaims={rewardClaims}
            rewardClaimBusy={rewardClaimBusy}
            rewardExpandedId={rewardExpandedId}
            setRewardExpandedId={setRewardExpandedId}
            onClaimRewardAction={handleClaimRewardAction}
            visitHistory={visitHistory}
            showAllVisits={showAllVisits}
            setShowAllVisits={setShowAllVisits}
            onOpenFeedback={() => setShowFeedbackModal(true)}
            feedbackSent={feedbackSent}
            pushInfo={pushInfo}
            onClearPushInfo={clearPushInfo}
          />
        )}

        {/* Admin-/Mitarbeiterbereich: Kunden verwalten */}
        {isAdmin && isAdminView && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}> </Text>

            <View style={[styles.pointsCard, { marginTop: 1 }]}>
              <Text style={styles.sectionTitle}>Prämien-Aktionen verwalten</Text>
              <Text style={styles.modalText}>
                neue Aktionen anlegen, bearbeiten oder löschen.
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 8 }]}
                onPress={() => router.push("/manage-reward-actions")}
              >
                <Text style={styles.primaryButtonText}>Zur Verwaltung wechseln</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.pointsCard, { marginTop: 12 }]}>
              <Text style={styles.sectionTitle}>Prämien verwalten</Text>
              <Text style={styles.modalText}>
                Prämien der Kundenübersicht anlegen, bearbeiten oder löschen.
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 8 }]}
                onPress={() => router.push("/manage-rewards")}
              >
                <Text style={styles.primaryButtonText}>Zur Verwaltung wechseln</Text>
              </TouchableOpacity>
            </View>

            {/* Push-Nachricht senden */}
            <View style={[styles.pointsCard, { marginTop: 12 }]}>
              <Text style={styles.sectionTitle}>Push-Nachricht senden</Text>
              <Text style={styles.modalText}>
                Push-Nachrichten an alle Kunden versenden.
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 8 }]}
                onPress={handleOpenPushNavigation}
              >
                <Text style={styles.primaryButtonText}>Zur Verwaltung wechseln</Text>
              </TouchableOpacity>
            </View>

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
                setShowExportPassword(false);
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
                                            <View style={[styles.pointsCard, { marginTop: 20 }]}>
                        <Text style={styles.sectionTitle}>Mitarbeiter/in auswählen</Text>
                        <Text style={styles.modalText}>
                          Gilt für alle Admin-Aktionen (Punkte, Prämien, Gutscheine).
                        </Text>
                        <TouchableOpacity
                          style={styles.dropdownTrigger}
                          onPress={() => setEmployeeDropdownOpen((prev) => !prev)}
                        >
                          <Text style={styles.dropdownTriggerText}>
                            {selectedAdminEmployee || "Mitarbeiter auswählen"}
                          </Text>
                          <Text style={styles.dropdownChevron}>
                            {employeeDropdownOpen ? "\u25BE" : "\u25B8"}
                          </Text>
                        </TouchableOpacity>
                        {employeeDropdownOpen && (
                          <View style={styles.dropdownList}>
                            {EMPLOYEE_NAMES.map((name) => (
                              <TouchableOpacity
                                key={name}
                                style={[
                                  styles.dropdownItem,
                                  selectedAdminEmployee === name && styles.dropdownItemActive,
                                ]}
                                onPress={() => {
                                  setEditEmployeeName(name);
                                  setRewardEmployeeName(name);
                                  setRedemptionEmployeeName(name);
                                  setEmployeeDropdownOpen(false);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.dropdownItemText,
                                    selectedAdminEmployee === name && styles.dropdownItemTextActive,
                                  ]}
                                >
                                  {name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
{/* Punktestand bearbeiten */}
                      <View style={[styles.pointsCard, { marginTop: 20 }]}>
                        <Text style={styles.sectionTitle}>
                          Punkte verbuchen (Euro = Punkte)
                        </Text>
                        <Text style={{ fontSize: 13, marginBottom: 8 }}>
                          Kunde: {selectedCustomer.name}
                        </Text>

                        <Text style={{ fontSize: 13, marginBottom: 6 }}>
                          Mitarbeiter/in: {selectedAdminEmployee || "Bitte oben auswählen"}
                        </Text>

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
                      <View
                        style={[
                          styles.pointsCard,
                          { marginTop: 20 },
                          pendingRedemptions.length > 0 && styles.pointsCardActive,
                        ]}
                      >
                        <TouchableOpacity
                          style={[
                            styles.accordionHeader,
                            pendingRedemptions.length > 0 && styles.redemptionHeader,
                          ]}
                          onPress={() => setRedemptionsExpanded((prev) => !prev)}
                        >
                          <Text
                            style={[
                              styles.sectionTitle,
                              pendingRedemptions.length > 0 &&
                                styles.redemptionHeaderTitle,
                            ]}
                          >
                            Prämien-Einlösungen
                          </Text>
                          <Text style={styles.accordionChevron}>
                            {redemptionsExpanded ? "▼" : "▶"}
                          </Text>
                        </TouchableOpacity>

                        {redemptionsExpanded && (
                          <>
                            <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                              Anfragen aus der Rewards-Seite. Nach Bestätigung werden Punkte
                              abgezogen und die Historie ergänzt.
                            </Text>

                            <Text style={[styles.loginLabel, { marginTop: 10 }]}>
                              Mitarbeiter/in: {selectedAdminEmployee || "Bitte oben auswählen"}
                            </Text>

                            {pendingRedemptions.length === 0 &&
                            visibleApprovedRedemptions.length === 0 ? (
                              <Text style={[styles.emptyText, { marginTop: 10 }]}>
                                Keine Anfragen vorhanden.
                              </Text>
                            ) : (
                              <>
                                {pendingRedemptions.length > 0 && (
                                  <>
                                    <Text style={styles.redemptionGroupLabel}>
                                      Offene Einlösungen
                                    </Text>
                                    {pendingRedemptions.map((r) => renderRedemptionRow(r))}
                                  </>
                                )}

                                {visibleApprovedRedemptions.length > 0 && (
                                  <>
                                    <Text
                                      style={[
                                        styles.redemptionGroupLabel,
                                        {
                                          marginTop: pendingRedemptions.length ? 12 : 10,
                                        },
                                      ]}
                                    >
                                      Bestätigt (letzte 4)
                                    </Text>
                                    {visibleApprovedRedemptions.map((r) =>
                                      renderRedemptionRow(r)
                                    )}
                                  </>
                                )}

                                {archivedApprovedCount > 0 && (
                                  <Text style={styles.archivedNotice}>
                                    {archivedApprovedCount === 1
                                      ? "1 ältere Bestätigung wurde archiviert."
                                      : `${archivedApprovedCount} ältere Bestätigungen wurden archiviert.`}
                                  </Text>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </View>
                      <View
                        style={[
                          styles.pointsCard,
                          { marginTop: 20 },
                          hasPendingRewardClaims && styles.pointsCardActive,
                        ]}
                      >
                        <TouchableOpacity
                          style={[
                            styles.accordionHeader,
                            hasPendingRewardClaims && styles.redemptionHeader,
                          ]}
                          onPress={() => setRewardActionsExpanded((prev) => !prev)}
                        >
                          <Text
                            style={[
                              styles.sectionTitle,
                              hasPendingRewardClaims && styles.redemptionHeaderTitle,
                            ]}
                          >
                            Prämien-Aktionen freischalten
                          </Text>
                          <Text style={styles.accordionChevron}>
                            {rewardActionsExpanded ? "\u25BC" : "\u25B6"}
                          </Text>
                        </TouchableOpacity>

                        {rewardActionsExpanded && (
                          <>
                            <Text style={styles.loginLabel}>Mitarbeiter/in</Text>
                            <Text style={[styles.dropdownTriggerText, { marginBottom: 6 }]}>{selectedAdminEmployee || "Bitte oben auswählen"}</Text>

                            {rewardActionsLoading && sortedRewardActions.length === 0 ? (
                              <ActivityIndicator style={{ marginTop: 10 }} />
                            ) : sortedRewardActions.length === 0 ? (
                              <Text style={[styles.emptyText, { marginTop: 8 }]}>
                                Keine Aktionen vorhanden.
                              </Text>
                            ) : (
                              sortedRewardActions.map((action) => {
                                const status = selectedCustomerRewardClaims[action.id];
                                const claimed = status === true;
                                const pending = status === "pending";
                                const busy = adminRewardBusy === action.id;
                                const disabled = claimed || busy || !pending || !hasActionEmployee;
                                const approveLabel = claimed
                                  ? "Schon gutgeschrieben"
                                  : !hasActionEmployee
                                  ? "Mitarbeiter auswählen"
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
                                      <Text style={styles.primaryButtonText}>{approveLabel}</Text>
                                    </TouchableOpacity>
                                  </View>
                                );
                              })
                            )}
                          </>
                        )}
                      </View>
                      <View
                        style={[
                          styles.pointsCard,
                          { marginTop: 20 },
                          selectedCustomer?.birthdayVoucherAvailable &&
                            styles.birthdayAdminActive,
                        ]}
                      >
                        <Text style={styles.sectionTitle}>Geburtstags-Gutschein</Text>
                        <Text style={styles.modalText}>
                          Markiere den 5€-Gutschein als eingelöst, wenn der Kunde ihn nutzt.
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.adminActionButton,
                            styles.actionButton,
                            (!selectedCustomer?.birthdayVoucherAvailable ||
                              adminBirthdayBusy ||
                              !hasActionEmployee) &&
                              styles.actionButtonDisabled,
                            { marginTop: 6 },
                          ]}
                          disabled={
                            !selectedCustomer?.birthdayVoucherAvailable ||
                            adminBirthdayBusy ||
                            !hasActionEmployee
                          }
                          onPress={handleRedeemBirthdayVoucher}
                        >
                          <Text style={styles.primaryButtonText}>
                            {selectedCustomer?.birthdayVoucherAvailable
                              ? !hasActionEmployee
                                ? "Mitarbeiter auswählen"
                                : adminBirthdayBusy
                                ? "Bitte warten..."
                                : "Gutschein einlösen"
                              : "Kein Gutschein verfügbar"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Kundendaten bearbeiten */}
                      <View style={[styles.pointsCard, { marginTop: 20 }]}>
                        <TouchableOpacity
                          style={styles.accordionHeader}
                          onPress={() => {
                            if (!customerEditUnlocked) {
                              setCustomerPasswordError("");
                              setCustomerPasswordInput("");
                              setShowCustomerPassword(false);
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

                            <Text style={styles.loginLabel}>Geburtsdatum (TT.MM.JJJJ)</Text>
                            <TouchableOpacity
                              style={[styles.loginInput, styles.dateInput]}
                              activeOpacity={0.7}
                              onPress={() => openBirthDatePicker("edit")}
                            >
                              <Text
                                style={[
                                  styles.dateInputText,
                                  editCustomerDateOfBirth ? styles.dateInputTextValue : null,
                                ]}
                              >
                                {editCustomerDateOfBirth || "Datum auswählen"}
                              </Text>
                            </TouchableOpacity>

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
      </ScrollView>
      </KeyboardAvoidingView>

      {Platform.OS === "ios" && (
        <Modal
          visible={birthDatePickerVisible}
          transparent
          animationType="fade"
          onRequestClose={closeBirthDatePicker}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>Geburtsdatum auswählen</Text>
              <DateTimePicker
                value={birthDatePickerDate || defaultBirthDate()}
                mode="date"
                display="spinner"
                onChange={handleBirthDateChange}
                maximumDate={new Date()}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={closeBirthDatePicker}
                >
                  <Text style={styles.modalCancelText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { marginLeft: 10 }]}
                  onPress={() => {
                    applyBirthDateSelection(
                      birthDatePickerDate || defaultBirthDate()
                    );
                    closeBirthDatePicker();
                  }}
                >
                  <Text style={styles.primaryButtonText}>Übernehmen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowFeedbackModal(false);
          setFeedbackBusy(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Feedback zur App</Text>
            <Text style={styles.modalText}>
              Teile uns mit, was wir verbessern können. Dein Feedback wird per E-Mail App auf deinem Handy an uns geschickt.
            </Text>
            <TextInput
              style={[styles.loginInput, { height: 140, marginTop: 8 }]}
              value={feedbackMessage}
              onChangeText={(t) => {
                setFeedbackMessage(t);
                if (feedbackSent) setFeedbackSent(false);
              }}
              placeholder="Was sollen wir besser machen?"
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowFeedbackModal(false);
                  setFeedbackBusy(false);
                }}
              >
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { marginLeft: 10, opacity: feedbackBusy ? 0.6 : 1 },
                ]}
                disabled={feedbackBusy}
                onPress={handleSendAppFeedback}
              >
                <Text style={styles.primaryButtonText}>
                  {feedbackBusy ? "Sende..." : "Feedback senden"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPushPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPushPasswordModal(false);
          setPushPasswordError("");
          setPushPasswordInput("");
          setShowPushPassword(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Passwort erforderlich</Text>
            <Text style={styles.modalText}>
              Bitte Admin-Passwort eingeben, um Push-Nachrichten zu verwalten.
            </Text>

            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.passwordInputField}
                value={pushPasswordInput}
                onChangeText={setPushPasswordInput}
                placeholder="Passwort"
                secureTextEntry={!showPushPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPushPassword((v) => !v)}>
                <Text style={styles.passwordToggle}>
                  {showPushPassword ? "Verbergen" : "Anzeigen"}
                </Text>
              </TouchableOpacity>
            </View>
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
                  setShowPushPassword(false);
                }}
              >
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { marginLeft: 10 }]}
                onPress={handleConfirmPushNavigation}
              >
                <Text style={styles.primaryButtonText}>Bestätigen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showExportPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowExportPasswordModal(false);
          setShowExportPassword(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Passwort für Export</Text>
            <Text style={styles.modalText}>
              Bitte das Mitarbeiter-Passwort eingeben, um den Export zu starten.
            </Text>

            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.passwordInputField}
                value={exportPasswordInput}
                onChangeText={setExportPasswordInput}
                placeholder="Passwort"
                secureTextEntry={!showExportPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowExportPassword((v) => !v)}>
                <Text style={styles.passwordToggle}>
                  {showExportPassword ? "Verbergen" : "Anzeigen"}
                </Text>
              </TouchableOpacity>
            </View>
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
                  setShowExportPassword(false);
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
          setShowCustomerPassword(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Passwort erforderlich</Text>
            <Text style={styles.modalText}>
              Bitte Admin-Passwort eingeben, um Kundendaten zu bearbeiten.
            </Text>

            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.passwordInputField}
                value={customerPasswordInput}
                onChangeText={setCustomerPasswordInput}
                placeholder="Passwort"
                secureTextEntry={!showCustomerPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowCustomerPassword((v) => !v)}>
                <Text style={styles.passwordToggle}>
                  {showCustomerPassword ? "Verbergen" : "Anzeigen"}
                </Text>
              </TouchableOpacity>
            </View>
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
                  setShowCustomerPassword(false);
                }}
              >
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { marginLeft: 10 }]}
                onPress={async () => {
                  try {
                    await verifyAdminPassword(customerPasswordInput);
                    setCustomerPasswordError("");
                    setCustomerPasswordInput("");
                    setShowCustomerPassword(false);
                    setShowCustomerPasswordModal(false);
                    setCustomerEditUnlocked(true);
                    setCustomerEditExpanded(true);
                  } catch (e) {
                    console.error("Customer-Edit Passwortcheck fehlgeschlagen:", e);
                    setCustomerPasswordError("Passwort ist falsch oder Server nicht erreichbar.");
                  }
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
  introContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  introAnimation: {
    width: 260,
    height: 260,
  },
  loginScroll: {
    padding: 20,
    paddingTop: 40,
  },
  mainScroll: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 0,
  },
  logoImage: {
    width: 300,
    height: 100,
    resizeMode: "contain",
    alignSelf: "center",
    marginBottom: 1,
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
  passwordInputWrapper: {
    borderWidth: 1,
    borderColor: "#e1d3c5",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  passwordInputField: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  passwordToggle: {
    color: "#c49a6c",
    fontWeight: "600",
    marginLeft: 10,
    fontSize: 13,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: "#e1d3c5",
    borderRadius: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  inputField: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  loginNoticeBox: {
    backgroundColor: "#e8f2e9",
    borderWidth: 1,
    borderColor: "#9cc39f",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  loginNotice: {
    color: "#1f412f",
    fontSize: 13,
  },
  pushInfoCard: {
    backgroundColor: "#fff4d6",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f3d9a6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: "relative",
  },
  pushInfoShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 160,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 14,
  },
  pushInfoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#a05b00",
    marginBottom: 4,
  },
  pushInfoBody: {
    fontSize: 13,
    color: "#5c4632",
    marginBottom: 6,
  },
  pushInfoTime: {
    fontSize: 12,
    color: "#7a644a",
    marginBottom: 8,
  },
  pushInfoCloseButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#c49a6c",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  pushInfoCloseText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
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
  pointsCardWrapper: {
    position: "relative",
    marginBottom: 20,
  },
  pointsCardGlow: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 6,
    bottom: 6,
    borderRadius: 26,
    backgroundColor: "rgba(255, 204, 128, 0.35)",
    shadowColor: "#f4b860",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
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
  pointsCardGradient: {
    backgroundColor: "#fff7ec",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    marginBottom: 0,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    marginLeft: 4,
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
  redemptionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eaded1",
  },
  redemptionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  redemptionMeta: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
  },
  redemptionGroupLabel: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
  },
  archivedNotice: {
    marginTop: 8,
    fontSize: 11,
    color: "#777",
  },
  redemptionApproved: {
    fontSize: 11,
    color: "#256029",
    marginTop: 6,
    textAlign: "right",
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
    fontSize: 24,
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
  feedbackCardWrapper: {
    position: "relative",
  },
  feedbackCardGlow: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 6,
    bottom: 6,
    borderRadius: 24,
    backgroundColor: "rgba(255, 204, 128, 0.35)",
    shadowColor: "#f4b860",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  feedbackCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eaded1",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  feedbackCardGradient: {
    backgroundColor: "#fff7ec",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 0,
    borderColor: "transparent",
  },
  birthdayAdminActive: {
    backgroundColor: "#e6f4ea",
    borderColor: "#e6f4ea",
  },
  pointsCardActive: {
    backgroundColor: "#e6f4ea",
    borderColor: "#e6f4ea",
  },
  redemptionHeader: {
    backgroundColor: "#e6f4ea",
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  redemptionHeaderTitle: {
    color: "#000000ff",
  },
  adminActionButton: {
  backgroundColor: "#c49a6c",
  borderRadius: 999,
  paddingVertical: 12,
  paddingHorizontal: 16,
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
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
  },
  dateInput: {
    justifyContent: "center",
  },
  dateInputText: {
    fontSize: 14,
    color: "#888",
  },
  dateInputTextValue: {
    color: "#333",
    fontWeight: "500",
  },
  birthdayWrapper: {
    marginBottom: 20,
    position: "relative",
  },
  birthdayGlow: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 6,
    bottom: 6,
    borderRadius: 26,
    backgroundColor: "rgba(255, 204, 128, 0.35)",
    shadowColor: "#f4b860",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  birthdayCardShell: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#fff7ec",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    overflow: "hidden",
  },
  birthdayBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#c49a6c",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: "#c49a6c",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  birthdayBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  birthdayTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2f2415",
    marginBottom: 8,
  },
  birthdayAmount: {
    fontSize: 46,
    fontWeight: "800",
    color: "#b47c2a",
    marginBottom: 8,
  },
  birthdaySubtitle: {
    fontSize: 14,
    color: "#5a4c3a",
    marginBottom: 16,
  },
  birthdayButton: {
    backgroundColor: "#c49a6c",
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#c49a6c",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  birthdayButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
