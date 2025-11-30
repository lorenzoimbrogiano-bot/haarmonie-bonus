import { useRef, useState } from "react";

export const useAuthFormState = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const verificationEmailTimestampRef = useRef<number | null>(null);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Registrierung – Stammdaten
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [street, setStreet] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);
  const [birthDatePickerDate, setBirthDatePickerDate] = useState<Date | null>(null);
  const [birthDatePickerTarget, setBirthDatePickerTarget] = useState<"register" | "edit" | null>(null);

  const resetAuthFeedback = () => {
    setAuthError(null);
    setAuthNotice(null);
    setVerificationEmail(null);
  };

  return {
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
  };
};
