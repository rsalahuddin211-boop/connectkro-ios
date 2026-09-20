import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, BackHandler, Keyboard, Platform, View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PushNotificationsProvider, usePushNotifications } from './src/context/PushNotificationsContext';
import { DialogProvider, useDialog } from './src/context/DialogContext';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PasswordResetScreen from './src/screens/PasswordResetScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';
import LandingScreen from './src/screens/LandingScreen';
import LinkAssetScreen from './src/screens/LinkAssetScreen';
import AssetDetailsScreen from './src/screens/AssetDetailsScreen';
import EditAssetScreen from './src/screens/EditAssetScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import TermsConditionsScreen from './src/screens/TermsConditionsScreen';
import type { QuickResponseResponse } from './src/services/quickResponse';
import type { AssetRecord } from './src/types/asset';
import { styles } from './src/styles/App.styles';
import { colors } from './src/theme/colors';
import { ApiError } from './src/services/http';
import { getOwnerProfile } from './src/services/profile';
import { getPublicPlatformSettings } from './src/services/platformSettings';
import { formatPkPhone } from './src/utils/phone';

type AppTab = 'Home' | 'Profile';

const TAB_COLORS = {
  active: colors.primaryStrong,
  inactive: colors.textTertiary,
} as const;
const BOTTOM_NAV_BASE_HEIGHT = 70;
const BOTTOM_NAV_BASE_PADDING = 10;
const OWNER_STATUS_POLL_INTERVAL_MS = 60_000;

function buildBlockedAccountMessage(supportPhone: string) {
  const formattedPhone = supportPhone ? formatPkPhone(supportPhone) : '';

  if (formattedPhone && formattedPhone !== 'Not added') {
    return `Your account has been blocked by the administrator. Please contact support at ${formattedPhone}.`;
  }

  return 'Your account has been blocked by the administrator. Please contact support.';
}

const TAB_CONFIG: Record<
  AppTab,
  {
    label: string;
    activeIcon: keyof typeof Ionicons.glyphMap;
    inactiveIcon: keyof typeof Ionicons.glyphMap;
  }
> = {
  Home: { label: 'Home', activeIcon: 'home', inactiveIcon: 'home-outline' },
  Profile: { label: 'Profile', activeIcon: 'person', inactiveIcon: 'person-outline' },
};

function RootNavigator() {
  const { token, owner, isHydrating, logout } = useAuth();
  const dialog = useDialog();
  const { isStartupPermissionResolved } = usePushNotifications();
  const insets = useSafeAreaInsets();
  const [currentTab, setCurrentTab] = useState<AppTab>('Home');
  const [showScanner, setShowScanner] = useState(false);
  const [pendingQuickResponseId, setPendingQuickResponseId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [isTermsConditionsOpen, setIsTermsConditionsOpen] = useState(false);
  const [isAccountBlocked, setIsAccountBlocked] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const supportPhoneRef = useRef('');
  const accountBlockedRef = useRef(false);
  const blockedDialogShownRef = useRef(false);

  useEffect(() => {
    const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const keyboardHideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(keyboardShowEvent, () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(keyboardHideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const loadSupportPhone = useCallback(async () => {
    if (supportPhoneRef.current) {
      return supportPhoneRef.current;
    }

    try {
      const settings = await getPublicPlatformSettings();
      supportPhoneRef.current = settings.companyPhone || '';
    } catch {
      supportPhoneRef.current = '';
    }

    return supportPhoneRef.current;
  }, []);

  const validateOwnerAccount = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      await getOwnerProfile(token);

      if (accountBlockedRef.current) {
        accountBlockedRef.current = false;
        blockedDialogShownRef.current = false;
        setIsAccountBlocked(false);
      }
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'OWNER_BLOCKED') {
        if (error instanceof ApiError && error.status === 401) {
          await logout();
        }
        return;
      }

      accountBlockedRef.current = true;
      setIsAccountBlocked(true);
      setCurrentTab('Home');
      setShowScanner(false);
      setPendingQuickResponseId(null);
      setSelectedAssetId(null);
      setEditingAsset(null);
      setIsPasswordResetOpen(false);
      setIsNotificationsOpen(false);
      setIsPrivacyPolicyOpen(false);
      setIsTermsConditionsOpen(false);

      if (!blockedDialogShownRef.current) {
        blockedDialogShownRef.current = true;
        const supportPhone = await loadSupportPhone();
        void dialog.alert({
          title: 'Account blocked',
          message: buildBlockedAccountMessage(supportPhone),
          tone: 'error',
        });
      }
    }
  }, [dialog, loadSupportPhone, logout, token]);

  useEffect(() => {
    if (token) {
      return;
    }

    accountBlockedRef.current = false;
    blockedDialogShownRef.current = false;
    supportPhoneRef.current = '';
    setIsAccountBlocked(false);
    setCurrentTab('Home');
    setShowScanner(false);
    setPendingQuickResponseId(null);
    setSelectedAssetId(null);
    setEditingAsset(null);
    setIsPasswordResetOpen(false);
    setIsNotificationsOpen(false);
    setIsPrivacyPolicyOpen(false);
    setIsTermsConditionsOpen(false);
  }, [token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let isActive = true;
    const validate = () => {
      if (isActive) {
        void validateOwnerAccount();
      }
    };

    validate();
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        validate();
      }
    });
    const intervalId = setInterval(validate, OWNER_STATUS_POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      appStateSubscription.remove();
      clearInterval(intervalId);
    };
  }, [token, validateOwnerAccount]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showScanner) {
        setShowScanner(false);
        return true;
      }

      if (isNotificationsOpen) {
        setIsNotificationsOpen(false);
        return true;
      }

      if (isPrivacyPolicyOpen) {
        setIsPrivacyPolicyOpen(false);
        return true;
      }

      if (isTermsConditionsOpen) {
        setIsTermsConditionsOpen(false);
        return true;
      }

      if (editingAsset) {
        setEditingAsset(null);
        return true;
      }

      if (pendingQuickResponseId) {
        setPendingQuickResponseId(null);
        return true;
      }

      if (selectedAssetId !== null) {
        setSelectedAssetId(null);
        return true;
      }

      if (isPasswordResetOpen) {
        setIsPasswordResetOpen(false);
        return true;
      }

      if (currentTab !== 'Home') {
        setCurrentTab('Home');
        return true;
      }

      return true;
    });

    return () => subscription.remove();
  }, [currentTab, editingAsset, isNotificationsOpen, isPasswordResetOpen, isPrivacyPolicyOpen, isTermsConditionsOpen, pendingQuickResponseId, selectedAssetId, showScanner, token]);

  const renderNavItem = (tab: AppTab) => {
    const isActive = currentTab === tab;
    const iconColor = isActive ? TAB_COLORS.active : TAB_COLORS.inactive;
    const config = TAB_CONFIG[tab];
    const iconName = isActive ? config.activeIcon : config.inactiveIcon;

    return (
      <TouchableOpacity
        key={tab}
        style={[styles.navItem, isAccountBlocked ? { opacity: 0.45 } : null]}
        disabled={isAccountBlocked}
        onPress={() => setCurrentTab(tab)}
      >
        <Ionicons name={iconName} size={24} color={iconColor} />
        <Text
          style={[
            styles.navText,
            isActive ? styles.navTextActive : styles.navTextInactive,
          ]}
        >
          {config.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const bottomNavHeight = BOTTOM_NAV_BASE_HEIGHT + insets.bottom;
  const bottomNavPadding = Math.max(insets.bottom, BOTTOM_NAV_BASE_PADDING);

  if (isHydrating || !isStartupPermissionResolved) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" backgroundColor={colors.surfaceMuted} />
        <ActivityIndicator size="large" color={colors.primaryStrong} />
      </View>
    );
  }

  if (!isAccountBlocked && isPrivacyPolicyOpen) {
    return (
      <>
        <StatusBar style="dark" backgroundColor={colors.surfaceMuted} />
        <PrivacyPolicyScreen onBack={() => setIsPrivacyPolicyOpen(false)} />
      </>
    );
  }

  if (!isAccountBlocked && isTermsConditionsOpen) {
    return (
      <>
        <StatusBar style="dark" backgroundColor={colors.surfaceMuted} />
        <TermsConditionsScreen onBack={() => setIsTermsConditionsOpen(false)} />
      </>
    );
  }

  if (!token) {
    return (
      <>
        <StatusBar style="dark" backgroundColor={colors.white} />
        <LandingScreen
          onPrivacyPolicyPress={() => setIsPrivacyPolicyOpen(true)}
          onTermsConditionsPress={() => setIsTermsConditionsOpen(true)}
        />
      </>
    );
  }

  // Full-screen QR scanner overlay
  if (!isAccountBlocked && showScanner) {
    return (
      <>
        <StatusBar style="light" backgroundColor={colors.black} />
        <QRScannerScreen
          onClose={() => setShowScanner(false)}
          onScanComplete={(data: QuickResponseResponse) => {
            setShowScanner(false);
            if (data.statusCode === 'UNCLAIMED' || data.statusCode === 'UNSOLD') {
              setPendingQuickResponseId(data.uniqueId);
            }
          }}
        />
      </>
    );
  }

  if (!isAccountBlocked && pendingQuickResponseId) {
    return (
      <>
        <StatusBar style="dark" backgroundColor={colors.surfaceApp} />
        <LinkAssetScreen quickResponseUniqueId={pendingQuickResponseId} onClose={() => setPendingQuickResponseId(null)} />
      </>
    );
  }

  if (!isAccountBlocked && isNotificationsOpen) {
    return (
      <>
        <StatusBar style="dark" backgroundColor={colors.surfaceApp} />
        <NotificationsScreen onBack={() => setIsNotificationsOpen(false)} />
      </>
    );
  }

  if (!isAccountBlocked && editingAsset && token) {
    return (
      <>
        <StatusBar style="dark" backgroundColor={colors.white} />
        <EditAssetScreen
          asset={editingAsset}
          token={token}
          onBack={() => setEditingAsset(null)}
          onSaved={() => setEditingAsset(null)}
        />
      </>
    );
  }

  if (!isAccountBlocked && selectedAssetId) {
    return (
      <>
        <StatusBar style="dark" backgroundColor={colors.white} />
        <AssetDetailsScreen
          assetId={selectedAssetId}
          onBack={() => {
            setSelectedAssetId(null);
            setEditingAsset(null);
          }}
          onEditAsset={setEditingAsset}
        />
      </>
    );
  }

  if (!isAccountBlocked && isPasswordResetOpen) {
    return (
      <>
        <StatusBar style="dark" backgroundColor={colors.white} />
        <PasswordResetScreen
          phone={owner?.phone || ''}
          onBack={() => setIsPasswordResetOpen(false)}
        />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor={colors.white} />

      <View style={[styles.content, { marginBottom: isKeyboardVisible ? 0 : bottomNavHeight }]}>
        {currentTab === 'Home' || isAccountBlocked ? (
          <HomeScreen
            isAccountBlocked={isAccountBlocked}
            onAssetPress={(assetId) => { if (!isAccountBlocked) setSelectedAssetId(assetId); }}
            onNotificationsPress={() => { if (!isAccountBlocked) setIsNotificationsOpen(true); }}
          />
        ) : (
          <ProfileScreen
            onResetPasswordPress={() => setIsPasswordResetOpen(true)}
            onNotificationsPress={() => setIsNotificationsOpen(true)}
            onPrivacyPolicyPress={() => setIsPrivacyPolicyOpen(true)}
            onTermsConditionsPress={() => setIsTermsConditionsOpen(true)}
          />
        )}
      </View>

      {!isKeyboardVisible ? (
        <View
          style={[
            styles.bottomNavBar,
            {
              height: bottomNavHeight,
              paddingBottom: bottomNavPadding,
            },
          ]}
        >
          {renderNavItem('Home')}

          <TouchableOpacity
            style={[styles.qrButton, isAccountBlocked ? { opacity: 0.45 } : null]}
            activeOpacity={0.8}
            disabled={isAccountBlocked}
            onPress={() => setShowScanner(true)}
          >
            <View style={styles.qrButtonInner}>
              <Ionicons name="qr-code-outline" size={50} color={colors.white} />
            </View>
          </TouchableOpacity>

          {renderNavItem('Profile')}
        </View>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <DialogProvider>
        <AuthProvider>
          <PushNotificationsProvider>
            <RootNavigator />
          </PushNotificationsProvider>
        </AuthProvider>
      </DialogProvider>
    </SafeAreaProvider>
  );
}

