import React from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BirthdayVoucherCard from "./BirthdayVoucherCard";

type Props = {
  styles: any;
  points: number;
  onOpenRewards: () => void;
  birthdayVoucherAvailable: boolean;
  birthdayVoucherYear: number | null;
  onBirthdayBook: () => void;
  rewardActionsLoading: boolean;
  visibleRewardActions: any[];
  rewardClaims: Record<string, string | boolean>;
  rewardClaimBusy: string | null;
  rewardExpandedId: string | null;
  setRewardExpandedId: (id: string | null) => void;
  onClaimRewardAction: (action: any) => void;
  visitHistory: any[];
  showAllVisits: boolean;
  setShowAllVisits: (value: boolean) => void;
  onOpenFeedback: () => void;
  feedbackSent: boolean;
};

export default function CustomerHome({
  styles,
  points,
  onOpenRewards,
  birthdayVoucherAvailable,
  birthdayVoucherYear,
  onBirthdayBook,
  rewardActionsLoading,
  visibleRewardActions,
  rewardClaims,
  rewardClaimBusy,
  rewardExpandedId,
  setRewardExpandedId,
  onClaimRewardAction,
  visitHistory,
  showAllVisits,
  setShowAllVisits,
  onOpenFeedback,
  feedbackSent,
}: Props) {
  return (
    <>
      <View style={styles.pointsCardWrapper}>
        <View style={styles.pointsCardGlow} />
        <View style={[styles.pointsCard, styles.pointsCardGradient]}>
          <Text style={styles.pointsLabel}>Dein Punktestand</Text>
          <Text style={styles.pointsValue}>{points}</Text>
          <Text style={styles.pointsHint}>
            Du sammelst bei jedem Besuch Punkte, die du gegen Verwöhnmomente
            einlösen kannst.
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 12 }]}
            onPress={onOpenRewards}
          >
            <Text style={styles.primaryButtonText}>Prämien ansehen</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BirthdayVoucherCard
        visible={birthdayVoucherAvailable}
        year={birthdayVoucherYear}
        onBookPress={onBirthdayBook}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prämien-Aktionen</Text>
        {rewardActionsLoading && visibleRewardActions.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 8 }} />
        ) : visibleRewardActions.length === 0 ? (
          <Text style={styles.emptyText}>Keine Aktionen verfügbar.</Text>
        ) : (
          visibleRewardActions.map((action) => {
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
                  activeOpacity={0.9}
                  onPress={() =>
                    setRewardExpandedId(isExpanded ? null : action.id)
                  }
                  style={[
                    styles.accordionHeader,
                    {
                      paddingVertical: 4,
                      paddingHorizontal: 0,
                    },
                  ]}
                >
                  <View>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDescription}>
                      {action.description}
                    </Text>
                  </View>
                  <Text style={styles.dropdownChevron}>
                    {isExpanded ? "▾" : "▸"}
                  </Text>
                </TouchableOpacity>

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

                <Text style={styles.actionPoints}>+{action.points} Punkte</Text>

                {isExpanded && (
                  <Text style={styles.actionDescription}>
                    Jetzt erledigen und im Salon freischalten lassen.
                  </Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    styles.actionButton,
                    (claimed || pending || busy) && styles.actionButtonDisabled,
                  ]}
                  disabled={claimed || pending || busy}
                  onPress={() => onClaimRewardAction(action)}
                >
                  <Text style={styles.primaryButtonText}>
                    {claimed
                      ? "Eingelöst"
                      : pending
                      ? "In Prüfung"
                      : busy
                      ? "Bitte warten..."
                      : "Punkte anfragen"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Deine Besuche</Text>

        {visitHistory.length === 0 ? (
          <Text style={styles.emptyText}>Noch keine Buchungen vorhanden.</Text>
        ) : (
          <>
            {(showAllVisits ? visitHistory : visitHistory.slice(0, 3)).map((v) => {
              const reason =
                v.reason ||
                (typeof v.amount === "number" ? "Salonmitarbeiter" : undefined);
              const employee = v.employeeName;

              return (
                <View key={v.id} style={styles.visitItem}>
                  <Text style={styles.visitDate}>{v.date}</Text>
                  <Text style={styles.visitPoints}>
                    {v.points > 0
                      ? `+${v.points}`
                      : v.points < 0
                      ? `${v.points}`
                      : "0"}{" "}
                    Punkte
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
            })}

            {visitHistory.length > 3 && (
              <TouchableOpacity
                style={[styles.secondaryButton, { marginTop: 12 }]}
                onPress={() => setShowAllVisits(!showAllVisits)}
              >
                <Text style={styles.secondaryButtonText}>
                  {showAllVisits ? "Weniger anzeigen" : "Alle anzeigen"}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.feedbackCardWrapper}>
          <View style={styles.feedbackCardGlow} />
          <TouchableOpacity
            style={[styles.feedbackCard, styles.feedbackCardGradient]}
            onPress={onOpenFeedback}
            activeOpacity={0.9}
          >
            <Text style={styles.sectionTitle}>Feedback zur App</Text>
            <Text style={styles.modalText}>
              Wir freuen uns über deine Rückmeldung. Tippe hier, um Feedback zu schreiben.
            </Text>
          </TouchableOpacity>
        </View>
        {feedbackSent && (
          <Text style={[styles.modalText, { color: "#256029", marginTop: 6 }]}>
            Vielen Dank! Feedback wurde erfasst.
          </Text>
        )}
      </View>
    </>
  );
}
