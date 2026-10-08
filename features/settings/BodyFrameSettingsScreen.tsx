
      <View style={styles.optionCopy}>
        <Text style={[styles.optionLabel, { color: palette.text }]}>{label}</Text>
        <Text style={[styles.optionDetail, { color: palette.muted }]}>{detail}</Text>
      </View>
      <Text style={[styles.optionMark, { color: active ? palette.text : palette.faint }]}>
        {active ? "●" : "○"}
      </Text>
    </Pressable>
  );
}

export default function BodyFrameSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, palette } = useAppAppearance();
  const { isLoggedIn, subscription, user } = useAuth();
  const planEntitlements = getPlanEntitlements({ isLoggedIn, subscription });
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const [guideReplaySignal, setGuideReplaySignal] = useState(0);
  const [activeSetting, setActiveSetting] = useState<InlineSettingKey | null>(null);
  const [saving, setSaving] = useState(false);
  const modalSafeStyle = useMemo(
    () => ({
      paddingTop: Math.max(insets.top + 14, 24),
      paddingBottom: Math.max(insets.bottom + 14, 24)
    }),
    [insets.bottom, insets.top]
  );

  const modalTitle = useMemo(() => {
    if (activeSetting === "referencePhotoVisible") return "기준 사진 표시";
    if (activeSetting === "overlayOpacity") return "기준 사진 투명도";
    if (activeSetting === "cameraRatio") return "촬영 비율";
    if (activeSetting === "storageMode") return "저장 방식";
    if (activeSetting === "cloudBackup") return "클라우드 백업";
    if (activeSetting === "themeMode") return "화면 모드";
    if (activeSetting === "fontStyle") return "폰트 스타일";
    if (activeSetting === "fontSize") return "글자 크기";
    return "";
  }, [activeSetting]);

  const updateSetting = async (updates: Partial<AppSettings>) => {
    if (saving) return;

    setSaving(true);
    try {
      await saveAppSettings({
        ...settings,
        ...updates
      });
      setActiveSetting(null);
    } finally {
      setSaving(false);
    }
  };

  const enableCloudBackup = () => {
    if (!planEntitlements.canBackupToCloud) {
      setActiveSetting(null);
      router.push("/account");
      return;
    }

    void updateSetting({
      storageMode: "local_backup",
      cloudBackupEnabled: true
    });
  };

  const disableCloudBackup = () => {
    void updateSetting({
      storageMode: "local_only",
      cloudBackupEnabled: false
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 20, 28),
            paddingBottom: insets.bottom + 36
          }
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>설정</Text>
          <Text style={[styles.pageDetail, { color: palette.muted }]}>
            바디 프레임의 촬영, 저장, 영상과 계정 설정을 관리합니다.
          </Text>
        </View>

        <SectionBlock title="촬영">
          <BodyFrameSettingRow
            label="기준 사진 표시"
            detail="촬영할 때 이전 기록을 기준 사진으로 겹쳐 표시"
            mark={settings.referencePhotoVisible ? "켜짐" : "꺼짐"}
            onPress={() => setActiveSetting("referencePhotoVisible")}
          />
          <BodyFrameSettingRow
            label="기준 사진 투명도"
            detail="촬영 화면에 겹쳐 보이는 기준 사진의 투명도"
            mark={`${Math.round(settings.overlayOpacity * 100)}%`}
            onPress={() => setActiveSetting("overlayOpacity")}
          />
          <BodyFrameSettingRow
            label="촬영 비율"
            detail="몸의 변화를 기록할 기본 카메라 비율"
            mark={settings.cameraRatio}
            onPress={() => setActiveSetting("cameraRatio")}
          />
          <BodyFrameSettingRow
            label="촬영 세부 설정"
            detail="가이드, 줌, 저장 범위와 카메라 옵션"
            mark="열기"
            onPress={() => router.push("/advanced-settings")}
          />
        </SectionBlock>

        <SectionBlock title="저장 및 백업">
          <BodyFrameSettingRow
            label="저장 방식"
            detail="앱 로컬 저장과 클라우드 백업 방식"
            mark={getStorageModeLabel(settings.storageMode)}
            onPress={() => setActiveSetting("storageMode")}
          />
          <BodyFrameSettingRow
            label="클라우드 백업"
            detail={
              planEntitlements.canBackupToCloud
                ? "현재 플랜에서 백업을 사용할 수 있습니다."
                : "Pro 이상에서 클라우드 백업을 사용할 수 있습니다."
            }
            mark={settings.cloudBackupEnabled ? "켜짐" : "꺼짐"}
            onPress={() => setActiveSetting("cloudBackup")}
          />
          <BodyFrameSettingRow
            label="저장·백업 세부 설정"
            detail="사진 화질, 저장 범위, 백업 대상과 복원"
            mark="열기"
            onPress={() => router.push("/advanced-settings")}
          />
        </SectionBlock>

        <SectionBlock title="변화 영상">
          <BodyFrameSettingRow
            label="사진 간격"
            detail="영상 화면에서 사진 간격을 조절합니다."
            mark="기본 0.1초"
            onPress={() => router.push("/video-create")}
          />
          <BodyFrameSettingRow
            label="출력 규격"
            detail="기본은 세로 1080p이며 영상 화면에서 변경합니다."
            mark="3:4 · 1080p"
            onPress={() => router.push("/video-create")}
          />
        </SectionBlock>

        <SectionBlock title="화면">
          <BodyFrameSettingRow
            label="화면 모드"
            detail="다크를 기본으로 라이트/시스템 모드도 지원합니다."
            mark={themeLabel[settings.themeMode]}
            onPress={() => setActiveSetting("themeMode")}
          />
          <BodyFrameSettingRow
            label="폰트 스타일"
            detail="앱 전체에서 사용할 글꼴"
            mark={getFontOptionLabel(settings.fontStyle)}
            onPress={() => setActiveSetting("fontStyle")}
          />
          <BodyFrameSettingRow
            label="글자 크기"
            detail="앱 전체에서 사용할 기본 글자 크기"
            mark={fontSizeLabel[settings.fontSize]}
            onPress={() => setActiveSetting("fontSize")}
          />
          <BodyFrameSettingRow
            label="사용 가이드"
            detail="바디 프레임의 핵심 사용 방법을 다시 확인합니다."
            mark="다시 보기"
            onPress={() => setGuideReplaySignal((value) => value + 1)}
          />
        </SectionBlock>

        <SectionBlock title="계정 및 플랜">
          <BodyFrameSettingRow
            label={isLoggedIn ? "내 계정" : "로그인"}
            detail={isLoggedIn ? user?.email ?? "로그인된 계정" : "Google 또는 이메일로 로그인"}
            mark={isLoggedIn ? planEntitlements.label : "무료"}
            onPress={() => router.push("/account")}
          />
          <BodyFrameSettingRow
            label="플랜 및 Google Play 결제"
            detail="Pro/Expert, 광고 제거, 구매 복원과 구독 상태"
            mark={planEntitlements.label}
            onPress={() => router.push("/account")}
          />
        </SectionBlock>

        <SectionBlock title="정보 및 개인정보">
          <BodyFrameSettingRow
            label="바디 프레임"
            detail="현재 설치된 앱 버전"
            mark={`v${version}`}
          />
          <BodyFrameSettingRow
            label="개인정보처리방침"
            detail="권한 사용과 데이터 처리 안내"
            mark="열기"
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          />
          <BodyFrameSettingRow
            label="이용약관"
            detail="서비스 이용과 Google Play 결제·구독 조건"
            mark="열기"
            onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)}
          />
        </SectionBlock>
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={Boolean(activeSetting)}
        onRequestClose={() => setActiveSetting(null)}
      >
        <Pressable accessibilityRole="button"
                      <Text style={[styles.planButtonText, { color: palette.text }]}>
                        플랜 보기
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}

              {activeSetting === "themeMode"
                ? themeOptions.map((theme) => (
                    <SettingOptionRow
                      key={theme.value}
                      label={theme.label}
                      detail={theme.detail}
                      active={settings.themeMode === theme.value}
                      onPress={() => void updateSetting({ themeMode: theme.value })}
                    />
                  ))
                : null}

              {activeSetting === "fontStyle"
                ? APP_FONT_OPTIONS.map((font) => (
                    <SettingOptionRow
                      key={font.value}
                      label={font.label}
                      detail={font.detail}
                      active={settings.fontStyle === font.value}
                      onPress={() => void updateSetting({ fontStyle: font.value })}
                    />
                  ))
                : null}

              {activeSetting === "fontSize"
                ? fontSizeOptions.map((fontSize) => (
                    <SettingOptionRow
                      key={fontSize.value}
                      label={fontSize.label}
                      detail={fontSize.detail}
                      active={settings.fontSize === fontSize.value}
                      onPress={() => void updateSetting({ fontSize: fontSize.value })}
                    />
                  ))
                : null}
            </ScrollView>

            {saving ? (
              <Text style={[styles.savingText, { color: palette.muted }]}>
                설정을 저장하는 중입니다.
              </Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <AppGuideOverlay tabKey="camera" replaySignal={guideReplaySignal} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    width: "100%",
    maxWidth: bodyFrameDesign.contentMaxWidth,
    alignSelf: "center",
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    gap: bodyFrameDesign.sectionGap
  },
  header: {
    gap: 6
  },
  settingRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: bodyFrameDesign.borderWidth,
    borderRadius: bodyFrameDesign.cardRadius
  },
  settingRowCopy: {
    flex: 1,
    gap: 3
  },
  settingRowLabel: {
    fontSize: bodyFrameTypography.rowTitle,
    fontWeight: "600"
  },
  settingRowDetail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  settingRowMark: {
    maxWidth: 118,
    fontSize: bodyFrameTypography.caption,
    fontWeight: "600",
    textAlign: "right"
  },
  pageTitle: {
    fontSize: bodyFrameTypography.pageTitle,
    fontWeight: "600"
  },
  pageDetail: {
    fontSize: bodyFrameTypography.body,
    lineHeight: 20
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.62)"
  },
  modalPanel: {
    width: "100%",
    maxWidth: bodyFrameDesign.contentMaxWidth,
    alignSelf: "center",
    maxHeight: "82%",
    paddingHorizontal: bodyFrameDesign.horizontalPadding,
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: bodyFrameDesign.borderWidth,
    borderTopLeftRadius: bodyFrameDesign.bottomSheetRadius,
    borderTopRightRadius: bodyFrameDesign.bottomSheetRadius
  },
  modalHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginBottom: 14,
    backgroundColor: "#3A3A3E"
  },
  modalHeader: {
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12
  },
  modalTitle: {
    flex: 1,
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "600"
  },
  modalCloseButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: bodyFrameDesign.borderWidth
  },
  modalCloseText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  optionList: {
    gap: 8,
    paddingBottom: 8
  },
  optionRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: bodyFrameDesign.borderWidth
  },
  optionCopy: {
    flex: 1,
    gap: 3
  },
  optionLabel: {
    fontSize: bodyFrameTypography.rowTitle,
    fontWeight: "600"
  },
  optionDetail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 17
  },
  optionMark: {
    width: 22,
    fontSize: 16,
    textAlign: "center"
  },
  planButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderWidth: bodyFrameDesign.borderWidth
  },
  planButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  savingText: {
    paddingVertical: 8,
    fontSize: bodyFrameTypography.caption,
    textAlign: "center"
  }
});
