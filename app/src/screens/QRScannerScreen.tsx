import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from '../styles/QRScannerScreen.styles';
import { checkQuickResponseClaimStatus, checkQuickResponseStatus, QuickResponseResponse } from '../services/quickResponse';
import { useAuth } from '../context/AuthContext';
import { useDialog, type DialogAction } from '../context/DialogContext';
import { getErrorMessage } from '../utils/error';
import { colors } from '../theme/colors';
import { SHOP_QR_STICKER_SUBSCRIPTION_URL } from '../config/app';

interface QRScannerScreenProps {
  onClose: () => void;
  onScanComplete: (data: QuickResponseResponse) => void;
}

const SCAN_CONFIRM_DELAY_MS = 1000;

function getClaimStatusMessage(reason: string) {
  switch (reason) {
    case 'ATTACHED':
      return 'This QR code is already linked to an asset.';
    case 'DISABLED':
      return 'This QR code is deactivated.';
    case 'LINKED_TO_ANOTHER_OWNER':
      return 'This QR code belongs to another account.';
    case 'LINKED_TO_CURRENT_OWNER':
      return 'This QR code is linked to your account and can be reused.';
    case 'NOT_FOUND':
      return 'This QR code is not recognized.';
    case 'SUBSCRIPTION_REQUIRED':
      return 'You need an active subscription before linking a QR to an asset.';
    case 'UNAVAILABLE':
      return 'This QR code cannot be claimed right now.';
    default:
      return 'This QR code cannot be claimed right now.';
  }
}

export default function QRScannerScreen({ onClose, onScanComplete }: QRScannerScreenProps) {
  const { token } = useAuth();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmingScan, setIsConfirmingScan] = useState(false);
  const isMountedRef = useRef(true);
  const isClaimableStatus = useCallback(
    (statusCode: string) => ['UNCLAIMED', 'UNSOLD'].includes(statusCode),
    [],
  );

  const resetScanner = useCallback(() => {
    setScanned(false);
    setIsConfirmingScan(false);
    setIsLoading(false);
  }, []);

  const buildScannerActions = useCallback(
    (primaryAction?: DialogAction) => {
      const actions: DialogAction[] = [
        { id: 'scan-again', label: 'Scan Again', variant: 'secondary', onPress: resetScanner },
      ];

      if (primaryAction) {
        actions.push(primaryAction);
      } else {
        actions.push({ id: 'close', label: 'Close', variant: 'primary', onPress: onClose });
      }

      return actions;
    },
    [onClose, resetScanner],
  );

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scanned || isLoading) return;
    setScanned(true);
    setIsConfirmingScan(true);

    // Extract quickResponse ID from URL
    const quickResponseId = extractQuickResponseId(data);

    if (!quickResponseId) {
      setIsConfirmingScan(false);
      void dialog.open({
        title: 'Invalid QR',
        message: 'This QR code is not recognized.',
        tone: 'error',
        actions: buildScannerActions(),
      });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, SCAN_CONFIRM_DELAY_MS));

    if (!isMountedRef.current) {
      return;
    }

    setIsConfirmingScan(false);

    // Call API to check quickResponse status
    setIsLoading(true);
    try {
      const quickResponseData = await checkQuickResponseStatus(quickResponseId);

      if (isClaimableStatus(quickResponseData.statusCode)) {
        if (token) {
          const claimStatus = await checkQuickResponseClaimStatus(token, quickResponseData.uniqueId);

          if (!claimStatus.claimable) {
            if (claimStatus.reason === 'SUBSCRIPTION_REQUIRED') {
              void dialog.open({
                title: 'Subscription required',
                message: claimStatus.message,
                tone: 'warning',
                actions: [
                  { id: 'scan-again', label: 'Scan Again', variant: 'secondary', onPress: resetScanner },
                  {
                    id: 'buy-subscription',
                    label: 'Buy subscription',
                    variant: 'primary',
                    onPress: () => Linking.openURL(SHOP_QR_STICKER_SUBSCRIPTION_URL).then(() => undefined).catch(() => undefined),
                  },
                ],
              });
              return;
            }

            void dialog.open({
              title: 'QR Unavailable',
              message: getClaimStatusMessage(claimStatus.reason),
              tone: 'warning',
              actions: buildScannerActions(),
            });
            return;
          }
        }

        void dialog.open({
          title: 'QR Available!',
          message: quickResponseData.statusCode === 'UNSOLD'
            ? 'QR is ready to be claimed.'
            : 'QR is unclaimed.',
          tone: 'success',
          actions: buildScannerActions({
            id: 'claim',
            label: 'Claim It',
            variant: 'primary',
            onPress: () => onScanComplete(quickResponseData),
          }),
        });
      } else if (quickResponseData.statusCode === 'CLAIMED' || quickResponseData.statusCode === 'ACTIVE') {
        void dialog.open({
          title: 'Already Claimed',
          message: 'QR is already claimed.',
          tone: 'info',
          actions: buildScannerActions(),
        });
      } else if (quickResponseData.statusCode === 'DISABLED') {
        void dialog.open({
          title: 'QR Deactivated',
          message: 'This QR code is deactivated.',
          tone: 'warning',
          actions: buildScannerActions(),
        });
      } else {
        void dialog.open({
          title: 'QR Status',
          message: 'This QR code has an unusual status. Please try again or contact support.',
          tone: 'warning',
          actions: buildScannerActions(),
        });
      }
    } catch (error: unknown) {
      void dialog.open({
        title: 'Error',
        message: getErrorMessage(error, 'Failed to check QR status. Please try again.'),
        tone: 'error',
        actions: buildScannerActions(),
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [buildScannerActions, dialog, isClaimableStatus, isLoading, onScanComplete, resetScanner, scanned, token]);

  // No permission yet
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={48} color={colors.primaryDark} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionDescription}>
            We need access to your camera to scan QRs on your assets.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsLink} onPress={() => Linking.openSettings()}>
            <Text style={styles.settingsLinkText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButtonAlt} onPress={onClose}>
            <Text style={styles.closeButtonAltText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        {/* Top Bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 18 }]}>
          <TouchableOpacity style={styles.topButton} onPress={onClose}>
            <Ionicons name="close" size={28} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scan QR</Text>
          <TouchableOpacity style={styles.topButton} onPress={() => setTorchOn(!torchOn)}>
            <Ionicons name={torchOn ? 'flash' : 'flash-off'} size={24} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Scanner Frame Overlay */}
        <View style={styles.overlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanFrame}>
              {/* Corner borders */}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            {isConfirmingScan || isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primaryDark} />
                <Text style={styles.instructionText}>
                  {isConfirmingScan ? 'QR detected. Hold steady...' : 'Checking QR status...'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.instructionText}>
                  Point your camera at a QR{'\n'}to scan it automatically
                </Text>

                {scanned && (
                  <TouchableOpacity style={styles.rescanButton} onPress={resetScanner}>
                    <Ionicons name="refresh" size={20} color={colors.white} />
                    <Text style={styles.rescanText}>Tap to Scan Again</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
}

/**
 * Extract quickResponse ID from a scanned URL.
 * Expects URLs like: https://api.connectkro.com/quickresponses/QR-4ECC3AED157B
 */
function extractQuickResponseId(url: string): string | null {
  const trimmed = url.trim();

  // Match /quickresponses/QR-XXXX pattern
  const match = trimmed.match(/\/quickresponses\/(QR-[A-Z0-9]+)/i);
  if (match) {
    return match[1];
  }

  return null;
}
