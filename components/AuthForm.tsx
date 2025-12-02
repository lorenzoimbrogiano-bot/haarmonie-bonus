import React from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AuthFormProps = {
  isRegisterMode: boolean;
  authBusy: boolean;
  authError: string | null;
  authNotice: string | null;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  birthDate: string;
  consentMarketing: boolean;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setStreet: (v: string) => void;
  setZip: (v: string) => void;
  setCity: (v: string) => void;
  setPhone: (v: string) => void;
  setConsentMarketing: (v: boolean) => void;
  openBirthDatePicker: (target: "register" | "edit") => void;
  handleAuthSubmit: () => void;
  handlePasswordReset: () => void;
  setIsRegisterMode: React.Dispatch<React.SetStateAction<boolean>>;
  resetAuthFeedback: () => void;
  styles: any;
  keyboardOffset: number;
};

export default function AuthForm({
  isRegisterMode,
  authBusy,
  authError,
  authNotice,
  email,
  password,
  firstName,
  lastName,
  street,
  zip,
  city,
  phone,
  birthDate,
  consentMarketing,
  setEmail,
  setPassword,
  setFirstName,
  setLastName,
  setStreet,
  setZip,
  setCity,
  setPhone,
  setConsentMarketing,
  openBirthDatePicker,
  handleAuthSubmit,
  handlePasswordReset,
  setIsRegisterMode,
  resetAuthFeedback,
  styles,
  keyboardOffset,
}: AuthFormProps) {
  const logo = require("../assets/logo.png");

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
          <Image
            source={logo}
            style={styles.logoImage}
          />
          <Text style={styles.loginTitle}>
            {isRegisterMode
              ? "Registriere dich f\u00fcr deine Bonuspunkte"
              : "Willkommen zu deinem\npers\u00f6nlichen Beauty-Begleiter\njederzeit und \u00fcberall"}
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
                <Text style={styles.loginLabel}>Nachname*</Text>
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
                <Text style={styles.loginLabel}>Straße*</Text>
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

              <View style={styles.loginField}>
                <Text style={styles.loginLabel}>Geburtsdatum (TT.MM.JJJJ)*</Text>
                <TouchableOpacity
                  style={[styles.loginInput, styles.dateInput]}
                  activeOpacity={0.7}
                  onPress={() => openBirthDatePicker("register")}
                >
                  <Text
                    style={[
                      styles.dateInputText,
                      birthDate ? styles.dateInputTextValue : null,
                    ]}
                  >
                    {birthDate || "Datum ausw\u00e4hlen"}
                  </Text>
                </TouchableOpacity>
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

          {authNotice ? (
            <View style={styles.loginNoticeBox}>
              <Text style={styles.loginNotice}>{authNotice}</Text>
            </View>
          ) : null}

          {authError && <Text style={styles.loginError}>{authError}</Text>}

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
            <TouchableOpacity style={{ marginTop: 10 }} onPress={handlePasswordReset}>
              <Text style={styles.loginLink}>Passwort vergessen?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={{ marginTop: 16 }}
            onPress={() => {
              setIsRegisterMode((m) => !m);
              resetAuthFeedback();
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
