import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDialog } from '../context/DialogContext';
import {
  requestOwnerForgotPasswordOtp,
  resetOwnerForgottenPassword,
} from '../services/auth';
import { getErrorMessage } from '../utils/error';
import {
  PK_PHONE_PREFIX,
  sanitizePkLocalPhoneInput,
  toBackendPkPhone,
} from '../utils/phone';
import { startSmsOtpListener, stopSmsOtpListener } from '../../modules/sms-retriever';
import { colors } from '../theme/colors';
import { styles } from '../styles/PasswordResetScreen.styles';

const OTP_DIGIT_LIMIT = 6;
const OTP_RESEND_INTERVAL_SECONDS = 30;

interface PasswordResetScreenProps {
  phone: string;
  onBack: () => void;
}

function formatOtpCountdown(seconds: number) {
  const normalizedSeconds = Math.max(0, seconds);
  const minutes = Math.floor(normalizedSeconds / 60);
  const remainingSeconds = normalizedSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function isValidPasswordFormat(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function PasswordField({
  label,
  placeholder,
  value,
  onChangeText,
  errorText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  errorText?: string;
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, errorText ? styles.inputShellError : null]}>
        <Ionicons name="lock-closed-outline" size={22} color={colors.textPlaceholder} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textPlaceholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!isPasswordVisible}
          autoComplete="password-new"
          textContentType="newPassword"
        />
        <TouchableOpacity
          onPress={() => setIsPasswordVisible((current) => !current)}
          style={styles.rightIcon}
          accessibilityRole="button"
          accessibilityLabel={isPasswordVisible ? `Hide ${label}` : `Show ${label}`}
        >
          <Ionicons
            name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.textPlaceholder}
          />
        </TouchableOpacity>
      </View>
      {errorText ? <Text style={styles.fieldErrorText}>{errorText}</Text> : null}
    </View>
  );
}

export default function PasswordResetScreen({ phone, onBack }: PasswordResetScreenProps) {
  const dialog = useDialog();
  const phoneDigits = sanitizePkLocalPhoneInput(phone);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [isOtpRequested, setIsOtpRequested] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => () => stopSmsOtpListener(), []);

  useEffect(() => {
    if (resendCountdown <= 0) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [resendCountdown]);

  const handleBack = useCallback(() => {
    stopSmsOtpListener();
    onBack();
  }, [onBack]);

  const handleRequestOtp = async () => {
    if (!phoneDigits || isRequestingOtp || resendCountdown > 0) {
      return;
    }

    setOtp('');
    setOtpError(null);
    setIsRequestingOtp(true);
    let keepOtpListener = false;

    try {
      await startSmsOtpListener((code) => {
        setOtp(code);
        setOtpError(null);
      });
      await requestOwnerForgotPasswordOtp({ phone: toBackendPkPhone(phoneDigits) });
      setIsOtpRequested(true);
      setResendCountdown(OTP_RESEND_INTERVAL_SECONDS);
      keepOtpListener = true;
    } catch (error: unknown) {
      void dialog.alert({
        title: 'Could not send code',
        message: getErrorMessage(error, 'Failed to send a password reset code.'),
        tone: 'error',
      });
    } finally {
      if (!keepOtpListener) {
        stopSmsOtpListener();
      }
      setIsRequestingOtp(false);
    }
  };

  const handleResetPassword = async () => {
    const trimmedOtp = otp.trim();
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (trimmedOtp.length !== OTP_DIGIT_LIMIT) {
      setOtpError(`Please enter the ${OTP_DIGIT_LIMIT}-digit verification code.`);
      return;
    }

    setOtpError(null);

    if (!trimmedNewPassword) {
      setPasswordError('Password is required.');
      return;
    }

    if (!isValidPasswordFormat(trimmedNewPassword)) {
      setPasswordError('Password must be at least 8 characters and include a letter and a number.');
      return;
    }

    setPasswordError(null);

    if (!trimmedConfirmPassword) {
      setConfirmPasswordError('Please confirm your password.');
      return;
    }

    if (trimmedNewPassword !== trimmedConfirmPassword) {
      setConfirmPasswordError('Password and confirm password do not match.');
      return;
    }

    setConfirmPasswordError(null);
    stopSmsOtpListener();
    setIsResettingPassword(true);

    try {
      const response = await resetOwnerForgottenPassword({
        phone: toBackendPkPhone(phoneDigits),
        otp: trimmedOtp,
        newPassword: trimmedNewPassword,
      });

      await dialog.alert({
        title: 'Password reset successful',
        message: response.message || 'Your password has been updated successfully.',
        tone: 'success',
      });
      handleBack();
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to reset your password.');

      if (message === 'Invalid OTP') {
        setOtpError('Invalid OTP. Please enter the correct 6-digit code.');
      } else {
        void dialog.alert({ title: 'Reset failed', message, tone: 'error' });
      }
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        enabled
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={24} color={colors.textBody} />
            </TouchableOpacity>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="lock-closed-outline" size={30} color={colors.primaryStrong} />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>We will send a verification code to your current phone number.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Current phone number</Text>
            <Text style={styles.phoneValue}>{PK_PHONE_PREFIX} {phoneDigits}</Text>

            {!isOtpRequested ? (
              <TouchableOpacity
                style={[styles.primaryButton, isRequestingOtp ? styles.buttonDisabled : null]}
                activeOpacity={0.9}
                onPress={() => {
                  void handleRequestOtp();
                }}
                disabled={isRequestingOtp}
              >
                {isRequestingOtp ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {isOtpRequested ? (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Verification code</Text>
              <Text style={styles.sectionHint}>Enter the 6-digit code sent to your phone.</Text>

              <TextInput
                style={[styles.otpInput, otpError ? styles.inputShellError : null]}
                value={otp}
                onChangeText={(value) => {
                  setOtpError(null);
                  setOtp(value.replace(/\D/g, '').slice(0, OTP_DIGIT_LIMIT));
                }}
                keyboardType="number-pad"
                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                importantForAutofill="yes"
                maxLength={OTP_DIGIT_LIMIT}
                caretHidden
                autoFocus
                placeholder="123456"
                placeholderTextColor={colors.textPlaceholder}
              />
              {otpError ? <Text style={styles.fieldErrorText}>{otpError}</Text> : null}

              <TouchableOpacity
                style={styles.resendButton}
                activeOpacity={0.8}
                onPress={() => {
                  void handleRequestOtp();
                }}
                disabled={resendCountdown > 0 || isRequestingOtp}
              >
                <Text style={[styles.resendText, resendCountdown > 0 ? styles.resendTextDisabled : null]}>
                  {isRequestingOtp
                    ? 'Sending...'
                    : resendCountdown > 0
                      ? `Resend OTP (${formatOtpCountdown(resendCountdown)})`
                      : 'Resend OTP'}
                </Text>
              </TouchableOpacity>

              <PasswordField
                label="New Password"
                placeholder="Enter your new password"
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  setPasswordError(null);
                }}
                errorText={passwordError || undefined}
              />

              <PasswordField
                label="Confirm Password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setConfirmPasswordError(null);
                }}
                errorText={confirmPasswordError || undefined}
              />

              <TouchableOpacity
                style={[styles.primaryButton, isResettingPassword ? styles.buttonDisabled : null]}
                activeOpacity={0.9}
                onPress={() => {
                  void handleResetPassword();
                }}
                disabled={isResettingPassword}
              >
                {isResettingPassword ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
