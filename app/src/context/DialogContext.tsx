import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { styles } from '../styles/Dialog.styles';

export type DialogTone = 'success' | 'error' | 'warning' | 'info' | 'confirm';
export type DialogActionVariant = 'primary' | 'secondary' | 'destructive';

export interface DialogAction {
  id: string;
  label: string;
  variant?: DialogActionVariant;
  onPress?: () => void | Promise<void>;
}

export interface DialogOptions {
  title: string;
  message: string;
  tone?: DialogTone;
  actions?: DialogAction[];
}

export interface DialogAlertOptions {
  title: string;
  message: string;
  tone?: Exclude<DialogTone, 'confirm'>;
}

export interface DialogConfirmOptions {
  title: string;
  message: string;
  tone?: DialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PendingDialog {
  options: DialogOptions;
  resolve: (actionId: string | undefined) => void;
}

interface DialogContextValue {
  alert: (options: DialogAlertOptions) => Promise<void>;
  confirm: (options: DialogConfirmOptions) => Promise<boolean>;
  open: (options: DialogOptions) => Promise<string | undefined>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

const TONE_META: Record<
  DialogTone,
  {
    icon: keyof typeof Ionicons.glyphMap;
    iconBackground: string;
    iconColor: string;
  }
> = {
  success: {
    icon: 'checkmark',
    iconBackground: colors.successSoftStrong,
    iconColor: colors.primaryStrong,
  },
  error: {
    icon: 'alert-circle',
    iconBackground: colors.dangerSurfaceStrong,
    iconColor: colors.dangerStrong,
  },
  warning: {
    icon: 'warning',
    iconBackground: colors.warningSurface,
    iconColor: colors.warningStrong,
  },
  info: {
    icon: 'information',
    iconBackground: colors.infoSoft,
    iconColor: colors.info,
  },
  confirm: {
    icon: 'help-circle',
    iconBackground: colors.warningSurface,
    iconColor: colors.warningStrong,
  },
};

function getDefaultActions(options: DialogOptions): DialogAction[] {
  if (options.actions && options.actions.length > 0) {
    return options.actions;
  }

  return [{ id: 'ok', label: 'OK', variant: 'primary' }];
}

function getActionVariant(action: DialogAction, index: number, actionCount: number): DialogActionVariant {
  if (action.variant) {
    return action.variant;
  }

  if (action.id === 'cancel' || action.id === 'close' || (actionCount > 1 && index === 0)) {
    return 'secondary';
  }

  return 'primary';
}

function DialogView({ dialog, onDismiss }: { dialog: PendingDialog; onDismiss: (actionId?: string) => void }) {
  const tone = dialog.options.tone ?? 'info';
  const toneMeta = TONE_META[tone];
  const actions = getDefaultActions(dialog.options);

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={() => onDismiss()}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={styles.card}
          accessible
          accessibilityViewIsModal
          accessibilityRole="alert"
          accessibilityLabel={dialog.options.title}
        >
          <View style={[styles.iconWrap, { backgroundColor: toneMeta.iconBackground }]}>
            <Ionicons name={toneMeta.icon} size={30} color={toneMeta.iconColor} />
          </View>

          <Text style={styles.title}>{dialog.options.title}</Text>

          <ScrollView style={styles.messageScroll} contentContainerStyle={styles.messageContent}>
            <Text style={styles.message}>{dialog.options.message}</Text>
          </ScrollView>

          <View style={[styles.actions, actions.length === 1 ? styles.actionsSingle : null]}>
            {actions.map((action, index) => {
              const variant = getActionVariant(action, index, actions.length);

              return (
                <Pressable
                  key={action.id}
                  style={({ pressed }) => [
                    styles.action,
                    actions.length === 1 ? styles.actionSingle : styles.actionMultiple,
                    variant === 'primary'
                      ? styles.actionPrimary
                      : variant === 'destructive'
                        ? styles.actionDestructive
                        : styles.actionSecondary,
                    pressed ? styles.actionPressed : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={() => {
                    onDismiss(action.id);
                    void Promise.resolve(action.onPress?.()).catch(() => undefined);
                  }}
                >
                  <Text
                    style={[
                      styles.actionText,
                      variant === 'secondary' ? styles.actionSecondaryText : styles.actionPrimaryText,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<PendingDialog[]>([]);
  const [activeDialog, setActiveDialog] = useState<PendingDialog | null>(null);

  useEffect(() => {
    if (activeDialog || queue.length === 0) {
      return;
    }

    const [nextDialog, ...remainingDialogs] = queue;
    setQueue(remainingDialogs);
    setActiveDialog(nextDialog);
  }, [activeDialog, queue]);

  const open = useCallback((options: DialogOptions) => {
    return new Promise<string | undefined>((resolve) => {
      setQueue((currentQueue) => [...currentQueue, { options, resolve }]);
    });
  }, []);

  const alert = useCallback(async (options: DialogAlertOptions) => {
    await open({
      ...options,
      actions: [{ id: 'ok', label: 'OK', variant: 'primary' }],
    });
  }, [open]);

  const confirm = useCallback(async (options: DialogConfirmOptions) => {
    const actionId = await open({
      title: options.title,
      message: options.message,
      tone: options.tone ?? 'confirm',
      actions: [
        { id: 'cancel', label: options.cancelLabel ?? 'Cancel', variant: 'secondary' },
        { id: 'confirm', label: options.confirmLabel ?? 'Confirm', variant: 'destructive' },
      ],
    });

    return actionId === 'confirm';
  }, [open]);

  const dismissActiveDialog = useCallback((actionId?: string) => {
    if (!activeDialog) {
      return;
    }

    activeDialog.resolve(actionId);
    setActiveDialog(null);
  }, [activeDialog]);

  const contextValue = useMemo<DialogContextValue>(() => ({ alert, confirm, open }), [alert, confirm, open]);

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      {activeDialog ? <DialogView dialog={activeDialog} onDismiss={dismissActiveDialog} /> : null}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }

  return context;
}
