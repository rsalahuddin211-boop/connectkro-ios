import { Platform } from 'react-native';
import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

export interface SmsOtpReceivedEvent {
  code: string;
}

interface SmsRetrieverNativeModule {
  startListening(): Promise<void>;
  stopListening(): void;
  addListener(
    eventName: 'otpReceived',
    listener: (event: SmsOtpReceivedEvent) => void,
  ): EventSubscription;
}

const nativeModule = Platform.OS === 'android'
  ? requireOptionalNativeModule<SmsRetrieverNativeModule>('SmsRetriever')
  : null;

let subscription: EventSubscription | null = null;
let listenerGeneration = 0;

function stopNativeListener() {
  subscription?.remove();
  subscription = null;
  nativeModule?.stopListening();
}

export async function startSmsOtpListener(onCode: (code: string) => void) {
  const generation = ++listenerGeneration;
  stopNativeListener();

  if (!nativeModule) {
    return;
  }

  subscription = nativeModule.addListener('otpReceived', ({ code }) => {
    if (generation !== listenerGeneration || !/^\d{6}$/.test(code)) {
      return;
    }

    onCode(code);
  });

  try {
    await nativeModule.startListening();
  } catch {
    if (generation === listenerGeneration) {
      stopNativeListener();
    }
  }
}

export function stopSmsOtpListener() {
  listenerGeneration += 1;
  stopNativeListener();
}
