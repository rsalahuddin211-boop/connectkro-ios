import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getOwnerNotifications, markOwnerNotificationsRead } from '../services/notifications';
import type { OwnerNotification } from '../types/asset';
import { styles } from '../styles/NotificationsScreen.styles';
import { colors } from '../theme/colors';
import {
  formatAssetActivityDate,
  formatAssetActivityTime,
  getAssetActivityPresentation,
} from '../utils/assetPresentation';

interface NotificationsScreenProps {
  onBack: () => void;
}

export default function NotificationsScreen({ onBack }: NotificationsScreenProps) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await getOwnerNotifications(token, 50);
      setNotifications(response.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = notifications.filter((notification) => notification.unread).length;

  const handleMarkAllRead = useCallback(async () => {
    if (!token || unreadCount === 0 || markingRead) {
      return;
    }

    setMarkingRead(true);
    try {
      await markOwnerNotificationsRead(token);
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          unread: false,
        })),
      );
    } finally {
      setMarkingRead(false);
    }
  }, [markingRead, token, unreadCount]);

  useEffect(() => {
    if (!token || loading || unreadCount === 0 || markingRead) {
      return;
    }

    void handleMarkAllRead();
  }, [handleMarkAllRead, loading, markingRead, token, unreadCount]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.82}>
          <Ionicons name="chevron-back" size={24} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primaryStrong} />
        </View>
      ) : notifications.length > 0 ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {notifications.map((notification) => {
            const activityUi = getAssetActivityPresentation(notification);
            const notificationTitle = notification.asset?.name
              ? `${notification.asset.name} • ${activityUi.title}`
              : activityUi.title;

            return (
              <View
                key={notification.id}
                style={[styles.notificationCard, notification.unread ? styles.notificationCardUnread : null]}
              >
                <View style={[styles.notificationIconWrap, { backgroundColor: activityUi.iconBackground }]}>
                  <Ionicons name={activityUi.icon} size={20} color={activityUi.iconColor} />
                </View>

                <View style={styles.notificationCopy}>
                  <View style={styles.notificationTopRow}>
                    <Text style={styles.notificationTitle}>{notificationTitle}</Text>
                    {notification.unread ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text style={styles.notificationMeta}>{activityUi.meta}</Text>
                  <Text style={styles.notificationDate}>
                    {formatAssetActivityDate(notification.occurredAt)} {'\u2022'} {formatAssetActivityTime(notification.occurredAt)}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>You do not have any notifications yet.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
