import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";

type Props = {
  visible: boolean;
  year: number | null;
  onBookPress?: () => void;
};

export function BirthdayVoucherCard({ visible, year, onBookPress }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.98)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [confettiKey, setConfettiKey] = useState(0);
  const shotOnce = useRef(false);
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const width = Dimensions.get("window").width;

  useEffect(() => {
    if (!visible) return;

    if (!shotOnce.current) {
      shotOnce.current = true;
      setConfettiKey((k) => k + 1);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0.98);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.delay(800),
      ])
    );
    loop.start();
    pulseLoop.current = loop;
    return () => {
      loop.stop();
    };
  }, [visible, glowAnim, scaleAnim]);

  if (!visible) return null;

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.9],
  });

  return (
    <View style={styles.birthdayWrapper}>
      <Animated.View
        style={[
          styles.birthdayGlow,
          {
            opacity: glowOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.birthdayCardShell,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.birthdayBadge}>
          <Text style={styles.birthdayBadgeText}>Aktiv</Text>
        </View>
        <Text style={styles.birthdayTitle}>Geburtstags-Gutschein</Text>
        <Text style={styles.birthdayAmount}>5 €</Text>
        <Text style={styles.birthdaySubtitle}>
          Dein Geburtstags-Gutschein ist aktiv.
          {year ? `\nGültig für 12 Monate` : ""}
        </Text>
        <TouchableOpacity
          onPress={onBookPress}
          style={[styles.primaryButton, { marginTop: 10 }]}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>Jetzt Termin sichern</Text>
        </TouchableOpacity>
        <ConfettiCannon
          key={confettiKey}
          count={70}
          origin={{ x: width / 2, y: -10 }}
          autoStart
          fadeOut
          explosionSpeed={450}
          fallSpeed={2200}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  primaryButton: {
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
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default BirthdayVoucherCard;
