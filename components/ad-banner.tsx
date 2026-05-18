import { StyleSheet, Text, View } from "react-native";

import { GoogleMobileBanner } from "@/components/google-mobile-banner";
import { colors, typography } from "@/constants/app-theme";
import { getAdPlacementLabel, type AdPlacement, shouldShowAds } from "@/lib/ad-entitlement";
import { canUseNativeAdMob, getBannerAdUnitId, isAdMobConfigured } from "@/lib/admob-config";
import { useAppAppearance } from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";

type AdBannerProps = {
  placement: AdPlacement;
  compact?: boolean;
};

export function AdBanner({ placement, compact = false }: AdBannerProps) {
  const { subscription } = useAuth();
  const { palette } = useAppAppearance();
  const adUnitId = getBannerAdUnitId();
  const configured = isAdMobConfigured();

  if (!shouldShowAds(subscription)) {
    return null;
  }

  if (canUseNativeAdMob() && adUnitId) {
    return (
      <View
        style={[
          styles.nativeBanner,
          compact && styles.nativeBannerCompact,
          {
            borderColor: palette.line,
            backgroundColor: palette.surface
          }
        ]}
      >
        <GoogleMobileBanner adUnitId={adUnitId} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.banner,
        compact && styles.bannerCompact,
        {
          borderColor: palette.line,
          backgroundColor: palette.surface
        }
      ]}
    >
      <View style={styles.copy}>
        <Text selectable={false} style={[styles.label, { color: palette.muted }]}>
          광고
        </Text>
        <Text selectable style={[styles.title, { color: palette.text }]}>
          {getAdPlacementLabel(placement)}
        </Text>
        <Text selectable style={[styles.detail, { color: palette.muted }]}>
          {configured
            ? "Google AdMob 배너 단위가 연결되었습니다."
            : "광고 제거 또는 구독 이용 시 표시되지 않습니다."}
        </Text>
        {adUnitId ? (
          <Text selectable={false} style={[styles.unitLabel, { color: palette.faint }]}>
            Android 배너
          </Text>
        ) : null}
      </View>
      <View style={[styles.adMark, { borderColor: palette.text }]}>
        <Text selectable={false} style={[styles.adMarkText, { color: palette.text }]}>
          AD
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeBanner: {
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1
  },
  nativeBannerCompact: {
    minHeight: 54
  },
  banner: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1
  },
  bannerCompact: {
    minHeight: 64,
    paddingVertical: 11
  },
  copy: {
    flex: 1,
    gap: 4
  },
  label: {
    fontSize: typography.eyebrow,
    fontWeight: "900",
    letterSpacing: 0
  },
  title: {
    fontSize: typography.body,
    fontWeight: "900",
    lineHeight: 18,
    letterSpacing: 0
  },
  detail: {
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  unitLabel: {
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
    letterSpacing: 0
  },
  adMark: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: colors.background
  },
  adMarkText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0
  }
});
