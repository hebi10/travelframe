import { Image } from "expo-image";
import { Text, View } from "react-native";

import { Section, SmallButton, TimelineDurationControl } from "@/features/trip-clip/trip-clip-screen.components";
import { styles } from "@/features/trip-clip/trip-clip-screen.styles";
import type { PhotoItem } from "@/types/photo";

type TimelineDurationEditing = {
  editingDurationId: string | null;
  beginDurationEditing: (id: string, index: number) => void;
  changeDuration: (id: string, index: number, delta: number) => void;
};

type TripClipTimelineTabProps = {
  selectedPhotos: PhotoItem[];
  getPhotoLabel: (photo: PhotoItem) => string;
  getFrameDuration: (id: string, index: number) => number;
  timelineDurationEditing: TimelineDurationEditing;
  movePhoto: (id: string, direction: -1 | 1) => void;
};

export function TripClipTimelineTab({
  selectedPhotos,
  getPhotoLabel,
  getFrameDuration,
  timelineDurationEditing,
  movePhoto
}: TripClipTimelineTabProps) {
  return (
      <Section title="타임라인">
        {selectedPhotos.length > 0 ? (
          <View style={styles.timeline}>
            {selectedPhotos.map((photo, index) => (
              <View key={photo.id} style={styles.timelineRow}>
                <Image source={{ uri: photo.uri }} style={styles.timelineThumb} contentFit="cover" />
                <View style={styles.timelineCopy}>
                  <Text selectable style={styles.timelineTitle}>
                    {String(index + 1).padStart(2, "0")} / {getPhotoLabel(photo)}
                  </Text>
                  <TimelineDurationControl
                    duration={getFrameDuration(photo.id, index)}
                    editing={timelineDurationEditing.editingDurationId === photo.id}
                    onBeginEditing={() => timelineDurationEditing.beginDurationEditing(photo.id, index)}
                  />
                </View>
                <View style={styles.smallControls}>
                  <View style={styles.controlLine}>
                    <Text selectable={false} style={styles.controlLabel}>
                      순서
                    </Text>
                    <SmallButton label="위" onPress={() => movePhoto(photo.id, -1)} />
                    <SmallButton label="아래" onPress={() => movePhoto(photo.id, 1)} />
                  </View>
                  <View style={styles.controlLine}>
                    <Text selectable={false} style={styles.controlLabel}>
                      타임
                    </Text>
                    <SmallButton label="-" onPress={() => timelineDurationEditing.changeDuration(photo.id, index, -0.5)} />
                    <SmallButton label="+" onPress={() => timelineDurationEditing.changeDuration(photo.id, index, 0.5)} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text selectable style={styles.emptyText}>
            타임라인을 만들려면 사진을 1장 이상 선택해 주세요.
          </Text>
        )}
      </Section>
  );
}
