import { useMemo } from "react";
import { Text, View } from "react-native";

import { useAppAppearance } from "@/lib/app-appearance";
import { createAccountThemedStyles, styles } from "@/features/account/account-screen.styles";

export function StatusBadge({ label, active }: { label: string; active?: boolean }) {
  const { palette, fontFamily } = useAppAppearance();
  const themed = useMemo(
    () => createAccountThemedStyles(palette, fontFamily),
    [palette, fontFamily]
  );

  return (
    <View
      style={[
        styles.statusBadge,
        themed.secondaryButton,
        active && styles.statusBadgeActive,
        active && themed.activeFill
      ]}
    >
      <Text
        selectable={false}
        style={[
          styles.statusBadgeText,
          themed.text,
          active && styles.statusBadgeTextActive,
          active && themed.inverseText
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  const { palette, fontFamily } = useAppAppearance();
  const themed = useMemo(
    () => createAccountThemedStyles(palette, fontFamily),
    [palette, fontFamily]
  );

  return (
    <View style={[styles.infoRow, themed.bottomBorder]}>
      <Text selectable style={[styles.infoLabel, themed.mutedText]}>
        {label}
      </Text>
      <Text selectable style={[styles.infoValue, themed.text]}>
        {value}
      </Text>
    </View>
  );
}

export function StatCard({ label, value }: { label: string; value: number }) {
  const { palette, fontFamily } = useAppAppearance();
  const themed = useMemo(
    () => createAccountThemedStyles(palette, fontFamily),
    [palette, fontFamily]
  );

  return (
    <View style={[styles.statCard, themed.panel]}>
      <Text selectable style={[styles.statValue, themed.text]}>
        {value}
      </Text>
      <Text selectable style={[styles.statLabel, themed.mutedText]}>
        {label}
      </Text>
    </View>
  );
}
