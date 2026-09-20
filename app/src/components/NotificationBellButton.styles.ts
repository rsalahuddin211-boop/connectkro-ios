import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonUnread: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: colors.overlaySoft,
  },
  dropdownBackdrop: {
    flex: 1,
  },
  dropdownWrap: {
    position: 'absolute',
    top: 72,
    left: 16,
    right: 16,
    alignItems: 'flex-end',
  },
  dropdownCard: {
    width: '100%',
    maxWidth: 328,
    borderRadius: 22,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 10,
  },
  dropdownTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dropdownScroll: {
    flexGrow: 0,
  },
  dropdownScrollContent: {
    paddingBottom: 4,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderRadius: 14,
  },
  notificationRowUnread: {
    backgroundColor: colors.accentSoft,
  },
  notificationRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  notificationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCopy: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  notificationMeta: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  notificationDate: {
    marginTop: 5,
    fontSize: 12,
    color: colors.textTertiary,
  },
  viewAllButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  viewAllButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentText,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textMuted,
  },
  emptyStateText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textTertiary,
  },
});
