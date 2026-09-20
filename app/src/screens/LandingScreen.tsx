import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  ActivityIndicator,
  BackHandler,
  findNodeHandle,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  LoginRequiresVerificationError,
  loginOwner,
  requestOwnerForgotPasswordOtp,
  requestOwnerVerificationOtp,
  resetOwnerForgottenPassword,
  signupOwner,
  verifyOwner,
} from '../services/auth';
import { getPublicPlatformSettings } from '../services/platformSettings';
import { ApiError } from '../services/http';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { styles } from '../styles/LandingScreen.styles';
import authLogo from '../../assets/image 44.png';
import { colors } from '../theme/colors';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PK_LOCAL_PHONE_DIGIT_COUNT,
  PK_PHONE_PREFIX,
  isValidPkMobileDigits,
  sanitizePkLocalPhoneInput,
  toBackendPkPhone,
  formatPkPhone,
} from '../utils/phone';
import type {
  OwnerLoginPayload,
  OwnerSignupPayload,
  OwnerSignupResponse,
  OwnerVerifyPayload,
} from '../types/auth';
import { startSmsOtpListener, stopSmsOtpListener } from '../../modules/sms-retriever';

type ScreenMode = 'signup' | 'otp' | 'login' | 'forgotPassword';
type OtpOrigin = 'signup' | 'login';

interface LandingScreenProps {
  onPrivacyPolicyPress: () => void;
  onTermsConditionsPress: () => void;
}

interface SignupFormState {
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface OtpFormState {
  otp: string;
}

interface LoginFormState {
  phone: string;
  password: string;
  rememberMe: boolean;
}

interface ForgotPasswordFormState {
  phone: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

const initialSignupState: SignupFormState = {
  name: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

const initialOtpState: OtpFormState = {
  otp: '',
};

const initialLoginState: LoginFormState = {
  phone: '',
  password: '',
  rememberMe: true,
};

const initialForgotPasswordState: ForgotPasswordFormState = {
  phone: '',
  otp: '',
  newPassword: '',
  confirmPassword: '',
};

const PHONE_DIGIT_LIMIT = PK_LOCAL_PHONE_DIGIT_COUNT;
const OTP_DIGIT_LIMIT = 6;
const OTP_RESEND_INTERVAL_SECONDS = 30;
const REMEMBERED_LOGIN_PHONE_KEY = 'qr-project-remembered-login-phone';

function formatOtpCountdown(seconds: number) {
  const normalizedSeconds = Math.max(0, seconds);
  const minutes = Math.floor(normalizedSeconds / 60);
  const remainingSeconds = normalizedSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function isValidPasswordFormat(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function Field({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  secureTextEntry,
  maxLength,
  errorText,
  inputRef,
  onFocus,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  secureTextEntry?: boolean;
  maxLength?: number;
  errorText?: string;
  inputRef?: React.RefObject<TextInput | null>;
  onFocus?: () => void;
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, errorText ? styles.inputShellError : null]}>
        <Ionicons name={icon} size={22} color={colors.textPlaceholder} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textPlaceholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          maxLength={maxLength}
          ref={inputRef}
          onFocus={onFocus}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.rightIcon}>
            <Ionicons name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textPlaceholder} />
          </TouchableOpacity>
        )}
      </View>
      {errorText ? <Text style={styles.fieldErrorText}>{errorText}</Text> : null}
    </View>
  );
}

function PhoneField({
  label,
  value,
  onChangeText,
  errorText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  errorText?: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, errorText ? styles.inputShellError : null]}>
        <Text style={styles.flagEmoji}>{'\uD83C\uDDF5\uD83C\uDDF0'}</Text>
        <Text style={styles.phonePrefix}>{PK_PHONE_PREFIX}</Text>
        <TextInput
          style={styles.input}
          placeholder="3001234567"
          placeholderTextColor={colors.textPlaceholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType="phone-pad"
          maxLength={PHONE_DIGIT_LIMIT}
        />
      </View>
      {errorText ? <Text style={styles.fieldErrorText}>{errorText}</Text> : null}
    </View>
  );
}

function HeroIcon() {
  const [remoteLogoUri, setRemoteLogoUri] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadPlatformLogo() {
      try {
        const settings = await getPublicPlatformSettings();

        if (!isActive) {
          return;
        }

        setRemoteLogoUri(settings.appLogoDataUrl || null);
      } catch {
        if (!isActive) {
          return;
        }

        setRemoteLogoUri(null);
      }
    }

    void loadPlatformLogo();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <View style={styles.heroIconWrap}>
      <View style={styles.heroIcon}>
        <Image
          source={remoteLogoUri ? { uri: remoteLogoUri } : authLogo}
          style={styles.heroIconImage}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

export default function LandingScreen({
  onPrivacyPolicyPress,
  onTermsConditionsPress,
}: LandingScreenProps) {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const dialog = useDialog();
  const [screenMode, setScreenMode] = useState<ScreenMode>('login');
  const [signupForm, setSignupForm] = useState<SignupFormState>(initialSignupState);
  const [otpForm, setOtpForm] = useState<OtpFormState>(initialOtpState);
  const [loginForm, setLoginForm] = useState<LoginFormState>(initialLoginState);
  const [forgotPasswordForm, setForgotPasswordForm] = useState<ForgotPasswordFormState>(initialForgotPasswordState);
  const [pendingSignup, setPendingSignup] = useState<OwnerSignupResponse | null>(null);
  const [otpOrigin, setOtpOrigin] = useState<OtpOrigin>('signup');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingForgotPasswordOtp, setIsRequestingForgotPasswordOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [signupOtpError, setSignupOtpError] = useState<string | null>(null);
  const [signupPhoneError, setSignupPhoneError] = useState<string | null>(null);
  const [loginPhoneError, setLoginPhoneError] = useState<string | null>(null);
  const [loginPasswordError, setLoginPasswordError] = useState<string | null>(null);
  const [forgotPasswordOtpError, setForgotPasswordOtpError] = useState<string | null>(null);
  const [forgotPasswordPasswordError, setForgotPasswordPasswordError] = useState<string | null>(null);
  const [forgotPasswordConfirmPasswordError, setForgotPasswordConfirmPasswordError] = useState<string | null>(null);
  const [verificationResendCountdown, setVerificationResendCountdown] = useState(0);
  const [forgotPasswordResendCountdown, setForgotPasswordResendCountdown] = useState(0);
  const [isRequestingVerificationOtp, setIsRequestingVerificationOtp] = useState(false);
  const [supportPhone, setSupportPhone] = useState('');
  const forgotPasswordScrollViewRef = useRef<ScrollView | null>(null);
  const forgotPasswordNewPasswordRef = useRef<TextInput | null>(null);
  const forgotPasswordConfirmPasswordRef = useRef<TextInput | null>(null);
  const showPasswordFormatHint =
    signupForm.password.length > 0 && !isValidPasswordFormat(signupForm.password);

  const scrollForgotPasswordInputIntoView = useCallback((inputRef: React.RefObject<TextInput | null>) => {
    const inputHandle = findNodeHandle(inputRef.current);

    if (inputHandle === null) {
      return;
    }

    forgotPasswordScrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(inputHandle, 64, true);
  }, []);

  useEffect(() => {
    if (screenMode !== 'otp' && screenMode !== 'forgotPassword') {
      stopSmsOtpListener();
    }
  }, [screenMode]);

  useEffect(() => () => stopSmsOtpListener(), []);

  useEffect(() => {
    let isActive = true;

    getPublicPlatformSettings()
      .then((settings) => {
        if (isActive) {
          setSupportPhone(settings.companyPhone || '');
        }
      })
      .catch(() => {
        if (isActive) {
          setSupportPhone('');
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const isBlockedAccountError = (error: unknown) =>
    error instanceof ApiError && error.code === 'OWNER_BLOCKED';

  const showBlockedAccountDialog = async (title: string) => {
    let nextSupportPhone = supportPhone;

    if (!nextSupportPhone) {
      try {
        const settings = await getPublicPlatformSettings();
        nextSupportPhone = settings.companyPhone || '';
        setSupportPhone(nextSupportPhone);
      } catch {
        nextSupportPhone = '';
      }
    }

    const formattedPhone = nextSupportPhone ? formatPkPhone(nextSupportPhone) : '';
    const message = formattedPhone && formattedPhone !== 'Not added'
      ? `Your account has been blocked by the administrator. Please contact support at ${formattedPhone}.`
      : 'Your account has been blocked by the administrator. Please contact support.';

    void dialog.alert({ title, message, tone: 'error' });
  };

  useEffect(() => {
    let isActive = true;

    async function restoreRememberedPhone() {
      try {
        const rememberedPhone = await SecureStore.getItemAsync(REMEMBERED_LOGIN_PHONE_KEY);

        if (!isActive || !rememberedPhone) {
          return;
        }

        const sanitizedPhone = sanitizePkLocalPhoneInput(rememberedPhone);
        setLoginForm((current) => ({
          ...current,
          phone: sanitizedPhone,
          rememberMe: sanitizedPhone.length > 0,
        }));
      } catch {
        await SecureStore.deleteItemAsync(REMEMBERED_LOGIN_PHONE_KEY);
      }
    }

    void restoreRememberedPhone();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screenMode === 'signup') {
        setScreenMode('login');
        return true;
      }

      if (screenMode === 'forgotPassword') {
        setForgotPasswordOtpError(null);
        setForgotPasswordPasswordError(null);
        setForgotPasswordConfirmPasswordError(null);
        setScreenMode('login');
        return true;
      }

      if (screenMode === 'otp') {
        setScreenMode(otpOrigin === 'login' ? 'login' : 'signup');
        return true;
      }

      return true;
    });

    return () => subscription.remove();
  }, [otpOrigin, screenMode]);

  useEffect(() => {
    if (verificationResendCountdown <= 0) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setVerificationResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [verificationResendCountdown]);

  useEffect(() => {
    if (forgotPasswordResendCountdown <= 0) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setForgotPasswordResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [forgotPasswordResendCountdown]);

  const updateSignupField = (key: keyof SignupFormState, value: string) => {
    setSignupForm((current) => ({ ...current, [key]: value }));
  };

  const updateOtpField = (key: keyof OtpFormState, value: string) => {
    if (key === 'otp' && signupOtpError) {
      setSignupOtpError(null);
    }

    setOtpForm((current) => ({ ...current, [key]: value }));
  };

  const updateLoginField = (key: keyof LoginFormState, value: string | boolean) => {
    if (key === 'password' && loginPasswordError && typeof value === 'string') {
      setLoginPasswordError(null);
    }

    setLoginForm((current) => ({ ...current, [key]: value }));
  };

  const updateForgotPasswordField = (key: keyof ForgotPasswordFormState, value: string) => {
    if (key === 'otp' && forgotPasswordOtpError) {
      setForgotPasswordOtpError(null);
    }

    if (key === 'newPassword' && forgotPasswordPasswordError) {
      setForgotPasswordPasswordError(null);
    }

    if (key === 'confirmPassword' && forgotPasswordConfirmPasswordError) {
      setForgotPasswordConfirmPasswordError(null);
    }

    setForgotPasswordForm((current) => ({ ...current, [key]: value }));
  };

  const updatePhoneDigits = (target: 'signup' | 'login', value: string) => {
    const digitsOnly = sanitizePkLocalPhoneInput(value);

    if (target === 'signup') {
      if (signupPhoneError) {
        setSignupPhoneError(null);
      }

      updateSignupField('phone', digitsOnly);
      return;
    }

    if (loginPhoneError) {
      setLoginPhoneError(null);
    }

    updateLoginField('phone', digitsOnly);
  };

  const handleSignup = async () => {
    const payload: OwnerSignupPayload = {
      name: signupForm.name.trim(),
      phone: toBackendPkPhone(signupForm.phone.trim()),
    };

    if (!payload.name || signupForm.phone.trim().length !== PHONE_DIGIT_LIMIT || !signupForm.password) {
      void dialog.alert({ title: 'Missing fields', message: 'Please fill in name, phone number, and password.', tone: 'warning' });
      return;
    }
    if (!isValidPkMobileDigits(signupForm.phone.trim())) {
      void dialog.alert({ title: 'Invalid phone number', message: 'Enter a valid Pakistani mobile number.', tone: 'warning' });
      return;
    }
    if (!isValidPasswordFormat(signupForm.password)) {
      void dialog.alert({ title: 'Invalid password', message: 'Password must be at least 8 characters long and include letters and numbers.', tone: 'warning' });
      return;
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      void dialog.alert({ title: 'Password mismatch', message: 'Password and confirm password do not match.', tone: 'warning' });
      return;
    }

    setSignupPhoneError(null);
    setIsSubmitting(true);
    let keepOtpListener = false;

    try {
      setOtpForm(initialOtpState);
      setSignupOtpError(null);
      await startSmsOtpListener((code) => {
        setOtpForm({ otp: code });
        setSignupOtpError(null);
      });
      const response = await signupOwner(payload);
      keepOtpListener = true;
      setPendingSignup(response);
      setOtpOrigin('signup');
      setVerificationResendCountdown(OTP_RESEND_INTERVAL_SECONDS);
      setScreenMode('otp');
    } catch (error) {
      if (isBlockedAccountError(error)) {
        void showBlockedAccountDialog('Account blocked');
        return;
      }

      const message = error instanceof Error ? error.message : 'Something went wrong';

      if (message === 'User already exists for this number') {
        setSignupPhoneError('Number already registered');
      } else {
        void dialog.alert({ title: 'Signup failed', message, tone: 'error' });
      }
    } finally {
      if (!keepOtpListener) {
        stopSmsOtpListener();
      }
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!pendingSignup) {
      void dialog.alert({ title: 'Signup required', message: 'Please sign up first before verifying the OTP.', tone: 'warning' });
      setScreenMode('signup');
      return;
    }

    const payload: OwnerVerifyPayload = {
      phone: toBackendPkPhone(signupForm.phone.trim()),
      otp: otpForm.otp.trim(),
      password: signupForm.password.trim(),
    };

    if (payload.otp.length !== OTP_DIGIT_LIMIT) {
      setSignupOtpError(`Please enter the ${OTP_DIGIT_LIMIT}-digit verification code.`);
      return;
    }

    setSignupOtpError(null);
    stopSmsOtpListener();
    setIsSubmitting(true);

    try {
      const response = await verifyOwner(payload);
      setPendingSignup(null);
      setOtpOrigin('signup');
      setSignupForm(initialSignupState);
      setOtpForm(initialOtpState);
      setLoginForm({ phone: signupForm.phone, password: '', rememberMe: true });
      setScreenMode('login');
      void dialog.alert({ title: "You're all set", message: response.message, tone: 'success' });
    } catch (error) {
      if (isBlockedAccountError(error)) {
        void showBlockedAccountDialog('Account blocked');
        return;
      }

      const message = error instanceof Error ? error.message : 'Something went wrong';

      if (message === 'Invalid OTP') {
        setSignupOtpError('Invalid OTP');
      } else {
        void dialog.alert({ title: 'Verification failed', message, tone: 'error' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    const payload: OwnerLoginPayload = {
      phone: toBackendPkPhone(loginForm.phone.trim()),
      password: loginForm.password.trim(),
    };

    if (loginForm.phone.trim().length !== PHONE_DIGIT_LIMIT) {
      setLoginPhoneError('Enter a 10-digit phone number.');
      return;
    }
    if (!isValidPkMobileDigits(loginForm.phone.trim())) {
      setLoginPhoneError('Enter a valid Pakistani mobile number.');
      return;
    }

    setLoginPhoneError(null);

    if (!payload.password) {
      setLoginPasswordError('Password is required.');
      return;
    }

    setLoginPasswordError(null);

    setIsSubmitting(true);
    let keepOtpListener = false;

    try {
      setOtpForm(initialOtpState);
      setSignupOtpError(null);
      await startSmsOtpListener((code) => {
        setOtpForm({ otp: code });
        setSignupOtpError(null);
      });
      if (loginForm.rememberMe) {
        await SecureStore.setItemAsync(REMEMBERED_LOGIN_PHONE_KEY, loginForm.phone.trim());
      } else {
        await SecureStore.deleteItemAsync(REMEMBERED_LOGIN_PHONE_KEY);
      }

      const response = await loginOwner(payload);
      await login(response.token, response.owner);
    } catch (error) {
      if (error instanceof LoginRequiresVerificationError) {
        setPendingSignup({
          message: error.message,
          owner: error.owner || {
            id: 0,
            userId: 0,
            name: '',
            phone: payload.phone,
            otpVerified: false,
            role: 'owner',
            allowEmergencyContact: false,
            pushNotificationsEnabled: true,
          },
        });
        setSignupForm((current) => ({
          ...current,
          name: error.owner?.name || current.name,
          phone: loginForm.phone,
          password: loginForm.password,
          confirmPassword: loginForm.password,
        }));
        setOtpOrigin('login');
        setVerificationResendCountdown(OTP_RESEND_INTERVAL_SECONDS);
        setScreenMode('otp');
        keepOtpListener = true;
        return;
      }

      if (isBlockedAccountError(error)) {
        void showBlockedAccountDialog('Account blocked');
        return;
      }

      const message = error instanceof Error ? error.message : 'Something went wrong';

      if (message === 'Invalid credentials') {
        setLoginPasswordError('Invalid password');
      } else {
        void dialog.alert({ title: 'Login failed', message, tone: 'error' });
      }
    } finally {
      if (!keepOtpListener) {
        stopSmsOtpListener();
      }
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordRequest = async (source: 'login' | 'forgot' = 'login') => {
    const phoneDigits =
      source === 'forgot' ? forgotPasswordForm.phone.trim() : loginForm.phone.trim();

    if (phoneDigits.length !== PHONE_DIGIT_LIMIT) {
      if (source === 'login') {
        setLoginPhoneError('Enter a 10-digit phone number.');
      } else {
        void dialog.alert({ title: 'Could not send code', message: 'Enter a 10-digit phone number.', tone: 'warning' });
      }
      return;
    }
    if (!isValidPkMobileDigits(phoneDigits)) {
      if (source === 'login') {
        setLoginPhoneError('Enter a valid Pakistani mobile number.');
      } else {
        void dialog.alert({ title: 'Could not send code', message: 'Enter a valid Pakistani mobile number.', tone: 'warning' });
      }
      return;
    }

    if (source === 'login') {
      setLoginPhoneError(null);
    }

    setIsRequestingForgotPasswordOtp(true);
    let keepOtpListener = false;

    try {
      setForgotPasswordForm({
        phone: phoneDigits,
        otp: '',
        newPassword: '',
        confirmPassword: '',
      });
      await startSmsOtpListener((code) => {
        setForgotPasswordForm((current) => ({ ...current, otp: code }));
        setForgotPasswordOtpError(null);
      });
      await requestOwnerForgotPasswordOtp({
        phone: toBackendPkPhone(phoneDigits),
      });

      keepOtpListener = true;
      setForgotPasswordOtpError(null);
      setForgotPasswordPasswordError(null);
      setForgotPasswordConfirmPasswordError(null);
      setForgotPasswordResendCountdown(OTP_RESEND_INTERVAL_SECONDS);
      setScreenMode('forgotPassword');
    } catch (error) {
      if (isBlockedAccountError(error)) {
        void showBlockedAccountDialog('Account blocked');
        return;
      }

      const message = error instanceof Error ? error.message : 'Something went wrong';

      if (message === 'User not found' || message === 'Owner not found') {
        if (source === 'login') {
          setLoginPhoneError('User not found.');
        } else {
          void dialog.alert({ title: 'Could not send code', message: 'User not found.', tone: 'error' });
        }
      } else {
        void dialog.alert({ title: 'Could not send code', message, tone: 'error' });
      }
    } finally {
      if (!keepOtpListener) {
        stopSmsOtpListener();
      }
      setIsRequestingForgotPasswordOtp(false);
    }
  };

  const handleVerificationOtpResend = async () => {
    if (verificationResendCountdown > 0 || isRequestingVerificationOtp) {
      return;
    }

    const phoneDigits = signupForm.phone.trim();
    if (phoneDigits.length !== PHONE_DIGIT_LIMIT) {
      void dialog.alert({ title: 'Could not resend code', message: 'Enter a 10-digit phone number.', tone: 'warning' });
      return;
    }
    if (!isValidPkMobileDigits(phoneDigits)) {
      void dialog.alert({ title: 'Could not resend code', message: 'Enter a valid Pakistani mobile number.', tone: 'warning' });
      return;
    }

    setIsRequestingVerificationOtp(true);
    let keepOtpListener = false;

    try {
      setOtpForm(initialOtpState);
      setSignupOtpError(null);
      await startSmsOtpListener((code) => {
        setOtpForm({ otp: code });
        setSignupOtpError(null);
      });
      await requestOwnerVerificationOtp({
        phone: toBackendPkPhone(phoneDigits),
      });

      keepOtpListener = true;
      setVerificationResendCountdown(OTP_RESEND_INTERVAL_SECONDS);
    } catch (error) {
      if (isBlockedAccountError(error)) {
        void showBlockedAccountDialog('Account blocked');
        return;
      }

      const message = error instanceof Error ? error.message : 'Something went wrong';
      void dialog.alert({ title: 'Could not resend code', message, tone: 'error' });
    } finally {
      if (!keepOtpListener) {
        stopSmsOtpListener();
      }
      setIsRequestingVerificationOtp(false);
    }
  };

  const handleForgotPasswordOtpResend = async () => {
    if (forgotPasswordResendCountdown > 0 || isRequestingForgotPasswordOtp) {
      return;
    }

    const phoneDigits = forgotPasswordForm.phone.trim();
    if (phoneDigits.length !== PHONE_DIGIT_LIMIT) {
      void dialog.alert({ title: 'Could not resend code', message: 'Enter a 10-digit phone number.', tone: 'warning' });
      return;
    }
    if (!isValidPkMobileDigits(phoneDigits)) {
      void dialog.alert({ title: 'Could not resend code', message: 'Enter a valid Pakistani mobile number.', tone: 'warning' });
      return;
    }

    setIsRequestingForgotPasswordOtp(true);
    let keepOtpListener = false;

    try {
      setForgotPasswordForm((current) => ({
        ...current,
        otp: '',
      }));
      setForgotPasswordOtpError(null);
      await startSmsOtpListener((code) => {
        setForgotPasswordForm((current) => ({ ...current, otp: code }));
        setForgotPasswordOtpError(null);
      });
      await requestOwnerForgotPasswordOtp({
        phone: toBackendPkPhone(phoneDigits),
      });

      keepOtpListener = true;
      setForgotPasswordResendCountdown(OTP_RESEND_INTERVAL_SECONDS);
    } catch (error) {
      if (isBlockedAccountError(error)) {
        void showBlockedAccountDialog('Account blocked');
        return;
      }

      const message = error instanceof Error ? error.message : 'Something went wrong';
      void dialog.alert({ title: 'Could not resend code', message, tone: 'error' });
    } finally {
      if (!keepOtpListener) {
        stopSmsOtpListener();
      }
      setIsRequestingForgotPasswordOtp(false);
    }
  };

  const handleForgotPasswordReset = async () => {
    const otp = forgotPasswordForm.otp.trim();
    const newPassword = forgotPasswordForm.newPassword.trim();
    const confirmPassword = forgotPasswordForm.confirmPassword.trim();

    if (otp.length !== OTP_DIGIT_LIMIT) {
      setForgotPasswordOtpError(`Please enter the ${OTP_DIGIT_LIMIT}-digit verification code.`);
      return;
    }

    setForgotPasswordOtpError(null);
    stopSmsOtpListener();

    if (!newPassword) {
      setForgotPasswordPasswordError('Password is required.');
      return;
    }

    if (!isValidPasswordFormat(newPassword)) {
      setForgotPasswordPasswordError(
        'Password must be at least 8 characters long and include letters and numbers.',
      );
      return;
    }

    setForgotPasswordPasswordError(null);

    if (!confirmPassword) {
      setForgotPasswordConfirmPasswordError('Please confirm your password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotPasswordConfirmPasswordError('Password and confirm password do not match.');
      return;
    }

    setForgotPasswordConfirmPasswordError(null);
    setIsResettingPassword(true);

    try {
      const response = await resetOwnerForgottenPassword({
        phone: toBackendPkPhone(forgotPasswordForm.phone),
        otp,
        newPassword,
      });

      await dialog.alert({ title: 'Password reset', message: response.message, tone: 'success' });
      setForgotPasswordForm(initialForgotPasswordState);
      setLoginForm((current) => ({
        ...current,
        phone: forgotPasswordForm.phone,
        password: '',
      }));
      setScreenMode('login');
    } catch (error) {
      if (isBlockedAccountError(error)) {
        void showBlockedAccountDialog('Account blocked');
        return;
      }

      const message = error instanceof Error ? error.message : 'Something went wrong';

      if (message === 'Invalid OTP') {
        setForgotPasswordOtpError('Invalid OTP. Please enter the correct 6-digit code.');
      } else if (message === 'User not found' || message === 'Owner not found') {
        void dialog.alert({ title: 'Reset failed', message: 'User not found.', tone: 'error' });
      } else {
        void dialog.alert({ title: 'Reset failed', message, tone: 'error' });
      }
    } finally {
      setIsResettingPassword(false);
    }
  };



  const renderSignup = () => (
    <View style={styles.formScreen}>
      <HeroIcon />
      <Text style={styles.title}>Create Your Account</Text>
      <Text style={styles.signupSubtitle}>Sign up to protect and manage your assets</Text>

      <View style={styles.formCard}>
        <Field
          label="Full Name"
          icon="person-outline"
          placeholder="Enter your full name"
          value={signupForm.name}
          onChangeText={(value) => updateSignupField('name', value)}
        />
        <PhoneField
          label="Phone Number"
          value={signupForm.phone}
          onChangeText={(value) => updatePhoneDigits('signup', value)}
          errorText={signupPhoneError || undefined}
        />
        <Field
          label="Password"
          icon="lock-closed-outline"
          placeholder="Create your password"
          value={signupForm.password}
          onChangeText={(value) => updateSignupField('password', value)}
          secureTextEntry
        />
        <Field
          label="Confirm Password"
          icon="lock-closed-outline"
          placeholder="Confirm your password"
          value={signupForm.confirmPassword}
          onChangeText={(value) => updateSignupField('confirmPassword', value)}
          secureTextEntry
        />

        {showPasswordFormatHint ? (
          <View style={styles.passwordInfoCard}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.primaryDark} />
            <Text style={styles.passwordInfoText}>
              Password must be at least 8 characters long and include letters and numbers.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleSignup}
          disabled={isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Sign Up</Text>}
        </TouchableOpacity>

        <View style={styles.orDividerRow}>
          <View style={styles.orDividerLine} />
          <Text style={styles.orDividerText}>or</Text>
          <View style={styles.orDividerLine} />
        </View>

        <View style={styles.signupFooterRow}>
          <Text style={styles.signupFooterText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => setScreenMode('login')}>
            <Text style={styles.signupFooterLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderOtpVerification = () => (
    <View style={styles.formScreen}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setScreenMode(otpOrigin === 'login' ? 'login' : 'signup')}
      >
        <Ionicons name="chevron-back" size={24} color={colors.textHeading} />
      </TouchableOpacity>

      <HeroIcon />
      <Text style={styles.title}>Verify Your Phone</Text>
      <Text style={styles.subtitleCompact}>
        Enter the {OTP_DIGIT_LIMIT}-digit code we sent to{'\n'}{PK_PHONE_PREFIX} {signupForm.phone}
      </Text>

      <View style={styles.formCard}>
        <View style={styles.otpBoxesContainer}>
          {Array(OTP_DIGIT_LIMIT).fill(0).map((_, i) => (
            <View
              key={i}
              style={[
                styles.otpBox,
                otpForm.otp.length === i && styles.otpBoxActive,
                signupOtpError ? styles.otpBoxError : null,
              ]}
            >
              <Text style={styles.otpBoxText}>{otpForm.otp[i] || ''}</Text>
            </View>
          ))}
          <TextInput
            style={styles.otpHiddenInput}
            value={otpForm.otp}
            onChangeText={(value) => updateOtpField('otp', value.replace(/\D/g, '').slice(0, OTP_DIGIT_LIMIT))}
            keyboardType="number-pad"
            autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
            importantForAutofill="yes"
            maxLength={OTP_DIGIT_LIMIT}
            caretHidden
            autoFocus
          />
        </View>

        {signupOtpError ? <Text style={styles.fieldErrorText}>{signupOtpError}</Text> : null}

        <View style={styles.resendContainer}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.primaryDark} />
          <Text style={styles.resendText}>Didn't receive code?</Text>
          <TouchableOpacity
            activeOpacity={0.75}
            disabled={verificationResendCountdown > 0 || isRequestingVerificationOtp}
            onPress={() => {
              void handleVerificationOtpResend();
            }}
          >
            <Text
              style={[
                styles.resendAction,
                verificationResendCountdown > 0 || isRequestingVerificationOtp
                  ? styles.resendActionDisabled
                  : null,
              ]}
            >
              {isRequestingVerificationOtp
                ? 'Sending...'
                : verificationResendCountdown > 0
                  ? `Resend OTP (${formatOtpCountdown(verificationResendCountdown)})`
                  : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleVerify}
          disabled={isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Verify & Continue</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderForgotPassword = () => (
    <View style={styles.formScreen}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          setForgotPasswordOtpError(null);
          setForgotPasswordPasswordError(null);
          setForgotPasswordConfirmPasswordError(null);
          setScreenMode('login');
        }}
      >
        <Ionicons name="chevron-back" size={24} color={colors.textHeading} />
      </TouchableOpacity>

      <HeroIcon />
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitleCompact}>
        Enter the {OTP_DIGIT_LIMIT}-digit code sent to{'\n'}{PK_PHONE_PREFIX} {forgotPasswordForm.phone}
      </Text>

      <View style={styles.formCard}>
        <View style={styles.otpBoxesContainer}>
          {Array(OTP_DIGIT_LIMIT).fill(0).map((_, i) => (
            <View key={i} style={[styles.otpBox, forgotPasswordForm.otp.length === i && styles.otpBoxActive]}>
              <Text style={styles.otpBoxText}>{forgotPasswordForm.otp[i] || ''}</Text>
            </View>
          ))}
          <TextInput
            style={styles.otpHiddenInput}
            value={forgotPasswordForm.otp}
            onChangeText={(value) =>
              updateForgotPasswordField('otp', value.replace(/\D/g, '').slice(0, OTP_DIGIT_LIMIT))
            }
            keyboardType="number-pad"
            autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
            importantForAutofill="yes"
            maxLength={OTP_DIGIT_LIMIT}
            caretHidden
            autoFocus
          />
        </View>

        {forgotPasswordOtpError ? <Text style={styles.fieldErrorText}>{forgotPasswordOtpError}</Text> : null}

        <View style={styles.resendContainer}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.primaryDark} />
          <Text style={styles.resendText}>Didn't receive code?</Text>
          <TouchableOpacity
            activeOpacity={0.75}
            disabled={forgotPasswordResendCountdown > 0 || isRequestingForgotPasswordOtp}
            onPress={() => {
              void handleForgotPasswordOtpResend();
            }}
          >
            <Text
              style={[
                styles.resendAction,
                forgotPasswordResendCountdown > 0 || isRequestingForgotPasswordOtp
                  ? styles.resendActionDisabled
                  : null,
              ]}
            >
              {isRequestingForgotPasswordOtp
                ? 'Sending...'
                : forgotPasswordResendCountdown > 0
                  ? `Resend OTP (${formatOtpCountdown(forgotPasswordResendCountdown)})`
                  : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        </View>

        <Field
          label="New Password"
          icon="lock-closed-outline"
          placeholder="Enter your new password"
          value={forgotPasswordForm.newPassword}
          onChangeText={(value) => updateForgotPasswordField('newPassword', value)}
          secureTextEntry
          inputRef={forgotPasswordNewPasswordRef}
          onFocus={() => scrollForgotPasswordInputIntoView(forgotPasswordNewPasswordRef)}
          errorText={forgotPasswordPasswordError || undefined}
        />

        <Field
          label="Confirm Password"
          icon="lock-closed-outline"
          placeholder="Confirm your new password"
          value={forgotPasswordForm.confirmPassword}
          onChangeText={(value) => updateForgotPasswordField('confirmPassword', value)}
          secureTextEntry
          inputRef={forgotPasswordConfirmPasswordRef}
          onFocus={() => scrollForgotPasswordInputIntoView(forgotPasswordConfirmPasswordRef)}
          errorText={forgotPasswordConfirmPasswordError || undefined}
        />

        <TouchableOpacity
          style={[styles.primaryButton, isResettingPassword && styles.primaryButtonDisabled]}
          activeOpacity={0.85}
          onPress={() => {
            void handleForgotPasswordReset();
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
    </View>
  );

  const renderLogin = () => (
    <View style={styles.formScreen}>
      <HeroIcon />
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.loginSubtitle}>
        Log in to manage your assets
      </Text>

      <View style={styles.formCard}>
        <PhoneField
          label="Phone Number"
          value={loginForm.phone}
          onChangeText={(value) => updatePhoneDigits('login', value)}
          errorText={loginPhoneError || undefined}
        />
        <View style={styles.fieldBlock}>
          <Field
            label="Password"
            icon="lock-closed-outline"
            placeholder="Enter your password"
            value={loginForm.password}
            onChangeText={(value) => updateLoginField('password', value)}
            secureTextEntry
            errorText={loginPasswordError || undefined}
          />
          <TouchableOpacity
            style={styles.forgotPasswordWrap}
            disabled={isRequestingForgotPasswordOtp}
            onPress={() => {
              void handleForgotPasswordRequest('login');
            }}
          >
            <Text style={styles.forgotPassword}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.checkboxRow} 
          activeOpacity={0.7} 
          onPress={() => updateLoginField('rememberMe', !loginForm.rememberMe)}
        >
          <View style={[styles.checkbox, loginForm.rememberMe && styles.checkboxChecked]}>
            {loginForm.rememberMe && <Ionicons name="checkmark" size={14} color={colors.white} />}
          </View>
          <Text style={styles.checkboxLabel}>Remember me</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Log In</Text>}
        </TouchableOpacity>

        <View style={styles.orDividerRow}>
          <View style={styles.orDividerLine} />
          <Text style={styles.orDividerText}>or</Text>
          <View style={styles.orDividerLine} />
        </View>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.85}
          onPress={() => setScreenMode('signup')}
        >
          <Text style={styles.secondaryButtonText}>Sign Up</Text>
        </TouchableOpacity>

        <View style={styles.termsTextWrap}>
          <Text style={styles.termsText}>By continuing, you agree to our</Text>
          <View style={styles.termsLinksRow}>
            <TouchableOpacity activeOpacity={0.75} onPress={onTermsConditionsPress}>
              <Text style={styles.termsLink}>Terms and Conditions</Text>
            </TouchableOpacity>
            <Text style={styles.termsText}> and </Text>
            <TouchableOpacity activeOpacity={0.75} onPress={onPrivacyPolicyPress}>
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        enabled
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={forgotPasswordScrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          {screenMode === 'signup' ? renderSignup() : null}
          {screenMode === 'otp' ? renderOtpVerification() : null}
          {screenMode === 'login' ? renderLogin() : null}
          {screenMode === 'forgotPassword' ? renderForgotPassword() : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
