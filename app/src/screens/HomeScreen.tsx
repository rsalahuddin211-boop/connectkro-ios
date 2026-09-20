import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import emptyStateIllustration from '../../assets/Home image.png';
import { useAuth } from '../context/AuthContext';
import { listMyAssets, toAbsoluteAssetUrl } from '../services/ownerAssets';
import type { AssetRecord } from '../types/asset';
import { styles } from '../styles/HomeScreen.styles';
import NotificationBellButton from '../components/NotificationBellButton';
import {
  getAssetStatusText,
  getAssetTypeIcon,
  isAssetQuickResponseActive,
} from '../utils/assetPresentation';
import { getErrorMessage } from '../utils/error';
import { colors } from '../theme/colors';

interface HomeScreenProps {
  onAssetPress: (assetId: number) => void;
  onNotificationsPress: () => void;
  isAccountBlocked?: boolean;
}

export default function HomeScreen({ onAssetPress, onNotificationsPress, isAccountBlocked = false }: HomeScreenProps) {
  const { token, owner } = useAuth();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const welcomeName = owner?.name?.trim();
  const activeAssets = assets.filter(isAssetQuickResponseActive).length;
  const inactiveAssets = assets.length - activeAssets;
  const statCards = [
    {
      key: 'total',
      value: assets.length,
      label: 'Total Assets',
      cardStyle: styles.totalCard,
      iconWrapStyle: styles.totalIconContainer,
      iconName: 'briefcase-outline' as const,
      iconColor: colors.accentText,
    },
    {
      key: 'active',
      value: activeAssets,
      label: 'Active',
      cardStyle: styles.activeCard,
      iconWrapStyle: styles.activeIconContainer,
      iconName: 'checkmark-circle-outline' as const,
      iconColor: colors.primaryStrong,
    },
    {
      key: 'inactive',
      value: inactiveAssets,
      label: 'Inactive',
      cardStyle: styles.inactiveCard,
      iconWrapStyle: styles.inactiveIconContainer,
      iconName: 'close-circle-outline' as const,
      iconColor: colors.warningAccent,
    },
  ];

  const loadAssets = useCallback(async () => {
    if (!token || isAccountBlocked) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listMyAssets(token);
      setAssets(data);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to load assets'));
    } finally {
      setLoading(false);
    }
  }, [isAccountBlocked, token]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.welcomeText}>
              {welcomeName ? `Welcome ${welcomeName}!` : 'Welcome!'}
            </Text>
          </View>

          <NotificationBellButton onViewAllPress={onNotificationsPress} disabled={isAccountBlocked} />
        </View>

        <View style={styles.statsContainer}>
          {statCards.map((card) => (
            <View key={card.key} style={[styles.statCard, card.cardStyle]}>
              <View style={[styles.statIconContainer, card.iconWrapStyle]}>
                <Ionicons name={card.iconName} size={20} color={card.iconColor} />
              </View>
              <Text style={styles.statNumber}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Assets</Text>
        </View>

        {loading && assets.length === 0 ? (
          <View style={styles.messageCard}>
            <ActivityIndicator size="small" color={colors.primaryStrong} />
            <Text style={styles.messageText}>Loading your assets...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Couldn&apos;t load your assets</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadAssets}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error && assets.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyIllustration}>
              <Image source={emptyStateIllustration} style={styles.emptyIllustrationImage} resizeMode="contain" />
            </View>

            <Text style={styles.emptyTitle}>No assets added yet</Text>
            <Text style={styles.emptyText}>
              Tap the QR button below to add your first asset.
            </Text>
          </View>
        ) : null}

        {!loading && !error && assets.length > 0 ? (
          <View style={styles.assetList}>
            {assets.map((asset) => {
              const isActive = isAssetQuickResponseActive(asset);

              return (
                <TouchableOpacity
                  key={asset.id}
                  style={styles.assetCard}
                  onPress={() => onAssetPress(asset.id)}
                  disabled={isAccountBlocked}
                  activeOpacity={0.88}
                >
                  <View style={styles.assetRow}>
                    <View style={styles.assetImageWrap}>
                      {asset.images?.[0] ? (
                        <Image
                          source={{ uri: toAbsoluteAssetUrl(asset.images[0]) }}
                          style={styles.assetImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.assetImageFallback, isActive ? styles.assetIconActive : styles.assetIconInactive]}>
                          <Ionicons
                            name={getAssetTypeIcon(asset.type)}
                            size={28}
                            color={isActive ? colors.primaryStrong : colors.warningAccent}
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.assetInfo}>
                      <Text style={styles.assetName} numberOfLines={1}>{asset.name}</Text>
                      <View style={styles.assetMetaRow}>
                        <View style={styles.assetMetaBadge}>
                          <Ionicons
                            name={getAssetTypeIcon(asset.type)}
                            size={12}
                            color={colors.accentText}
                          />
                          <Text style={styles.assetMeta}>{asset.type}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.assetActions}>
                      <View style={[styles.statusBadge, isActive ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
                        <Text style={[styles.statusBadgeText, isActive ? styles.statusBadgeTextActive : styles.statusBadgeTextInactive]}>
                          {getAssetStatusText(asset)}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.textMuted}
                        style={styles.assetChevron}
                      />
                    </View>
                  </View>

                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

