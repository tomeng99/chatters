import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  Pressable,
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

const SCREEN = Dimensions.get('window');

export default function MediaViewer({ visible, uri, mediaType, onClose }: MediaViewerProps) {
  const insets = useSafeAreaInsets();

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

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
        {/* Backdrop – tap to close (disabled for video to avoid intercepting player controls) */}
        {mediaType !== 'video' && (
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
              source={{ uri }}
              style={styles.fullVideo}
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
    width: SCREEN.width,
    height: SCREEN.height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  fullVideo: {
    width: '100%',
    height: '80%',
  },
});
