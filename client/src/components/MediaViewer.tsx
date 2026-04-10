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
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
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

  const resetVideo = useCallback(() => {
    videoRef.current?.pauseAsync().catch(() => {});
    videoRef.current?.setPositionAsync(0).catch(() => {});
  }, []);

  useEffect(() => {
    if (!visible) {
      resetVideo();
    }
  }, [resetVideo, visible]);

  const handleClose = useCallback(() => {
    resetVideo();
    onClose();
  }, [onClose, resetVideo]);

  const handleBackdropPress = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const modalPresentationStyle = mediaType === 'video' ? 'fullScreen' : 'overFullScreen';

  return (
    <Modal
      visible={visible}
      // Native video rendering is more reliable in a non-transparent full-screen modal.
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
              style={[styles.fullVideo, { width: windowWidth, height: windowHeight - insets.top - insets.bottom }]}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
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
    backgroundColor: 'transparent',
  },
});
