import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import { colors } from '../theme/colors';
import {
  registerOwnerPushToken,
  unregisterOwnerPushToken,
  type PushPlatform,
} from '../services/pushRegistration';

type PushPermissionState = 'granted' | 'denied' | 'undetermined';

interface EnsureRegistrationOptions {
  requestPermission?: boolean;
}

interface PushNotificationsContextValue {
  expoPushToken: string | null;
  permissionState: PushPermissionState;
  canAskPermissionAgain: boolean;
  isRegistering: boolean;
  isStartupPermissionResolved: boolean;
  ensureRegistered: (options?: EnsureRegistrationOptions) => Promise<string | null>;
  refreshPermissions: () => Promise<Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>>;
  unregisterDevice: (authTokenOverride?: string | null) => Promise<void>;
}

const PushNotificationsContext = createContext<PushNotificationsContextValue | undefined>(undefined);
const PUSH_CHANNEL_ID = 'asset-activity';

function toPermissionState(status?: string): PushPermissionState {
  if (status === 'granted') {
    return 'granted';
  }

  if (status === 'denied') {
    return 'denied';
  }

  return 'undetermined';
}

function shouldRequestPermission(
  permissions: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
) {
  return !permissions.granted && permissions.canAskAgain !== false;
}

function getPushPlatform(): PushPlatform | null {
  if (Platform.OS === 'android') {
    return 'android';
  }

  if (Platform.OS === 'ios') {
    return 'ios';
  }

  return null;
}

function getExpoProjectId(): string | null {
  const easProjectId =
    Constants.easConfig?.projectId ||
    (Constants.expoConfig?.extra?.eas &&
      typeof Constants.expoConfig.extra.eas === 'object' &&
      'projectId' in Constants.expoConfig.extra.eas
      ? String(Constants.expoConfig.extra.eas.projectId)
      : '');

  return easProjectId ? easProjectId : null;
}

export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const { token, owner } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<PushPermissionState>('undetermined');
  const [canAskPermissionAgain, setCanAskPermissionAgain] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isStartupPermissionResolved, setIsStartupPermissionResolved] = useState(false);
  const latestAuthTokenRef = useRef<string | null>(token);
  const previousAuthTokenRef = useRef<string | null>(token);
  const registeredPushTokenRef = useRef<string | null>(null);
  const foregroundNotificationsEnabledRef = useRef(owner?.pushNotificationsEnabled !== false);
  const registerPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    latestAuthTokenRef.current = token;
  }, [token]);

  useEffect(() => {
    foregroundNotificationsEnabledRef.current = owner?.pushNotificationsEnabled !== false;
  }, [owner?.pushNotificationsEnabled]);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: foregroundNotificationsEnabledRef.current,
        shouldShowList: foregroundNotificationsEnabledRef.current,
        shouldPlaySound: foregroundNotificationsEnabledRef.current,
        shouldSetBadge: foregroundNotificationsEnabledRef.current,
      }),
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    void Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: 'Asset Activity',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.primaryStrong,
      sound: 'default',
    });
  }, []);

  const refreshPermissions = useCallback(async () => {
    const permissions = await Notifications.getPermissionsAsync();
    setPermissionState(toPermissionState(permissions.status));
    setCanAskPermissionAgain(permissions.canAskAgain !== false);
    return permissions;
  }, []);

  const unregisterDevice = useCallback(async (authTokenOverride?: string | null) => {
    const authToken = authTokenOverride ?? latestAuthTokenRef.current;
    const pushToken = registeredPushTokenRef.current;

    if (!authToken || !pushToken) {
      return;
    }

    await unregisterOwnerPushToken(authToken, pushToken);
    registeredPushTokenRef.current = null;
    setExpoPushToken(null);
  }, []);

  const ensureRegistered = useCallback(async (options?: EnsureRegistrationOptions) => {
    const requestPermission = options?.requestPermission ?? false;
    const authToken = latestAuthTokenRef.current;
    const platform = getPushPlatform();

    if (!authToken || !platform) {
      return null;
    }

    if (registerPromiseRef.current) {
      return registerPromiseRef.current;
    }

    setIsRegistering(true);

    const task = (async () => {
      if (!Device.isDevice) {
        setPermissionState('denied');

        if (requestPermission) {
          throw new Error('Push notifications require a physical Android or iOS device.');
        }

        return null;
      }

      let permissions = await refreshPermissions();

      if (requestPermission && shouldRequestPermission(permissions)) {
        permissions = await Notifications.requestPermissionsAsync();
        setPermissionState(toPermissionState(permissions.status));
        setCanAskPermissionAgain(permissions.canAskAgain !== false);
      }

      if (!permissions.granted) {
        return null;
      }

      const projectId = getExpoProjectId();

      if (!projectId) {
        throw new Error('Expo project ID is missing from app configuration.');
      }

      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const nextPushToken = tokenResponse.data;

      await registerOwnerPushToken(authToken, nextPushToken, platform);
      registeredPushTokenRef.current = nextPushToken;
      setExpoPushToken(nextPushToken);

      return nextPushToken;
    })().finally(() => {
      registerPromiseRef.current = null;
      setIsRegistering(false);
    });

    registerPromiseRef.current = task;

    return task;
  }, [refreshPermissions]);

  useEffect(() => {
    let cancelled = false;

    async function promptForStartupPermission() {
      try {
        if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
          return;
        }

        const permissions = await refreshPermissions();
        if (cancelled) {
          return;
        }

        if (shouldRequestPermission(permissions)) {
          const nextPermissions = await Notifications.requestPermissionsAsync();
          if (!cancelled) {
            setPermissionState(toPermissionState(nextPermissions.status));
            setCanAskPermissionAgain(nextPermissions.canAskAgain !== false);
          }
        }
      } finally {
        if (!cancelled) {
          setIsStartupPermissionResolved(true);
        }
      }
    }

    void promptForStartupPermission();

    return () => {
      cancelled = true;
    };
  }, [refreshPermissions]);

  useEffect(() => {
    const previousAuthToken = previousAuthTokenRef.current;

    if (previousAuthToken && !token) {
      void unregisterDevice(previousAuthToken).catch(() => null);
    }

    previousAuthTokenRef.current = token;
  }, [token, unregisterDevice]);

  useEffect(() => {
    if (!token || owner?.pushNotificationsEnabled === false || permissionState !== 'granted') {
      return;
    }

    void ensureRegistered({ requestPermission: false }).catch(() => null);
  }, [ensureRegistered, owner?.pushNotificationsEnabled, permissionState, token]);

  useEffect(() => {
    const subscription = Notifications.addPushTokenListener((event) => {
      const nextPushToken = typeof event.data === 'string' ? event.data : null;
      const authToken = latestAuthTokenRef.current;
      const platform = getPushPlatform();

      if (!nextPushToken) {
        return;
      }

      registeredPushTokenRef.current = nextPushToken;
      setExpoPushToken(nextPushToken);

      if (!authToken || !platform) {
        return;
      }

      void registerOwnerPushToken(authToken, nextPushToken, platform).catch(() => null);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const value = useMemo(
    () => ({
      expoPushToken,
      permissionState,
      canAskPermissionAgain,
      isRegistering,
      isStartupPermissionResolved,
      ensureRegistered,
      refreshPermissions,
      unregisterDevice,
    }),
    [
      canAskPermissionAgain,
      ensureRegistered,
      expoPushToken,
      isRegistering,
      isStartupPermissionResolved,
      permissionState,
      refreshPermissions,
      unregisterDevice,
    ],
  );

  return (
    <PushNotificationsContext.Provider value={value}>
      {children}
    </PushNotificationsContext.Provider>
  );
}

export function usePushNotifications() {
  const context = useContext(PushNotificationsContext);

  if (context === undefined) {
    throw new Error('usePushNotifications must be used within a PushNotificationsProvider');
  }

  return context;
}
