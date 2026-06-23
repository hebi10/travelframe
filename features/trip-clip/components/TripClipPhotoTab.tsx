import { Image } from "expo-image";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/constants/app-theme";
import { Section } from "@/features/trip-clip/trip-clip-screen.components";
import { styles } from "@/features/trip-clip/trip-clip-screen.styles";
import type { PhotoItem } from "@/types/photo";

type TripClipPhotoTabProps = {
  isLoading: boolean;
  photos: PhotoItem[];
  selectedIds: string[];
  isImportingPhotos: boolean;
  getPhotoLabel: (photo: PhotoItem) => string;
  togglePhoto: (photo: PhotoItem) => void;
  deselectPickerPhoto: (photo: PhotoItem) => void;
  renderAddPhotoTile: () => ReactNode;
};

export function TripClipPhotoTab({
  isLoading,
  photos,
  selectedIds,
  isImportingPhotos,
  getPhotoLabel,
  togglePhoto,
  deselectPickerPhoto,
  renderAddPhotoTile
}: TripClipPhotoTabProps) {
  return (
      <Section title="사진 선택">
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoPicker}
          >
            {photos.map((photo) => {
              const selectedIndex = selectedIds.indexOf(photo.id);
              const isSelected = selectedIndex >= 0;

              return (
                <Pressable
                  key={photo.id}
                  style={[styles.photoTile, isSelected && styles.photoTileActive]}
                  onPress={() => togglePhoto(photo)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} contentFit="cover" />
                  <View style={styles.photoTileMeta}>
                    <Text selectable style={styles.photoTileText}>
                      {getPhotoLabel(photo)}
                    </Text>
                    <Text selectable style={styles.photoTileDetail}>
                      {photo.ratioLabel}
                    </Text>
                  </View>
                  {isSelected ? (
                    <>
                      <View style={styles.orderBadge}>
                        <Text selectable={false} style={styles.orderBadgeText}>
                          {selectedIndex + 1}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.removePhotoButton}
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          deselectPickerPhoto(photo);
                        }}
                      >
                        <Text selectable={false} style={styles.removePhotoButtonText}>
                          X
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </Pressable>
              );
            })}
            {renderAddPhotoTile()}
          </ScrollView>
        ) : (
          <View style={styles.emptyPhotoPicker}>
            <Text selectable style={styles.emptyText}>
              아직 사진이 없습니다. 먼저 사진을 촬영하거나 편집해 주세요.
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoPicker}
            >
              {renderAddPhotoTile()}
            </ScrollView>
          </View>
        )}
      </Section>
  );
}
