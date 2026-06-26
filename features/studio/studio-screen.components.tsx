import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Image as NativeImage, Modal, Pressable, Text, View } from "react-native";

import { SectionBlock } from "@/components/section-block";
import { colors } from "@/constants/app-theme";
import { PAGE_SIZE_OPTIONS, formatDate, formatDuration, type PageSize, type StudioTab, type StudioWorkItem } from "@/features/studio/studio-screen.model";
import { styles } from "@/features/studio/studio-screen.styles";
import { useAppAppearance } from "@/lib/app-appearance";
import type { PhotoItem } from "@/types/photo";

function PhotoCard({
  photo,
  router,
  canEditLibraryItems,
  onDelete,
  onRequireLoginForEdit
}: {
  photo: PhotoItem;
  router: ReturnType<typeof useRouter>;
  canEditLibraryItems: boolean;
  onDelete: (photo: PhotoItem) => void;
  onRequireLoginForEdit: () => void;
}) {
  const { palette } = useAppAppearance();
  const isDark = palette.background !== colors.background;
  const filledButtonStyle = {
    borderWidth: isDark ? 1 : 0,
    borderColor: palette.text,
    backgroundColor: isDark ? "transparent" : palette.text
  };
  const filledButtonTextStyle = {
    color: isDark ? palette.text : palette.inverse
  };
  const secondaryButtonStyle = {
    borderColor: palette.line,
    backgroundColor: palette.background
  };
  const secondaryButtonTextStyle = {
    color: palette.text
  };
  const secondaryDeleteButtonTextStyle = {
    color: palette.muted
  };
  const thumbnailStyle = {
    borderColor: palette.line,
    backgroundColor: palette.surface
  };
  const primaryMetaTextStyle = {
    color: palette.text
  };
  const secondaryMetaTextStyle = {
    color: palette.muted
  };

  return (
    <View style={[styles.photoCard, { borderColor: palette.line, backgroundColor: palette.background }]}>
      <Pressable onPress={() => router.push(`/photo/${photo.id}` as Href)}>
        <NativeImage
          source={{ uri: photo.uri }}
          style={[styles.thumbnail, thumbnailStyle]}
          resizeMode="cover"
        />
      </Pressable>
      <View style={styles.photoMeta}>
        <Text selectable={false} style={[styles.photoDate, primaryMetaTextStyle]}>
          {formatDate(photo.createdAt)}
        </Text>
        <Text selectable={false} style={[styles.metaText, secondaryMetaTextStyle]}>
          {photo.ratioLabel} / {photo.edited ? "편집됨" : "원본"}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          style={[styles.cardButton, filledButtonStyle]}
          onPress={() => {
            if (!canEditLibraryItems) {
              onRequireLoginForEdit();
              return;
            }

            router.push(`/edit?photoId=${photo.id}` as Href);
          }}
        >
          <Text selectable={false} style={[styles.cardButtonText, filledButtonTextStyle]}>
            편집
          </Text>
        </Pressable>
        <Pressable
          style={[styles.cardLightButton, secondaryButtonStyle]}
          onPress={() => router.push(`/photo/${photo.id}` as Href)}
        >
          <Text selectable={false} style={[styles.cardLightButtonText, secondaryButtonTextStyle]}>
            보기
          </Text>
        </Pressable>
        <Pressable
          style={[styles.cardLightButton, secondaryButtonStyle]}
          onPress={() => onDelete(photo)}
        >
          <Text
            selectable={false}
            style={[styles.cardDeleteButtonText, secondaryDeleteButtonTextStyle]}
          >
            삭제
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function StudioIcon({
  kind,
  active = false
}: {
  kind: StudioTab | "upload";
  active?: boolean;
}) {
  const { palette } = useAppAppearance();
  const isDark = palette.background !== colors.background;
  const isUploadIcon = kind === "upload";
  const iconColor = active && !isDark && !isUploadIcon ? palette.inverse : palette.text;
  const lineStyle = { borderColor: iconColor, backgroundColor: iconColor };

  if (kind === "videos") {
    return (
      <View style={[styles.studioIconBox, { borderColor: iconColor }]}>
        <View style={[styles.studioIconPlay, { borderLeftColor: iconColor }]} />
      </View>
    );
  }

  if (kind === "works") {
    return (
      <View style={styles.studioFolderIcon}>
        <View style={[styles.studioFolderTab, lineStyle]} />
        <View style={[styles.studioFolderBody, { borderColor: iconColor }]} />
      </View>
    );
  }

  if (kind === "upload") {
    return (
      <View style={styles.studioUploadIcon}>
        <View style={[styles.studioUploadStem, lineStyle]} />
        <View style={[styles.studioUploadHead, { borderColor: iconColor }]} />
      </View>
    );
  }

  return (
    <View style={[styles.studioIconBox, { borderColor: iconColor }]}>
      <View style={[styles.studioIconDot, lineStyle]} />
      <View style={[styles.studioIconBase, lineStyle]} />
    </View>
  );
}

export function PageSizeSelector({
  value,
  onChange
}: {
  value: PageSize;
  onChange: (value: PageSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const { palette } = useAppAppearance();
  const isDark = palette.background !== colors.background;
  const filledButtonStyle = {
    borderColor: palette.text,
    backgroundColor: isDark ? "transparent" : palette.text
  };
  const filledButtonTextStyle = {
    color: isDark ? palette.text : palette.inverse
  };

  return (
    <View style={styles.pageSizeBar}>
      <Text selectable={false} style={styles.pageSizeLabel}>
        표시
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[
          styles.pageSizeSelect,
          { borderColor: palette.line, backgroundColor: palette.background }
        ]}
        onPress={() => setOpen(true)}
      >
        <Text selectable={false} style={[styles.pageSizeSelectText, { color: palette.text }]}>
          {value}개
        </Text>
        <Text selectable={false} style={[styles.pageSizeSelectChevron, { color: palette.muted }]}>
          v
        </Text>
      </Pressable>
      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.pageSizeDropdownBackdrop}>
          <Pressable style={styles.pageSizeDropdownDismissLayer} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.pageSizeDropdown,
              { borderColor: palette.line, backgroundColor: palette.background }
            ]}
          >
            {PAGE_SIZE_OPTIONS.map((option) => {
              const isActive = value === option;

              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  style={[
                    styles.pageSizeDropdownItem,
                    { borderColor: palette.line, backgroundColor: palette.background },
                    isActive && styles.pageSizeDropdownItemActive,
                    isActive && filledButtonStyle
                  ]}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Text
                    selectable={false}
                    style={[
                      styles.pageSizeDropdownItemText,
                      { color: palette.text },
                      isActive && styles.pageSizeDropdownItemTextActive,
                      isActive && filledButtonTextStyle
                    ]}
                  >
                    {option}개
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getPaginatedItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages
  };
}

export function PaginatedPhotoGrid({
  items,
  page,
  pageSize,
  router,
  canEditLibraryItems,
  onDeletePhoto,
  onRequireLoginForEdit,
  onPageChange
}: {
  items: PhotoItem[];
  page: number;
  pageSize: PageSize;
  router: ReturnType<typeof useRouter>;
  canEditLibraryItems: boolean;
  onDeletePhoto: (photo: PhotoItem) => void;
  onRequireLoginForEdit: () => void;
  onPageChange: (page: number) => void;
}) {
  const result = getPaginatedItems(items, page, pageSize);

  return (
    <View style={styles.paginatedList}>
      <FlatList
        data={result.items}
        keyExtractor={(photo) => photo.id}
        numColumns={2}
        scrollEnabled={false}
        contentContainerStyle={styles.photoGrid}
        columnWrapperStyle={styles.photoGridRow}
        ItemSeparatorComponent={() => <View style={styles.photoGridRowGap} />}
        renderItem={({ item: photo }) => (
          <View style={styles.photoGridItem}>
            <PhotoCard
              photo={photo}
              router={router}
              canEditLibraryItems={canEditLibraryItems}
              onDelete={onDeletePhoto}
              onRequireLoginForEdit={onRequireLoginForEdit}
            />
          </View>
        )}
      />
      <PaginationControls
        page={result.page}
        totalPages={result.totalPages}
        totalItems={items.length}
        onPageChange={onPageChange}
      />
    </View>
  );
}

export function UsageBadge({ label, count, limit }: { label: string; count: number; limit: number }) {
  return (
    <View style={styles.backupUsageBadge}>
      <Text selectable={false} style={styles.backupUsageText}>
        {label} {count}/{limit}
      </Text>
    </View>
  );
}

export function WorkSection({
  title,
  emptyDetail,
  items,
  page,
  pageSize,
  router,
  onDeleteWork,
  canEditLibraryItems,
  canUseVideoCreation,
  onRequireLoginForEdit,
  onRequireLoginForVideo,
  onPageChange,
  usage
}: {
  title: string;
  emptyDetail: string;
  items: StudioWorkItem[];
  page: number;
  pageSize: PageSize;
  router: ReturnType<typeof useRouter>;
  onDeleteWork: (work: StudioWorkItem) => void;
  canEditLibraryItems: boolean;
  canUseVideoCreation: boolean;
  onRequireLoginForEdit: () => void;
  onRequireLoginForVideo: () => void;
  onPageChange: (page: number) => void;
  usage?: { label: string; count: number; limit: number } | null;
}) {
  const result = getPaginatedItems(items, page, pageSize);

  return (
    <SectionBlock title={title}>
      {usage ? (
        <UsageBadge label={usage.label} count={usage.count} limit={usage.limit} />
      ) : null}
      {items.length > 0 ? (
        <View style={styles.paginatedList}>
          <View style={styles.videoList}>
            {result.items.map((work) => (
              <WorkCard
                key={`${work.kind}-${work.item.id}`}
                work={work}
                router={router}
                canEditLibraryItems={canEditLibraryItems}
                canUseVideoCreation={canUseVideoCreation}
                onDelete={onDeleteWork}
                onRequireLoginForEdit={onRequireLoginForEdit}
                onRequireLoginForVideo={onRequireLoginForVideo}
              />
            ))}
          </View>
          <PaginationControls
            page={result.page}
            totalPages={result.totalPages}
            totalItems={items.length}
            onPageChange={onPageChange}
          />
        </View>
      ) : (
        <EmptyState title={`${title} 작업물이 없습니다.`} detail={emptyDetail} />
      )}
    </SectionBlock>
  );
}

function PaginationControls({
  page,
  totalPages,
  totalItems,
  onPageChange
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <Text selectable={false} style={styles.paginationMeta}>
        총 {totalItems}개
      </Text>
    );
  }

  return (
    <View style={styles.paginationBar}>
      <Pressable
        disabled={page <= 0}
        style={[styles.paginationButton, page <= 0 && styles.paginationButtonDisabled]}
        onPress={() => onPageChange(page - 1)}
      >
        <Text selectable={false} style={styles.paginationButtonText}>
          이전
        </Text>
      </Pressable>
      <Text selectable={false} style={styles.paginationMeta}>
        {page + 1} / {totalPages} · 총 {totalItems}개
      </Text>
      <Pressable
        disabled={page >= totalPages - 1}
        style={[
          styles.paginationButton,
          page >= totalPages - 1 && styles.paginationButtonDisabled
        ]}
        onPress={() => onPageChange(page + 1)}
      >
        <Text selectable={false} style={styles.paginationButtonText}>
          다음
        </Text>
      </Pressable>
    </View>
  );
}

function WorkCard({
  work,
  router,
  canEditLibraryItems,
  canUseVideoCreation,
  onDelete,
  onRequireLoginForEdit,
  onRequireLoginForVideo
}: {
  work: StudioWorkItem;
  router: ReturnType<typeof useRouter>;
  canEditLibraryItems: boolean;
  canUseVideoCreation: boolean;
  onDelete: (work: StudioWorkItem) => void;
  onRequireLoginForEdit: () => void;
  onRequireLoginForVideo: () => void;
}) {
  const { palette } = useAppAppearance();
  const pressedPanelStyle = {
    backgroundColor: palette.surfaceStrong
  };

  if (work.kind === "single-image") {
    const photo = work.item;

    return (
      <View style={styles.videoCard}>
        <NativeImage source={{ uri: photo.uri }} style={styles.videoThumb} resizeMode="cover" />
        <Pressable
          style={({ pressed }) => [styles.videoCopy, pressed && pressedPanelStyle]}
          onPress={() => router.push(`/photo/${photo.id}` as Href)}
        >
          <Text selectable={false} style={styles.videoKind}>
            단일 이미지
          </Text>
          <Text selectable={false} style={styles.videoTitle}>
            편집 이미지
          </Text>
          <Text selectable={false} style={styles.metaText}>
            {formatDate(photo.createdAt)} / {photo.ratioLabel}
          </Text>
          <Text selectable={false} style={styles.metaText}>
            사진 편집 결과
          </Text>
        </Pressable>
        <View style={styles.workActions}>
          <Pressable
            style={styles.workEditButton}
            onPress={() => {
              if (!canEditLibraryItems) {
                onRequireLoginForEdit();
                return;
              }

              router.push(`/edit?photoId=${photo.id}` as Href);
            }}
          >
            <Text selectable={false} style={styles.workEditButtonText}>
              다시 편집
            </Text>
          </Pressable>
          <Pressable
            style={styles.workDeleteButton}
            onPress={() => onDelete(work)}
          >
            <Text selectable={false} style={styles.workDeleteButtonText}>
              삭제
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (work.kind === "video") {
    const video = work.item;

    return (
      <View style={styles.videoCard}>
        {video.coverUri ? (
          <Image source={{ uri: video.coverUri }} style={styles.videoThumb} contentFit="cover" />
        ) : (
          <View style={styles.videoThumbEmpty} />
        )}
        <View style={styles.videoCopy}>
          <Text selectable={false} style={styles.videoKind}>
            저장한 영상
          </Text>
          <Text selectable={false} style={styles.videoTitle}>
            {video.title}
          </Text>
          <Text selectable={false} style={styles.metaText}>
            {formatDate(video.createdAt)} / {video.ratio} / {formatDuration(video.duration)}
          </Text>
          <Text selectable={false} style={styles.metaText}>
            사진 {video.photoIds.length}장 / {video.musicLabel}
          </Text>
        </View>
        <View style={styles.workActions}>
          <Pressable
            style={styles.workEditButton}
            onPress={() => {
              if (!canUseVideoCreation) {
                onRequireLoginForVideo();
                return;
              }

              router.push({
                pathname: "/trip-clip",
                params: { videoId: video.id, returnTo: "/studio?tab=works" }
              } as Href);
            }}
          >
            <Text selectable={false} style={styles.workEditButtonText}>
              다시 편집
            </Text>
          </Pressable>
          <Pressable
            style={styles.workDeleteButton}
            onPress={() => onDelete(work)}
          >
            <Text selectable={false} style={styles.workDeleteButtonText}>
              삭제
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const bundle = work.item;

  return (
    <View style={styles.videoCard}>
      {bundle.coverUri ? (
        <Image source={{ uri: bundle.coverUri }} style={styles.videoThumb} contentFit="cover" />
      ) : (
        <View style={styles.videoThumbEmpty} />
      )}
        <Pressable
          style={({ pressed }) => [styles.videoCopy, pressed && pressedPanelStyle]}
          onPress={() => {
            if (!canUseVideoCreation) {
              onRequireLoginForVideo();
              return;
            }

            router.push({
              pathname: "/trip-clip",
              params: { bundleId: bundle.id, returnTo: "/studio?tab=works" }
            } as Href);
          }}
        >
        <Text selectable={false} style={styles.videoKind}>
          영상 만들기 작업
        </Text>
        <Text selectable={false} style={styles.videoTitle}>
          {bundle.title}
        </Text>
        <Text selectable={false} style={styles.metaText}>
          {formatDate(bundle.createdAt)} / {bundle.ratio}
        </Text>
        <Text selectable={false} style={styles.metaText}>
          이미지 {bundle.photoIds.length}장
        </Text>
      </Pressable>
    <View style={styles.workActions}>
      <Pressable
        style={styles.workEditButton}
        onPress={() => {
          if (!canUseVideoCreation) {
            onRequireLoginForVideo();
            return;
          }

          router.push({
            pathname: "/trip-clip",
            params: { bundleId: bundle.id, returnTo: "/studio?tab=works" }
          } as Href);
        }}
      >
        <Text selectable={false} style={styles.workEditButtonText}>
          다시 편집
        </Text>
      </Pressable>
      <Pressable
        style={styles.workDeleteButton}
        onPress={() => onDelete(work)}
      >
        <Text selectable={false} style={styles.workDeleteButtonText}>
          삭제
        </Text>
      </Pressable>
    </View>
  </View>
);
}

export function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.text} />
    </View>
  );
}

export function LibraryErrorState({
  message,
  onRetry
}: {
  message: string;
  onRetry: () => void;
}) {
  const { palette } = useAppAppearance();
  const retryButtonStyle = {
    borderColor: palette.text,
    backgroundColor: palette.text
  };
  const retryButtonTextStyle = {
    color: palette.inverse
  };

  return (
    <View style={styles.libraryErrorState}>
      <Text selectable={false} style={[styles.emptyTitle, { color: palette.text }]}>
        보관함을 불러오지 못했습니다
      </Text>
      <Text selectable={false} style={[styles.emptyDetail, { color: palette.muted }]}>
        {message}
      </Text>
      <Pressable style={[styles.retryButton, retryButtonStyle]} onPress={onRetry}>
        <Text selectable={false} style={[styles.retryButtonText, retryButtonTextStyle]}>
          다시 시도
        </Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.emptyState}>
      <Text selectable={false} style={styles.emptyTitle}>
        {title}
      </Text>
      <Text selectable={false} style={styles.emptyDetail}>
        {detail}
      </Text>
    </View>
  );
}
