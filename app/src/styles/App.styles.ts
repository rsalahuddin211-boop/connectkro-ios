import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  bottomNavBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceApp,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  navTextActive: {
    color: colors.primaryStrong,
  },
  navTextInactive: {
    color: colors.textTertiary,
  },
  qrButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -40,
  },
  qrButtonInner: {
    width: 90,
    height: 90,
    borderRadius: 50,
    backgroundColor: colors.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryButton,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 4,
    borderColor: colors.white,
  },
});
