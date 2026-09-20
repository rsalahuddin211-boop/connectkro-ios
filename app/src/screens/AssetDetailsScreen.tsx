import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import {
  deleteAsset,
  disableQuickResponseByAsset,
  enableQuickResponseByAsset,
  getSingleAsset,
  setAssetStolenMode,
  toAbsoluteAssetUrl,
} from '../services/ownerAssets';
import type { AssetRecord } from '../types/asset';
import { styles } from '../styles/AssetDetailsScreen.styles';
import {
  formatAssetActivityDate,
  formatAssetActivityDuration,
  formatAssetActivityTime,
  getAssetActivityPresentation,
  getAssetTypeIcon,
  isAssetQuickResponseActive,
  isVehicleAssetType,
} from '../utils/assetPresentation';
import { getErrorMessage } from '../utils/error';
import { colors } from '../theme/colors';

interface AssetDetailsScreenProps {
  assetId: number;
  onBack: () => void;
  onEditAsset: (asset: AssetRecord) => void;
}

type ActionLoadingState = 'delete' | 'quickResponse' | 'stolen' | null;

function getLatestActivitiesByType(activities: AssetRecord['activities'] = []) {
  const latestByType = new Map<string, NonNullable<AssetRecord['activities']>[number]>();

  activities.forEach((activity) => {
    const typeKey = activity.type.trim().toUpperCase();

    if (typeKey === 'ASSET_UPDATED') {
      return;
    }

    const existing = latestByType.get(typeKey);

    if (!existing) {
      latestByType.set(typeKey, activity);
      return;
    }

    const currentTime = new Date(activity.occurredAt).getTime();
    const existingTime = new Date(existing.occurredAt).getTime();

    if (Number.isNaN(existingTime) || currentTime > existingTime) {
      latestByType.set(typeKey, activity);
    }
  });

  return Array.from(latestByType.values()).sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
}

export default function AssetDetailsScreen({ assetId, onBack, onEditAsset }: AssetDetailsScreenProps) {
  const { token } = useAuth();
  const dialog = useDialog();
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<ActionLoadingState>(null);

  const loadAsset = useCallback(async () => {
    if (!token) {
      void dialog.alert({ title: 'Error', message: 'Your session expired. Please sign in again.', tone: 'error' });
      onBack();
      return;
    }

    setLoading(true);

    try {
      const data = await getSingleAsset(token, assetId);
      setAsset(data);
    } catch (error: unknown) {
      void dialog.open({
        title: 'Error',
        message: getErrorMessage(error, 'Failed to load asset details'),
        tone: 'error',
        actions: [{ id: 'back', label: 'Back', variant: 'primary', onPress: onBack }],
      });
    } finally {
      setLoading(false);
    }
  }, [assetId, dialog, onBack, token]);

  useEffect(() => {
    loadAsset();
  }, [loadAsset]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const intervalId = setInterval(async () => {
      try {
        const data = await getSingleAsset(token, assetId);
        setAsset(data);
      } catch {
        // Keep background refresh silent.
      }
    }, 20000);

    return () => clearInterval(intervalId);
  }, [assetId, token]);

  const quickResponseEnabled = isAssetQuickResponseActive(asset);
  const quickResponseToggleDisabled = !asset?.quickResponse || actionLoading !== null;
  const stolenToggleDisabled = !asset || actionLoading !== null;
  const heroImage = asset?.images?.[0] ? toAbsoluteAssetUrl(asset.images[0]) : '';
  const activities = asset?.activities || [];
  const latestActivities = getLatestActivitiesByType(activities);

  const handleQuickResponseToggle = async (nextValue: boolean) => {
    if (!token || !asset?.quickResponse || actionLoading) {
      return;
    }

    setActionLoading('quickResponse');

    try {
      const response = nextValue
        ? await enableQuickResponseByAsset(token, asset.id)
        : await disableQuickResponseByAsset(token, asset.id);

      setAsset((current) =>
        current
          ? {
              ...current,
              quickResponse: current.quickResponse
                ? {
                    ...current.quickResponse,
                    status: response.quickResponse?.status || (nextValue ? 'ACTIVE' : 'DISABLED'),
                  }
                : current.quickResponse,
            }
          : current,
      );
    } catch (error: unknown) {
      void dialog.alert({
        title: 'Error',
        message: getErrorMessage(error, nextValue ? 'Failed to activate QR' : 'Failed to deactivate QR'),
        tone: 'error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStolenToggle = async (nextValue: boolean) => {
    if (!token || !asset || actionLoading) {
      return;
    }

    setActionLoading('stolen');

    try {
      const response = await setAssetStolenMode(token, asset.id, nextValue);

      setAsset((current) =>
        response.asset
          ? response.asset
          : current
            ? {
                ...current,
                stolenMode: nextValue,
              }
            : current,
      );
      void dialog.alert({
        title: nextValue ? 'Stolen mode enabled' : 'Stolen mode disabled',
        message: nextValue
          ? 'This asset is now marked as stolen.'
          : 'This asset is no longer marked as stolen.',
        tone: 'success',
      });
    } catch (error: unknown) {
      void dialog.alert({
        title: 'Update failed',
        message: getErrorMessage(error, 'Failed to update stolen mode'),
        tone: 'error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAsset = async () => {
    if (!token || !asset || actionLoading) {
      return;
    }

    const confirmed = await dialog.confirm({
      title: 'Delete asset?',
      message: 'This will unlink the asset from its QR and remove it from your account.',
      tone: 'confirm',
      confirmLabel: 'Delete',
    });

    if (!confirmed || !token || !asset || actionLoading) {
      return;
    }

    setActionLoading('delete');

    try {
      await deleteAsset(token, asset.id);
      await dialog.alert({
        title: 'Asset deleted',
        message: 'The QR code has been unlinked from this asset.',
        tone: 'success',
      });
      onBack();
    } catch (error: unknown) {
      void dialog.alert({
        title: 'Delete failed',
        message: getErrorMessage(error, 'Failed to delete asset'),
        tone: 'error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditAsset = () => {
    if (asset) {
      onEditAsset(asset);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.textBody} />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primaryStrong} />
        </View>
      ) : asset ? (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <View style={styles.heroImageWrap}>
              {heroImage ? (
                <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={styles.heroFallback}>
                  <Ionicons
                    name={getAssetTypeIcon(asset.type)}
                    size={isVehicleAssetType(asset.type) ? 52 : 58}
                    color={colors.primaryStrong}
                  />
                </View>
              )}
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.assetName}>{asset.name}</Text>
              <View style={styles.heroMetaRow}>
                <View style={styles.assetTypeBadge}>
                  <Ionicons
                    name={getAssetTypeIcon(asset.type)}
                    size={isVehicleAssetType(asset.type) ? 14 : 15}
                    color={colors.primaryStrong}
                  />
                  <Text style={styles.assetTypeBadgeText}>{asset.type}</Text>
                </View>

                <TouchableOpacity style={styles.editButton} activeOpacity={0.85} onPress={handleEditAsset}>
                  <Ionicons name="create-outline" size={14} color={colors.primary} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>

              {asset.notes ? <Text style={styles.heroNotes}>{asset.notes}</Text> : null}
            </View>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusIconWrap, styles.statusIconGreen]}>
                <Ionicons name="shield-checkmark-outline" size={24} color={colors.primaryStrong} />
              </View>

              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>QR Status</Text>
                <Text style={styles.statusSubtitle}>People can contact you</Text>
              </View>

              <View style={styles.statusControl}>
                <Switch
                  value={quickResponseEnabled}
                  onValueChange={handleQuickResponseToggle}
                  disabled={quickResponseToggleDisabled}
                  trackColor={{ false: colors.borderNeutral, true: colors.primary }}
                  thumbColor={colors.white}
                />
                <Text style={[styles.statusStateText, quickResponseEnabled ? styles.statusStateTextOn : styles.statusStateTextOff]}>
                  {quickResponseEnabled ? 'Active' : 'Off'}
                </Text>
              </View>
            </View>

            <View style={styles.statusDivider} />

            <View style={styles.statusRow}>
              <View style={[styles.statusIconWrap, styles.statusIconRed]}>
                <MaterialCommunityIcons name="shield-alert-outline" size={24} color={colors.danger} />
              </View>

              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>Stolen Mode</Text>
                <Text style={styles.statusSubtitle}>Mark this asset as stolen</Text>
              </View>

              <View style={styles.statusControl}>
                <Switch
                  value={!!asset.stolenMode}
                  onValueChange={handleStolenToggle}
                  disabled={stolenToggleDisabled}
                  trackColor={{ false: colors.borderNeutral, true: colors.dangerSoft }}
                  thumbColor={colors.white}
                />
                <Text
                  style={[
                    styles.statusStateText,
                    asset.stolenMode ? styles.statusStateTextDanger : styles.statusStateTextOff,
                  ]}
                >
                  {asset.stolenMode ? 'On' : 'Off'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.activityCard}>
            <Text style={styles.cardTitle}>Recent Activity</Text>

            {latestActivities.length > 0 ? (
              latestActivities.map((activity, index) => {
                const activityUi = getAssetActivityPresentation(activity);
                const durationLabel = formatAssetActivityDuration(activity.durationSeconds);
                const isWhatsAppActivity = activity.type.trim().toUpperCase() === 'WHATSAPP';

                return (
                  <View key={activity.id}>
                    {index > 0 ? <View style={styles.divider} /> : null}
                    <View style={styles.activityRow}>
                      <View style={[styles.activityIconWrap, { backgroundColor: activityUi.iconBackground }]}>
                        <Ionicons name={activityUi.icon} size={22} color={activityUi.iconColor} />
                      </View>

                      <View style={styles.activityCopy}>
                        <View style={styles.activityTitleRow}>
                          <Text style={styles.activityTitle}>
                            {isWhatsAppActivity ? 'WhatsApp Message' : activityUi.title}
                          </Text>
                        </View>

                        <Text style={styles.activityMeta}>
                          {formatAssetActivityDate(activity.occurredAt)} {'\u2022'} {formatAssetActivityTime(activity.occurredAt)}
                        </Text>
                        {isWhatsAppActivity ? (
                          <Text style={styles.activityMeta}>WhatsApp report sent</Text>
                        ) : (
                          <>
                            <Text style={styles.activityMeta}>{activityUi.meta}</Text>
                            {durationLabel ? <Text style={styles.activityMeta}>Duration: {durationLabel}</Text> : null}
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyActivityWrap}>
                <Text style={styles.emptyActivityText}>No recent activity yet.</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.deleteButton, actionLoading === 'delete' ? styles.deleteButtonDisabled : null]}
            onPress={handleDeleteAsset}
            activeOpacity={0.9}
            disabled={actionLoading === 'delete'}
          >
            <View style={styles.deleteIconWrap}>
              {actionLoading === 'delete' ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="trash-outline" size={24} color={colors.white} />
              )}
            </View>
            <View style={styles.deleteCopy}>
              <Text style={styles.deleteTitle}>Delete Asset</Text>
              <Text style={styles.deleteSubtitle}>Permanently remove this asset from your account</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

