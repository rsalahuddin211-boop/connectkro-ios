import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  findNodeHandle,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { usePushNotifications } from '../context/PushNotificationsContext';
import {
  getOwnerProfile,
  updateOwnerProfile,
} from '../services/profile';
import { styles } from '../styles/ProfileScreen.styles';
import { getErrorMessage } from '../utils/error';
import {
  formatPkPhone,
  PK_LOCAL_PHONE_DIGIT_COUNT,
  PK_PHONE_PREFIX,
  sanitizePkLocalPhoneInput,
  toPkLocalPhoneDigits,
  toBackendPkPhone,
} from '../utils/phone';
import NotificationBellButton from '../components/NotificationBellButton';
import { colors } from '../theme/colors';
import { getPublicPlatformSettings } from '../services/platformSettings';
import { SHOP_QR_STICKER_SUBSCRIPTION_URL } from '../config/app';

const PHONE_DIGIT_LIMIT = PK_LOCAL_PHONE_DIGIT_COUNT;

function formatDate(value?: string | null) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface SettingsFormState {
  allowEmergencyContact: boolean;
  emergencyContactPhone: string;
  pushNotificationsEnabled: boolean;
}

function SettingsRowIcon({
  icon,
  iconSet = 'feather',
  tint,
  background,
}: {
  icon: string;
  iconSet?: 'feather' | 'material';
  tint: string;
  background: string;
}) {
  return (
    <View style={[styles.rowIconWrap, { backgroundColor: background }]}>
      {iconSet === 'material' ? (
        <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={tint} />
      ) : (
        <Feather name={icon as keyof typeof Feather.glyphMap} size={20} color={tint} />
      )}
    </View>
  );
}

interface ProfileScreenProps {
  onResetPasswordPress: () => void;
  onNotificationsPress: () => void;
  onPrivacyPolicyPress: () => void;
  onTermsConditionsPress: () => void;
}

export default function ProfileScreen({
  onResetPasswordPress,
  onNotificationsPress,
  onPrivacyPolicyPress,
  onTermsConditionsPress,
}: ProfileScreenProps) {
  const { token, owner, updateOwner, logout } = useAuth();
  const dialog = useDialog();
  const {
    ensureRegistered,
    isRegistering,
    permissionState,
    refreshPermissions,
    unregisterDevice,
  } = usePushNotifications();
  const appVersion = Constants.expoConfig?.version || Constants.nativeAppVersion || '1.0.0';
  const activeTokenRef = useRef<string | null>(token);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const emergencyContactInputRef = useRef<TextInput | null>(null);
  const emergencyContactScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settings, setSettings] = useState<SettingsFormState>({
    allowEmergencyContact: owner?.allowEmergencyContact ?? false,
    emergencyContactPhone: toPkLocalPhoneDigits(owner?.emergencyContactPhone),
    pushNotificationsEnabled: owner?.pushNotificationsEnabled ?? true,
  });
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSavingEmergencyContact, setIsSavingEmergencyContact] = useState(false);
  const [isSavingEmergencyToggle, setIsSavingEmergencyToggle] = useState(false);
  const [isEditingEmergencyContact, setIsEditingEmergencyContact] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isSavingPushNotifications, setIsSavingPushNotifications] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [emergencyContactError, setEmergencyContactError] = useState<string | null>(null);
  const [companyEmail, setCompanyEmail] = useState('');
  const subscription = owner?.subscription ?? null;

  useEffect(() => {
    activeTokenRef.current = token;
  }, [token]);

  useEffect(() => {
    setSettings({
      allowEmergencyContact: owner?.allowEmergencyContact ?? false,
      emergencyContactPhone: toPkLocalPhoneDigits(owner?.emergencyContactPhone),
      pushNotificationsEnabled: owner?.pushNotificationsEnabled ?? true,
    });
    setEmergencyContactError(null);
    setIsEditingEmergencyContact(false);
  }, [owner]);

  useEffect(() => {
    let isActive = true;

    async function run() {
      if (!token) {
        return;
      }

      setIsProfileLoading(true);

      try {
        const nextOwner = await getOwnerProfile(token);

        if (!isActive || activeTokenRef.current !== token) {
          return;
        }

        await updateOwner(nextOwner);
      } catch (error: unknown) {
        if (isActive && activeTokenRef.current === token) {
          void dialog.alert({
            title: 'Profile error',
            message: getErrorMessage(error, 'Failed to refresh your profile.'),
            tone: 'error',
          });
        }
      } finally {
        if (isActive) {
          setIsProfileLoading(false);
        }
      }
    }

    void run();

    return () => {
      isActive = false;
    };
  }, [dialog, token, updateOwner]);

  useEffect(() => {
    let isActive = true;

    async function loadPlatformSettings() {
      try {
        const platformSettings = await getPublicPlatformSettings();

        if (!isActive) {
          return;
        }

        setCompanyEmail(platformSettings.companyEmail || '');
      } catch {
        if (!isActive) {
          return;
        }

        setCompanyEmail('');
      }
    }

    void loadPlatformSettings();

    return () => {
      isActive = false;
    };
  }, []);

  const isBusy =
    isProfileLoading ||
    isSavingEmergencyContact ||
    isSavingEmergencyToggle ||
    isSavingPushNotifications;
  const hasEmergencyContact = settings.emergencyContactPhone.length === PHONE_DIGIT_LIMIT;
  const pushNotificationsSwitchValue =
    settings.pushNotificationsEnabled && permissionState === 'granted';
  const subscriptionActive = Boolean(subscription?.isEntitled);
  const subscriptionExpiryLabel = formatDate(subscription?.expiresAt);
  const subscriptionGraceLabel = formatDate(subscription?.graceEndsAt);
  const subscriptionActionLabel = subscriptionActive
    ? 'Extend by 1 year'
    : subscription?.status === 'EXPIRED'
      ? 'Renew subscription'
      : 'Buy subscription';

  const updateSettings = useCallback(
    (patch: Partial<SettingsFormState>) => {
      setSettings((current) => ({ ...current, ...patch }));
    },
    [],
  );

  const scrollEmergencyContactIntoView = useCallback(() => {
    const inputHandle = findNodeHandle(emergencyContactInputRef.current);

    if (inputHandle === null) {
      return;
    }

    scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(inputHandle, 64, true);
  }, []);

  const scheduleEmergencyContactScroll = useCallback(() => {
    if (emergencyContactScrollTimeoutRef.current) {
      clearTimeout(emergencyContactScrollTimeoutRef.current);
    }

    emergencyContactScrollTimeoutRef.current = setTimeout(() => {
      scrollEmergencyContactIntoView();
      emergencyContactScrollTimeoutRef.current = null;
    }, 180);
  }, [scrollEmergencyContactIntoView]);

  const focusEmergencyContactField = useCallback(() => {
    setIsEditingEmergencyContact(true);
  }, []);

  useEffect(() => {
    if (!isEditingEmergencyContact) {
      return undefined;
    }

    const focusTimeout = setTimeout(() => {
      emergencyContactInputRef.current?.focus();
      scheduleEmergencyContactScroll();
    }, 50);

    return () => clearTimeout(focusTimeout);
  }, [isEditingEmergencyContact, scheduleEmergencyContactScroll]);

  useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);

      if (!isEditingEmergencyContact) {
        return;
      }

      scheduleEmergencyContactScroll();
    });
    const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();

      if (emergencyContactScrollTimeoutRef.current) {
        clearTimeout(emergencyContactScrollTimeoutRef.current);
        emergencyContactScrollTimeoutRef.current = null;
      }
    };
  }, [isEditingEmergencyContact, scheduleEmergencyContactScroll]);

  const handleEmergencyContactEditToggle = useCallback(() => {
    if (isEditingEmergencyContact) {
      updateSettings({ emergencyContactPhone: toPkLocalPhoneDigits(owner?.emergencyContactPhone) });
      setEmergencyContactError(null);
      setIsEditingEmergencyContact(false);
      emergencyContactInputRef.current?.blur();
      return;
    }

    focusEmergencyContactField();
  }, [focusEmergencyContactField, isEditingEmergencyContact, owner?.emergencyContactPhone, updateSettings]);

  const getEmergencyContactError = useCallback((phone: string) => {
    if (!phone.trim() || phone.length !== PHONE_DIGIT_LIMIT) {
      return 'Enter a valid 10-digit emergency contact number.';
    }

    return null;
  }, []);

  const handleSaveSettings = useCallback(async () => {
    if (!token) {
      void dialog.alert({ title: 'Authentication Error', message: 'Your session expired. Please sign in again.', tone: 'error' });
      return;
    }

    const savedEmergencyContactPhone = toPkLocalPhoneDigits(owner?.emergencyContactPhone);
    const savedAllowEmergencyContact = owner?.allowEmergencyContact ?? false;
    const hasEmergencyContactChanges =
      settings.emergencyContactPhone !== savedEmergencyContactPhone ||
      settings.allowEmergencyContact !== savedAllowEmergencyContact;

    if (!hasEmergencyContactChanges) {
      void dialog.alert({
        title: 'No changes made',
        message: 'Add or update the emergency contact details before saving.',
        tone: 'warning',
      });
      return;
    }

    const normalizedEmergencyPhone = settings.emergencyContactPhone
      ? toBackendPkPhone(settings.emergencyContactPhone)
      : null;

    if (settings.allowEmergencyContact) {
      const nextError = getEmergencyContactError(settings.emergencyContactPhone);
      if (nextError) {
        setEmergencyContactError(nextError);
        return;
      }
    }

    setEmergencyContactError(null);

    if (!settings.allowEmergencyContact && emergencyContactError) {
      setEmergencyContactError(null);
    }

    if (settings.allowEmergencyContact && settings.emergencyContactPhone.length !== PHONE_DIGIT_LIMIT) {
      return;
    }

    setIsSavingEmergencyContact(true);

    try {
      const response = await updateOwnerProfile(token, {
        allowEmergencyContact: settings.allowEmergencyContact,
        emergencyContactPhone: normalizedEmergencyPhone,
      });

      if (activeTokenRef.current !== token) {
        return;
      }

      await updateOwner(response.owner);
      setIsEditingEmergencyContact(false);
      emergencyContactInputRef.current?.blur();
      void dialog.alert({
        title: 'Emergency contact saved',
        message: 'Your emergency contact details have been saved.',
        tone: 'success',
      });
    } catch (error: unknown) {
      void dialog.alert({
        title: 'Save failed',
        message: getErrorMessage(error, 'Failed to save your profile settings.'),
        tone: 'error',
      });
    } finally {
      setIsSavingEmergencyContact(false);
    }
  }, [
    emergencyContactError,
    getEmergencyContactError,
    settings.allowEmergencyContact,
    settings.emergencyContactPhone,
    owner?.allowEmergencyContact,
    owner?.emergencyContactPhone,
    dialog,
    token,
    updateOwner,
  ]);

  const handleEmergencyContactToggle = useCallback(async (nextValue: boolean) => {
    if (!token || isSavingEmergencyToggle || isSavingEmergencyContact) {
      return;
    }

    const previousValue = settings.allowEmergencyContact;
    const normalizedEmergencyPhone = settings.emergencyContactPhone
      ? toBackendPkPhone(settings.emergencyContactPhone)
      : null;

    if (nextValue) {
      if (!hasEmergencyContact) {
        setEmergencyContactError(getEmergencyContactError(settings.emergencyContactPhone));
        focusEmergencyContactField();
        return;
      }

      const nextError = getEmergencyContactError(settings.emergencyContactPhone);

      if (nextError) {
        setEmergencyContactError(nextError);
        return;
      }
    }

    setEmergencyContactError(null);
    updateSettings({ allowEmergencyContact: nextValue });
    setIsSavingEmergencyToggle(true);

    try {
      const response = await updateOwnerProfile(token, {
        allowEmergencyContact: nextValue,
        emergencyContactPhone: normalizedEmergencyPhone,
      });

      if (activeTokenRef.current !== token) {
        return;
      }

      await updateOwner(response.owner);
      void dialog.alert({
        title: nextValue ? 'Emergency calling enabled' : 'Emergency calling disabled',
        message: nextValue
          ? 'The emergency call button will now appear on your QR page.'
          : 'The emergency call button has been removed from your QR page.',
        tone: 'success',
      });
    } catch (error: unknown) {
      updateSettings({ allowEmergencyContact: previousValue });
      void dialog.alert({
        title: 'Update failed',
        message: getErrorMessage(error, 'Failed to update your emergency contact setting.'),
        tone: 'error',
      });
    } finally {
      setIsSavingEmergencyToggle(false);
    }
  }, [
    getEmergencyContactError,
    isSavingEmergencyContact,
    isSavingEmergencyToggle,
    settings.allowEmergencyContact,
    settings.emergencyContactPhone,
    hasEmergencyContact,
    focusEmergencyContactField,
    dialog,
    token,
    updateOwner,
    updateSettings,
  ]);

  const handlePushNotificationsToggle = useCallback(async (nextValue: boolean) => {
    if (!token) {
      void dialog.alert({ title: 'Authentication Error', message: 'Your session expired. Please sign in again.', tone: 'error' });
      return;
    }

    const previousValue = settings.pushNotificationsEnabled;
    setIsSavingPushNotifications(true);

    try {
      if (nextValue) {
        const latestPermissions = await refreshPermissions();

        if (!latestPermissions.granted && latestPermissions.canAskAgain === false) {
          void dialog.open({
            title: 'Enable notifications',
            message: 'Notification permission is turned off for this app. Please enable it in your phone settings.',
            tone: 'warning',
            actions: [
              { id: 'cancel', label: 'Cancel', variant: 'secondary' },
              {
                id: 'settings',
                label: 'Open Settings',
                variant: 'primary',
                onPress: () => Linking.openSettings().then(() => undefined).catch(() => undefined),
              },
            ],
          });
          return;
        }

        const registeredToken = await ensureRegistered({ requestPermission: true });

        if (!registeredToken) {
          throw new Error('Please allow notifications on this device to enable push alerts.');
        }
      }

      const response = await updateOwnerProfile(token, {
        pushNotificationsEnabled: nextValue,
      });

      if (activeTokenRef.current !== token) {
        return;
      }

      await updateOwner(response.owner);

      if (!nextValue) {
        await unregisterDevice(token).catch(() => null);
        void dialog.open({
          title: 'Notifications turned off',
          message: 'Notifications are off in the app. To fully block them on this device too, turn them off in your phone settings.',
          tone: 'info',
          actions: [
            { id: 'not-now', label: 'Not now', variant: 'secondary' },
            {
              id: 'settings',
              label: 'Open Settings',
              variant: 'primary',
              onPress: () => Linking.openSettings().then(() => undefined).catch(() => undefined),
            },
          ],
        });
      }
    } catch (error: unknown) {
      setSettings((current) => ({ ...current, pushNotificationsEnabled: previousValue }));
      void dialog.alert({
        title: 'Push notifications unavailable',
        message: getErrorMessage(error, 'Unable to update your push notification preference.'),
        tone: 'error',
      });
    } finally {
      setIsSavingPushNotifications(false);
    }
  }, [
    ensureRegistered,
    refreshPermissions,
    settings.pushNotificationsEnabled,
    token,
    unregisterDevice,
    dialog,
    updateOwner,
  ]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) {
      return;
    }

    const confirmed = await dialog.confirm({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmLabel: 'Logout',
    });

    if (!confirmed) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout();
    } catch (error: unknown) {
      setIsLoggingOut(false);
      void dialog.alert({
        title: 'Logout failed',
        message: getErrorMessage(error, 'Unable to sign out right now.'),
        tone: 'error',
      });
    }
  }, [dialog, isLoggingOut, logout]);

  const handleContactUsPress = useCallback(async () => {
    const trimmedEmail = companyEmail.trim();

    if (!trimmedEmail) {
      void dialog.alert({ title: 'Email unavailable', message: 'Contact email is not available right now.', tone: 'warning' });
      return;
    }

    const mailtoUrl = `mailto:${encodeURIComponent(trimmedEmail)}`;

    try {
      await Linking.openURL(mailtoUrl);
    } catch (error: unknown) {
      void dialog.alert({
        title: 'Mail app unavailable',
        message: getErrorMessage(error, 'Unable to open your email app right now.'),
        tone: 'error',
      });
    }
  }, [companyEmail, dialog]);

  if (!owner && isProfileLoading) {
    return (
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primaryStrong} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.layout}
        enabled
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.container, isKeyboardVisible ? styles.containerKeyboard : null]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Profile</Text>
              <Text style={styles.subtitleText}>Manage your account and preferences.</Text>
            </View>

            <NotificationBellButton onViewAllPress={onNotificationsPress} />
          </View>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <SettingsRowIcon icon="phone" tint={colors.primaryStrong} background={colors.successSurfaceLight} />

              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Phone Number</Text>
                <Text style={styles.settingDescription}>{formatPkPhone(owner?.phone)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.linkRow}
              activeOpacity={0.82}
              onPress={onResetPasswordPress}
            >
              <View style={styles.policyIconWrap}>
                <Feather name="lock" size={20} color={colors.primaryStrong} />
              </View>

              <View style={styles.settingCopy}>
                <Text style={styles.policyText}>Reset Password</Text>
                <Text style={styles.settingDescription}>Update your password using a code sent to your phone.</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.settingRow}>
                <SettingsRowIcon icon="calendar" tint={colors.primaryStrong} background={colors.successSurfaceLight} />
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>Subscription</Text>
                  <Text style={styles.settingDescription}>
                    {subscriptionActive
                      ? 'Your account can attach and manage multiple QRs.'
                      : 'Buy once a year to keep QR linking and management active.'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.subscriptionStatusBadge,
                  subscriptionActive
                    ? styles.subscriptionStatusBadgeActive
                    : subscription?.status === 'GRACE'
                      ? styles.subscriptionStatusBadgeGrace
                    : subscription?.status === 'EXPIRED'
                      ? styles.subscriptionStatusBadgeExpired
                      : styles.subscriptionStatusBadgeNeutral,
                ]}
              >
                <Text
                  style={[
                    styles.subscriptionStatusText,
                    subscriptionActive
                      ? styles.subscriptionStatusTextActive
                      : subscription?.status === 'GRACE'
                        ? styles.subscriptionStatusTextGrace
                      : subscription?.status === 'EXPIRED'
                        ? styles.subscriptionStatusTextExpired
                        : styles.subscriptionStatusTextNeutral,
                  ]}
                >
                  {subscription?.status === 'ACTIVE'
                    ? 'Active'
                    : subscription?.status === 'GRACE'
                      ? 'Grace'
                      : subscription?.status === 'EXPIRED'
                        ? 'Expired'
                        : 'Not purchased'}
                </Text>
              </View>
            </View>

            <View style={styles.subscriptionMetaRow}>
              <Text style={styles.subscriptionMetaLabel}>Linked QRs</Text>
              <Text style={styles.subscriptionMetaValue}>{subscription?.linkedQrCount ?? 0}</Text>
            </View>

            <View style={styles.subscriptionMetaRow}>
              <Text style={styles.subscriptionMetaLabel}>
                {subscriptionActive ? 'Active until' : subscription?.status === 'EXPIRED' ? 'Expired on' : 'Status'}
              </Text>
              <Text style={styles.subscriptionMetaValue}>
                {subscription?.status === 'NOT_PURCHASED'
                  ? 'Not purchased'
                  : subscriptionExpiryLabel || 'Unavailable'}
              </Text>
            </View>

            {subscription?.status === 'GRACE' && subscriptionGraceLabel ? (
              <Text style={styles.subscriptionNote}>
                Grace period ends {subscriptionGraceLabel}.
              </Text>
            ) : null}

            <TouchableOpacity
              style={styles.subscriptionCta}
              activeOpacity={0.9}
              onPress={() => {
                void Linking.openURL(SHOP_QR_STICKER_SUBSCRIPTION_URL).catch(() => null);
              }}
            >
              <Text style={styles.subscriptionCtaText}>{subscriptionActionLabel}</Text>
            </TouchableOpacity>

            <Text style={styles.subscriptionHint}>
              One subscription can cover multiple QR stickers for the same phone number.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <SettingsRowIcon icon="phone-in-talk-outline" iconSet="material" tint={colors.primaryStrong} background={colors.successSurfaceLight} />

              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Allow Emergency Call</Text>
                <Text style={styles.settingDescription}>Show emergency call button on the QR page.</Text>
              </View>

              <View style={{ opacity: hasEmergencyContact ? 1 : 0.45 }}>
                <Switch
                  value={settings.allowEmergencyContact && hasEmergencyContact}
                  onValueChange={(value) => {
                    void handleEmergencyContactToggle(value);
                  }}
                  disabled={isBusy}
                  trackColor={{
                    false: colors.borderNeutral,
                    true: hasEmergencyContact ? colors.primary : colors.borderNeutral,
                  }}
                  thumbColor={colors.white}
                />
              </View>
            </View>

            <View style={styles.divider} />

            <View
              style={styles.formSection}
            >
              <View style={styles.fieldHeaderRow}>
                <View style={styles.fieldHeaderCopy}>
                  <SettingsRowIcon icon="user" tint={colors.primaryStrong} background={colors.successSurfaceLight} />
                  <View>
                    <Text style={styles.settingTitle}>Emergency Contact</Text>
                    <Text style={styles.emergencyHint}>
                      {isEditingEmergencyContact ? 'Add a number for emergency calls.' : 'Only edit when you need to change it.'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleEmergencyContactEditToggle}
                  disabled={isSavingEmergencyContact || isSavingEmergencyToggle}
                >
                  <Text style={styles.inlineActionText}>
                    {isEditingEmergencyContact ? 'Cancel' : hasEmergencyContact ? 'Edit' : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={[styles.phoneInputShell, emergencyContactError ? styles.phoneInputShellError : null]}
              >
                <Text style={styles.phonePrefix}>{PK_PHONE_PREFIX}</Text>
                <TextInput
                  ref={emergencyContactInputRef}
                  style={styles.phoneInput}
                  placeholder="3017654321"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  editable={isEditingEmergencyContact}
                  onFocus={scheduleEmergencyContactScroll}
                  maxLength={PHONE_DIGIT_LIMIT}
                  value={settings.emergencyContactPhone}
                  onChangeText={(value) => {
                    const nextPhone = sanitizePkLocalPhoneInput(value);
                    updateSettings({ emergencyContactPhone: nextPhone });

                    if (emergencyContactError || settings.allowEmergencyContact) {
                      setEmergencyContactError(getEmergencyContactError(nextPhone));
                    }
                  }}
                />
              </View>
              {emergencyContactError ? <Text style={styles.fieldErrorText}>{emergencyContactError}</Text> : null}

              {isEditingEmergencyContact ? (
                <TouchableOpacity
                  style={[styles.primaryButton, isSavingEmergencyContact ? styles.primaryButtonDisabled : null]}
                  activeOpacity={0.9}
                  onPress={() => {
                    void handleSaveSettings();
                  }}
                  disabled={isSavingEmergencyContact || isSavingEmergencyToggle}
                >
                  {isSavingEmergencyContact ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save Emergency Contact</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <SettingsRowIcon icon="bell" tint={colors.primaryStrong} background={colors.successSurfaceLight} />

              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive updates about your assets and important alerts.
                </Text>
              </View>

              <Switch
                value={pushNotificationsSwitchValue}
                onValueChange={(value) => {
                  void handlePushNotificationsToggle(value);
                }}
                disabled={isBusy || isRegistering}
                trackColor={{ false: colors.borderNeutral, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            {settings.pushNotificationsEnabled && permissionState !== 'granted' ? (
              <Text style={styles.settingDescription}>
                Notifications are enabled for your account, but permission is currently off on this device.
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.linkRow}
              activeOpacity={0.82}
              onPress={() => {
                onPrivacyPolicyPress();
              }}
            >
              <View style={styles.policyIconWrap}>
                <Feather name="shield" size={20} color={colors.textTertiary} />
              </View>

              <View style={styles.settingCopy}>
                <Text style={styles.policyText}>Privacy Policy</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.linkRow}
              activeOpacity={0.82}
              onPress={() => {
                onTermsConditionsPress();
              }}
            >
              <View style={styles.policyIconWrap}>
                <Feather name="file-text" size={20} color={colors.textTertiary} />
              </View>

              <View style={styles.settingCopy}>
                <Text style={styles.policyText}>Terms and Condition</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.linkRow}
              activeOpacity={0.82}
              onPress={() => {
                void handleContactUsPress();
              }}
            >
              <View style={styles.policyIconWrap}>
                <Feather name="headphones" size={20} color={colors.textTertiary} />
              </View>

              <View style={styles.settingCopy}>
                <Text style={styles.policyText}>Contact Us</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={styles.logoutCard}
              activeOpacity={0.88}
              onPress={handleLogout}
              disabled={isLoggingOut}
            >
              <View style={styles.logoutContent}>
                <View style={styles.logoutIconWrap}>
                  {isLoggingOut ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Feather name="log-out" size={18} color={colors.white} />
                  )}
                </View>
                <Text style={styles.logoutButtonText}>Logout</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.versionText}>Version {appVersion}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
