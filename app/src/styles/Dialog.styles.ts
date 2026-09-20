import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '82%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    borderRadius: 28,
    backgroundColor: colors.white,
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 30,
    elevation: 10,
  },
  iconWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderRadius: 36,
  },
  title: {
    marginBottom: 10,
    color: colors.textPrimary,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    textAlign: 'center',
  },
  messageScroll: {
    width: '100%',
    flexShrink: 1,
    marginBottom: 22,
  },
  messageContent: {
    flexGrow: 1,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  actionsSingle: {
    flexDirection: 'column',
    gap: 0,
  },
  action: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  actionSingle: {
    width: '100%',
  },
  actionMultiple: {
    flex: 1,
  },
  actionPrimary: {
    backgroundColor: colors.primaryStrong,
  },
  actionDestructive: {
    backgroundColor: colors.danger,
  },
  actionSecondary: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceMuted,
  },
  actionPressed: {
    opacity: 0.82,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionPrimaryText: {
    color: colors.white,
  },
  actionSecondaryText: {
    color: colors.textBody,
  },
});
