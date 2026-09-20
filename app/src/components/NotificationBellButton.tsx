import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getOwnerNotifications, markOwnerNotificationsRead } from '../services/notifications';
import type { OwnerNotification } from '../types/asset';
import {
  formatAssetActivityDate,
  formatAssetActivityTime,
  getAssetActivityPresentation,
} from '../utils/assetPresentation';
import { styles } from './NotificationBellButton.styles';
import { colors } from '../theme/colors';

const POLL_INTERVAL_MS = 30000;
const MAX_VISIBLE_NOTIFICATIONS = 3;

interface NotificationBellButtonProps {
  onViewAllPress: () => void;
  disabled?: boolean;
}

export default function NotificationBellButton({ onViewAllPress, disabled = false }: NotificationBellButtonProps) {
  const { token, owner } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const hasLoadedNotificationsRef = useRef(false);
  const previousUnreadCountRef = useRef(0);
  const pushNotificationsEnabled = owner?.pushNotificationsEnabled !== false;
  const dropdownTop = Math.max(insets.top + 12, 72);
  const dropdownMaxHeight = Math.min(420, Math.max(240, windowHeight - dropdownTop - insets.bottom - 24));

  const loadNotifications = useCallback(async () => {
    if (!token || disabled) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const response = await getOwnerNotifications(token, 10);
      const nextNotifications = response.notifications || [];
      setNotifications(nextNotifications);
      setUnreadCount(response.unreadCount || 0);
    } catch {
      // Keep the bell quiet if notifications cannot be refreshed.
    }
  }, [disabled, token]);

  useEffect(() => {
    if (!token || disabled) {
      setNotifications([]);
      setUnreadCount(0);
      setIsDropdownVisible(false);
      return undefined;
    }

    if (!pushNotificationsEnabled) {
      setUnreadCount(0);
      return undefined;
    }

    void loadNotifications();

    const intervalId = setInterval(() => {
      void loadNotifications();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [disabled, loadNotifications, pushNotificationsEnabled, token]);

  useEffect(() => {
    if (!pushNotificationsEnabled) {
      hasLoadedNotificationsRef.current = false;
      previousUnreadCountRef.current = 0;
      return;
    }

    if (notifications.length === 0) {
      previousUnreadCountRef.current = 0;
      return;
    }

    const unreadNotifications = notifications.filter((notification) => notification.unread);

    if (!hasLoadedNotificationsRef.current) {
      hasLoadedNotificationsRef.current = true;
      previousUnreadCountRef.current = unreadNotifications.length;
      return;
    }

    previousUnreadCountRef.current = unreadNotifications.length;
  }, [notifications, pushNotificationsEnabled]);

  const handlePress = useCallback(async () => {
    if (!token || loading || disabled) {
      return;
    }

    setLoading(true);

    try {
      const response = await getOwnerNotifications(token, 10);
      const nextNotifications = response.notifications || [];
      const nextUnreadCount = response.unreadCount || 0;

      setNotifications(nextNotifications);
      setUnreadCount(nextUnreadCount);

      if (nextUnreadCount > 0) {
        const markResponse = await markOwnerNotificationsRead(token).catch(() => null);
        const readAtValue = markResponse?.notificationsReadAt;

        setUnreadCount(0);
        setNotifications((current) =>
          current.map((notification) => ({
            ...notification,
            unread: false,
          })),
        );

        if (readAtValue) {
          previousUnreadCountRef.current = 0;
        }
      }

      setIsDropdownVisible(true);
    } catch {
      setIsDropdownVisible(true);
    } finally {
      setLoading(false);
    }
  }, [disabled, loading, token]);

  return (
    <>
      <TouchableOpacity
        style={[styles.button, unreadCount > 0 ? styles.buttonUnread : null, disabled ? { opacity: 0.45 } : null]}
        activeOpacity={0.85}
        onPress={handlePress}
        disabled={loading || disabled}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <Ionicons
            name="notifications-outline"
            size={30}
            color={unreadCount > 0 ? colors.accentText : colors.textPrimary}
          />
        )}
        {unreadCount > 0 ? <View style={styles.dot} /> : null}
      </TouchableOpacity>

      <Modal
        visible={isDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDropdownVisible(false)}
      >
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={() => setIsDropdownVisible(false)}
          />

          <View style={[styles.dropdownWrap, { top: dropdownTop }]}>
            <View style={[styles.dropdownCard, { maxHeight: dropdownMaxHeight }]}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Notifications</Text>
              </View>

              {notifications.length > 0 ? (
                <>
                  <ScrollView
                    style={styles.dropdownScroll}
                    contentContainerStyle={styles.dropdownScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {notifications.slice(0, MAX_VISIBLE_NOTIFICATIONS).map((notification, index) => {
                      const activityUi = getAssetActivityPresentation(notification);
                      const notificationTitle = notification.asset?.name
                        ? `${notification.asset.name} • ${activityUi.title}`
                        : activityUi.title;

                      return (
                        <View
                          key={notification.id}
                          style={[
                            styles.notificationRow,
                            notification.unread ? styles.notificationRowUnread : null,
                            index < Math.min(notifications.length, MAX_VISIBLE_NOTIFICATIONS) - 1
                              ? styles.notificationRowBorder
                              : null,
                          ]}
                        >
                          <View
                            style={[
                              styles.notificationIconWrap,
                              { backgroundColor: activityUi.iconBackground },
                            ]}
                          >
                            <Ionicons name={activityUi.icon} size={18} color={activityUi.iconColor} />
                          </View>

                          <View style={styles.notificationCopy}>
                            <Text style={styles.notificationTitle}>{notificationTitle}</Text>
                            <Text style={styles.notificationMeta} numberOfLines={2}>{activityUi.meta}</Text>
                            <Text style={styles.notificationDate}>
                              {formatAssetActivityDate(notification.occurredAt)} {'\u2022'} {formatAssetActivityTime(notification.occurredAt)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity
                    style={styles.viewAllButton}
                    activeOpacity={0.85}
                    onPress={() => {
                      setIsDropdownVisible(false);
                      onViewAllPress();
                    }}
                  >
                    <Text style={styles.viewAllButtonText}>View all notifications</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>You do not have any notifications yet.</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
