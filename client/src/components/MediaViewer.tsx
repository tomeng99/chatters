import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode, VideoReadyForDisplayEvent } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type MediaType = 'image' | 'video';

interface MediaViewerProps {
  visible: boolean;
  uri: string;
  mediaType: MediaType;
  onClose: () => void;
}

export default function MediaViewer({ visible, uri, mediaType, onClose }: MediaViewerProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const videoRef = useRef<Video>(null);
  const [videoNaturalSize, setVideoNaturalSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!visible) {
      setVideoNaturalSize(null);
      videoRef.current?.pauseAsync().catch(() => {});
      videoRef.current?.setPositionAsync(0).catch(() => {});
    }
  }, [visible]);

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleVideoReadyForDisplay = useCallback((event: VideoReadyForDisplayEvent) => {
    const { width, height } = event.naturalSize;
    if (width > 0 && height > 0) {
      setVideoNaturalSize({ width, height });
    }
  }, []);

  const videoStyle = useMemo(() => {
    const maxWidth = Math.max(windowWidth - 24, 160);
    const maxHeight = Math.max(windowHeight - insets.top - insets.bottom - 96, 160);

    if (!videoNaturalSize) {
      return {
        width: maxWidth,
        height: maxHeight,
      };
    }

    const scale = Math.min(maxWidth / videoNaturalSize.width, maxHeight / videoNaturalSize.height, 1);

    return {
      width: Math.max(1, Math.round(videoNaturalSize.width * scale)),
      height: Math.max(1, Math.round(videoNaturalSize.height * scale)),
    };
  }, [insets.bottom, insets.top, videoNaturalSize, windowHeight, windowWidth]);

  const handleClose = useCallback(() => {
    videoRef.current?.pauseAsync().catch(() => {});
    videoRef.current?.setPositionAsync(0).catch(() => {});
    onClose();
  }, [onClose]);

  const modalPresentationStyle = mediaType === 'video' ? 'fullScreen' : 'overFullScreen';

  return (
    <Modal
      visible={visible}
      transparent={mediaType !== 'video'}
      animationType="fade"
      presentationStyle={modalPresentationStyle}
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar hidden={Platform.OS !== 'web'} />
      <View style={styles.overlay}>
        {(mediaType !== 'video' || Platform.OS === 'web') && (
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        )}

        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={handleClose}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.mediaContainer} pointerEvents="box-none">
          {mediaType === 'image' ? (
            <Image
              source={{ uri }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : (
            <Video
              ref={videoRef}
              source={{ uri }}
              style={[styles.fullVideo, videoStyle]}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
              onReadyForDisplay={handleVideoReadyForDisplay}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  fullVideo: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
});
