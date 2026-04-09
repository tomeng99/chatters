import React, { useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode, VideoFullscreenUpdate } from 'expo-av';
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
  const videoRef = useRef<Video>(null);
  const fullscreenPresentedRef = useRef(false);

  // Reset the fullscreen flag each time the modal is opened so iOS auto-presents
  useEffect(() => {
    if (visible) {
      fullscreenPresentedRef.current = false;
    }
  }, [visible]);

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  // On iOS, present the native fullscreen player as soon as the video is ready
  const handleVideoReadyForDisplay = useCallback(async () => {
    if (Platform.OS === 'ios' && videoRef.current && !fullscreenPresentedRef.current) {
      fullscreenPresentedRef.current = true;
      try {
        await videoRef.current.presentFullscreenPlayer();
        // Start playback; ignore errors so the native player still shows
        videoRef.current.playAsync().catch(() => {});
      } catch {
        fullscreenPresentedRef.current = false;
        // Fall back to the in-modal player if native fullscreen is unavailable
      }
    }
  }, []);

  // Close the modal when the native fullscreen player is dismissed
  const handleFullscreenUpdate = useCallback(
    (event: { fullscreenUpdate: VideoFullscreenUpdate }) => {
      if (event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_DID_DISMISS) {
        fullscreenPresentedRef.current = false;
        videoRef.current?.pauseAsync().catch(() => {});
        videoRef.current?.setPositionAsync(0).catch(() => {});
        onClose();
      }
    },
    [onClose],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden={Platform.OS !== 'web'} />
      <View style={styles.overlay}>
        {/* Backdrop – tap to close (disabled for video on native to avoid intercepting player controls) */}
        {(mediaType !== 'video' || Platform.OS === 'web') && (
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        )}

        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={onClose}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Media content */}
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
              style={styles.fullVideo}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
              onReadyForDisplay={handleVideoReadyForDisplay}
              onFullscreenUpdate={handleFullscreenUpdate}
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
    width: '100%',
    height: '100%',
  },
});
